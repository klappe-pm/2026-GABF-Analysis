#!/usr/bin/env node
// Add or refresh a `## related` section in every 2026 winner profile (docs/2026/winner/*.md) with
// relative links to the profile's brewery file, the hop variety files it names, and the hop farm
// files that grow those varieties (from scripts/winner-profile-backlinks.mjs). A grown-farm link only
// says the farm grows a variety this beer uses; it never says the brewery bought from it.
//
// The section sits just before `## links` (the sources) and is replaced on every run, so the script
// is idempotent and touches nothing else. date-revised changes only on files whose section changed.
//   node scripts/apply-winner-backlinks.mjs [date]

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from './lib/paths.mjs';
import { backlinkRows } from './winner-profile-backlinks.mjs';

const SECTION_RE = /^## related\s*\n[\s\S]*?(?=^## |(?![\s\S]))/m;

export function relatedSection(rows) {
  const link = (r) => `[${r.link_text.replace(/([[\]])/g, '\\$1')}](${r.relative_link.replace(/--/g, '-%2D')})`;
  const by = (kind) => rows.filter((r) => r.link_kind === kind);
  const lines = [];
  const brewery = by('brewery');
  if (brewery.length) lines.push(`- Brewery: ${brewery.map(link).join(', ')}`);
  const varieties = by('variety');
  if (varieties.length) lines.push(`- Hop varieties: ${varieties.map(link).join(', ')}`);
  const named = by('farm-named');
  if (named.length) lines.push(`- Hop farms the brewery names for this beer: ${named.map(link).join(', ')}`);
  const grown = by('farm-grown');
  if (grown.length) lines.push(`- Hop farms that grow these varieties: ${grown.map((r) => `grown by ${link(r)}`).join(', ')}`);
  if (!lines.length) return '';
  const note = grown.length ? '\n\nEach farm listed as growing a variety grows that variety according to the hop farm data; the brewery has not said it bought hops from that farm.' : '';
  return `## related\n\n${lines.join('\n')}${note}\n\n`;
}

export function applyRelated(text, section) {
  const end = text.indexOf('\n---', 4);
  const head = text.slice(0, end + 4);
  let body = text.slice(end + 4);
  if (SECTION_RE.test(body)) body = body.replace(SECTION_RE, section);
  else if (section) {
    const at = body.search(/^## links\s*$/m);
    body = at >= 0 ? body.slice(0, at) + section + body.slice(at) : `${body.trimEnd()}\n\n${section}`;
  }
  return head + body.replace(/\n*$/, '\n');
}

function main() {
  const date = process.argv[2] ?? new Date().toISOString().slice(0, 10);
  const rows = backlinkRows();
  const byProfile = new Map();
  for (const r of rows) {
    if (!byProfile.has(r.profile_path)) byProfile.set(r.profile_path, []);
    byProfile.get(r.profile_path).push(r);
  }
  let changed = 0;
  for (const [profile, list] of byProfile) {
    const path = resolve(ROOT, profile);
    if (!existsSync(path)) continue;
    const before = readFileSync(path, 'utf8');
    let after = applyRelated(before, relatedSection(list));
    if (after !== before) {
      after = after.replace(/^date-revised: .*$/m, `date-revised: ${date}`);
      writeFileSync(path, after);
      changed += 1;
    }
  }
  console.log(`${changed} profiles updated; ${rows.length} links across ${byProfile.size} profiles`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
