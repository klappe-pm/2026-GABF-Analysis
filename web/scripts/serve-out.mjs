#!/usr/bin/env node
// Serve the static export in web/out/ for a local look: node web/scripts/serve-out.mjs [port]
// With --live, requests for /design-settings/ read the source files in .design/design-system/ instead of
// the copies in the export, so an edit to a settings file shows on the next reload with no build step.
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const OUT = resolve(import.meta.dirname, '../out');
const SOURCE = resolve(import.meta.dirname, '../../.design/design-system');
const args = process.argv.slice(2);
const live = args.includes('--live');
const PORT = Number(args.find((a) => /^\d+$/.test(a)) ?? process.env.PORT ?? 4174);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain', '.md': 'text/markdown; charset=utf-8', '.png': 'image/png' };

createServer((req, res) => {
  const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  const fromSource = live && path.startsWith('/design-settings/');
  const root = fromSource ? SOURCE : OUT;
  let file = join(root, fromSource ? path.slice('/design-settings'.length) : path);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!file.startsWith(root) || !existsSync(file) || (fromSource && extname(file) !== '.md')) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found');
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(readFileSync(file));
}).listen(PORT, () => console.log(`serving web/out on http://localhost:${PORT}/${live ? ' (settings read live from .design/design-system)' : ''}`));
