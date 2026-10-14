#!/usr/bin/env node
// Build the design system products from .design/design-system:
//   web/design/tokens.css                         CSS custom properties for both themes and the Tailwind theme
//   .design/design-system/control-plane/system.json  the manifest of tokens and components
//   docs/design/design-system-tokens.json         token and component nodes for the screen feedback control plane
// Then append a hash chained entry to the local change log when a token value or a spec status changed.

import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  CHANGELOG, CSS_OUT, FEEDBACK_OUT, MANIFEST, buildCss, buildManifest, diffSnapshots, feedbackDocument,
  loadSpecs, loadTokens, readLog, rel, sha, snapshot, stableJson,
} from './lib.mjs';

export function products() {
  const tokens = loadTokens();
  const specs = loadSpecs();
  const manifest = buildManifest(tokens, specs);
  return {
    tokens,
    specs,
    files: {
      [CSS_OUT]: buildCss(tokens),
      [MANIFEST]: stableJson(manifest),
      [FEEDBACK_OUT]: stableJson(feedbackDocument(tokens, specs, manifest)),
    },
  };
}

function write(file, text) {
  mkdirSync(dirname(file), { recursive: true });
  const before = existsSync(file) ? readFileSync(file, 'utf8') : null;
  if (before === text) return false;
  writeFileSync(file, text);
  return true;
}

export function recordChanges(tokens, specs, now = new Date()) {
  const entries = readLog();
  const last = entries.at(-1);
  const snap = snapshot(tokens, specs);
  const snapHash = sha(JSON.stringify(snap));
  if (last && last.snapshotHash === snapHash) return null;
  const changes = diffSnapshots(last?.snapshot, snap);
  const body = { seq: entries.length + 1, at: now.toISOString(), prev: last?.hash ?? null, changes, snapshotHash: snapHash, snapshot: snap };
  const entry = { ...body, hash: sha(JSON.stringify(body)) };
  mkdirSync(dirname(CHANGELOG), { recursive: true });
  appendFileSync(CHANGELOG, `${JSON.stringify(entry)}\n`);
  return entry;
}

function main() {
  const { tokens, specs, files } = products();
  for (const [file, text] of Object.entries(files)) console.log(`${write(file, text) ? 'wrote' : 'unchanged'} ${rel(file)}`);
  if (process.env.CI) return;
  const entry = recordChanges(tokens, specs);
  console.log(entry ? `change log: entry ${entry.seq}, ${entry.changes.length} change(s)` : 'change log: no token or status change');
}

if (import.meta.url === `file://${process.argv[1]}`) main();
