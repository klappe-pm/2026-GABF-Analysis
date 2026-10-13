#!/usr/bin/env node
// Serve dist/ locally for a preview. No dependencies.
//   node scripts/serve-dist.mjs [--port 8080]

import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { DIST, parseArgs } from './lib/paths.mjs';

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.csv': 'text/csv', '.txt': 'text/plain' };

const args = parseArgs(process.argv.slice(2));
const port = Number(args.port ?? 8080);
createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (path.endsWith('/')) path += 'index.html';
  const file = normalize(join(DIST, path));
  if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) {
    const withIndex = join(file, 'index.html');
    if (existsSync(withIndex)) {
      res.writeHead(200, { 'content-type': TYPES['.html'] });
      createReadStream(withIndex).pipe(res);
      return;
    }
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`serving ${DIST} at http://localhost:${port}/`));
