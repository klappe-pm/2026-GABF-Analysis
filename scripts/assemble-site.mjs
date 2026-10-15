#!/usr/bin/env node
// Assemble the site artifact in _site/. buildspec.yml syncs it to the site bucket behind CloudFront. Layout (the
// URL map is in docs/deployment.md):
//   1. web/out (npm run web:build), the Material 3 app: every page, its data files under /data/, and 404.html.
//   2. gabf-dashboard.html (npm run build:standalone) is published at /gabf-dashboard.html.
// Nothing of the retired static page build is published.
//
//   node scripts/assemble-site.mjs [--web web/out] [--standalone gabf-dashboard.html] [--out _site]

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, parseArgs } from './lib/paths.mjs';

function files(dir, base = dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...files(full, base));
    else out.push(relative(base, full));
  }
  return out;
}

// The files a deploy must carry: the home page and the page CloudFront serves for any missing address.
export const REQUIRED = ['index.html', '404.html'];

export function assemble({ web, standalone, out }) {
  for (const [label, p] of [['web export', web], ['single file dashboard', standalone]]) {
    if (!existsSync(p)) throw new Error(`${label} not found at ${p}; build it first`);
  }
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  cpSync(web, out, { recursive: true });
  cpSync(standalone, join(out, 'gabf-dashboard.html'));
  const missing = REQUIRED.filter((f) => !existsSync(join(out, f)));
  if (missing.length) throw new Error(`the artifact has no ${missing.join(' and ')}; a deploy without it would break the site`);
  return { files: files(out).length };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  const r = assemble({
    web: resolve(ROOT, args.web || 'web/out'),
    standalone: resolve(ROOT, args.standalone || 'gabf-dashboard.html'),
    out: resolve(ROOT, args.out || '_site'),
  });
  console.log(`assembled ${r.files} files into ${args.out || '_site'}`);
}
