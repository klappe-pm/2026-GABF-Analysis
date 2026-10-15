#!/usr/bin/env node
// Assemble the site artifact in _site/ during the move from the old static site to the Material 3 app
// in web/. buildspec.yml syncs it to the site bucket behind CloudFront. Layout (the URL map is in
// docs/deployment.md):
//   1. dist/ (npm run build) is copied first, so every old page keeps its URL.
//   2. The old overview dashboard (dist/index.html) moves to /overview/, because the web/ home owns /.
//   3. web/out (npm run web:build) is laid over the top; a web/ route replaces an old page at the same path.
//   4. gabf-dashboard.html (npm run build:standalone) is published at /gabf-dashboard.html.
//   5. The GitHub Pages marker .nojekyll that dist/ carries is dropped; the host needs no marker files.
//
//   node scripts/assemble-site.mjs [--dist dist] [--web web/out] [--out _site]

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, parseArgs } from './lib/paths.mjs';

export const OVERVIEW_DIR = 'overview';

// The old overview sits at the site root, so its relative links start "./" or name a path directly
// ("assets/dashboards.js"), and window.GABF_BASE is "./". One level down, each needs "../". Absolute
// URLs, root paths, fragments, data: URLs, and links already starting "../" are left alone.
const RELATIVE_ATTR = /(\s(?:src|href)=")(?![a-z][a-z0-9+.-]*:|\/|#|\.\.\/)(?:\.\/)?/gi;

export function relocateOverview(html) {
  return html.replace(RELATIVE_ATTR, '$1../').replace(/(window\.GABF_BASE = )"\.\/"/, '$1"../"');
}

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

export function assemble({ dist, web, standalone, out }) {
  for (const [label, p] of [['dist', dist], ['web export', web], ['single file dashboard', standalone]]) {
    if (!existsSync(p)) throw new Error(`${label} not found at ${p}; build it first`);
  }
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  cpSync(dist, out, { recursive: true });

  const oldHome = join(out, 'index.html');
  mkdirSync(join(out, OVERVIEW_DIR), { recursive: true });
  writeFileSync(join(out, OVERVIEW_DIR, 'index.html'), relocateOverview(readFileSync(oldHome, 'utf8')));
  rmSync(oldHome);

  const oldFiles = new Set(files(out));
  const replaced = files(web).filter((f) => oldFiles.has(f));
  cpSync(web, out, { recursive: true });
  cpSync(standalone, join(out, 'gabf-dashboard.html'));
  rmSync(join(out, '.nojekyll'), { force: true });
  const missing = REQUIRED.filter((f) => !existsSync(join(out, f)));
  if (missing.length) throw new Error(`the artifact has no ${missing.join(' and ')}; a deploy without it would break the site`);
  return { replaced, files: files(out).length };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  const r = assemble({
    dist: resolve(ROOT, args.dist || 'dist'),
    web: resolve(ROOT, args.web || 'web/out'),
    standalone: resolve(ROOT, args.standalone || 'gabf-dashboard.html'),
    out: resolve(ROOT, args.out || '_site'),
  });
  console.log(`assembled ${r.files} files into ${args.out || '_site'}; web routes replacing old files: ${r.replaced.length ? r.replaced.join(', ') : 'none'}`);
}
