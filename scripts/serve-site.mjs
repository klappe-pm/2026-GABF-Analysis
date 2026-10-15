#!/usr/bin/env node
// Serve the site artifact (_site/, npm run site:assemble) the way CloudFront serves it from the bucket,
// so a deploy can be checked by hand before it goes out:
//   /path/ and /path (no file extension) are answered from /path/index.html, as the distribution's
//   viewer-request function rewrites them;
//   an address with no file is answered with /404.html and status 404, as the distribution's error
//   responses do for the bucket's 403 and 404.
//
//   node scripts/serve-site.mjs [--dir _site] [--port 8090]

import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, parseArgs } from './lib/paths.mjs';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.csv': 'text/csv; charset=utf-8', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json',
};

// The key CloudFront asks the bucket for, after the viewer-request function.
export function objectKey(uri) {
  if (uri.endsWith('/')) return `${uri}index.html`;
  if (!extname(uri.split('/').pop())) return `${uri}/index.html`;
  return uri;
}

export function createSiteServer(dir) {
  return createServer((req, res) => {
    const uri = normalize(decodeURIComponent(req.url.split('?')[0].split('#')[0])).replace(/^(\.\.[/\\])+/, '');
    const file = join(dir, objectKey(uri));
    const found = file.startsWith(dir) && existsSync(file) && statSync(file).isFile();
    const path = found ? file : join(dir, '404.html');
    res.writeHead(found ? 200 : 404, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(readFileSync(path));
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  const dir = resolve(ROOT, args.dir || '_site');
  if (!existsSync(join(dir, 'index.html'))) { console.error(`${dir} has no index.html; run npm run site:assemble first`); process.exit(1); }
  const port = Number(args.port ?? 8090);
  createSiteServer(dir).listen(port, () => console.log(`serving ${dir} with the CloudFront path rules at http://localhost:${port}/`));
}
