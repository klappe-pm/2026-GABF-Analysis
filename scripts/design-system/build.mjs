#!/usr/bin/env node
// Prepare the design system for the site:
//   1. rewrite each component spec's body (its image and the what-you-can-change list) from its frontmatter,
//      leaving the frontmatter exactly as written;
//   2. copy settings.md, layout.md, and every spec.md into web/public/design-settings/, which the static
//      export serves so each page can read the settings when it loads.
// Run it after changing a spec's frontmatter: npm run design-system:build

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LAYOUT, PUBLIC_SETTINGS, SETTINGS, design, loadSpecs, rel } from './lib.mjs';

// The spec text with its body regenerated, or null when the spec has no usable frontmatter.
export async function specText(s) {
  const { specBody, componentSettings } = await design();
  if (!s.exists || !s.head) return null;
  return s.head + specBody(s.dir, String(s.data.title ?? s.dir), componentSettings(s.dir, s.data));
}

export async function staleSpecs() {
  const stale = [];
  for (const s of loadSpecs()) {
    const text = await specText(s);
    if (text !== null && text !== s.text) stale.push(s);
  }
  return stale;
}

export function publish() {
  rmSync(PUBLIC_SETTINGS, { recursive: true, force: true });
  mkdirSync(resolve(PUBLIC_SETTINGS, 'components'), { recursive: true });
  cpSync(SETTINGS, resolve(PUBLIC_SETTINGS, 'settings.md'));
  cpSync(LAYOUT, resolve(PUBLIC_SETTINGS, 'layout.md'));
  for (const s of loadSpecs()) {
    if (!s.exists) continue;
    mkdirSync(resolve(PUBLIC_SETTINGS, 'components', s.dir), { recursive: true });
    cpSync(s.file, resolve(PUBLIC_SETTINGS, 'components', s.dir, 'spec.md'));
  }
}

async function main() {
  for (const s of await staleSpecs()) {
    writeFileSync(s.file, await specText(s));
    console.log(`wrote ${rel(s.file)}`);
  }
  if (!existsSync(SETTINGS) || !existsSync(LAYOUT)) throw new Error('settings.md and layout.md are required in .design/design-system');
  publish();
  console.log(`copied the settings to ${rel(PUBLIC_SETTINGS)}`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
