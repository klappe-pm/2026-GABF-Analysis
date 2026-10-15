// The copy keys the old site's browser code reads through tx (site/assets/site-text.mjs): every key in
// a literal tx call under site/assets, found by reading the source, because much of that code
// only runs in the browser and never during the build. The build ships these keys with their text.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SITE } from './paths.mjs';

const CALL = /\btx\(\s*(['"`])([a-z0-9_.-]+)\1/gi;

export function siteTextKeys(dir = join(SITE, 'assets')) {
  const keys = new Set();
  for (const f of readdirSync(dir)) {
    if (!/\.(mjs|js)$/.test(f) || f.includes('.min.')) continue;
    for (const m of readFileSync(join(dir, f), 'utf8').matchAll(CALL)) keys.add(m[2]);
  }
  return [...keys].sort();
}
