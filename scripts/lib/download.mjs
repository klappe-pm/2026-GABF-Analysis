// Cached downloads for the reference fetchers. Files land in data/cache (ignored by git) so a
// rerun is offline unless --refresh is passed. No API key is read, sent, or stored.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CACHE } from './paths.mjs';

export async function download(url, name, { refresh = false } = {}) {
  mkdirSync(CACHE, { recursive: true });
  const path = resolve(CACHE, name);
  if (!refresh && existsSync(path)) return path;
  const res = await fetch(url, { headers: { 'user-agent': 'gabf-analysis reference fetcher' } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  return path;
}

export async function downloadText(url, name, { refresh = false, encoding = 'utf8' } = {}) {
  return readFileSync(await download(url, name, { refresh }), encoding);
}

// One member of a zip archive as text, through the system unzip (present on macOS and the
// Ubuntu runners); keeps the repository free of a zip dependency.
export function unzipMember(zipPath, member, encoding = 'utf8') {
  return execFileSync('unzip', ['-p', zipPath, member], { maxBuffer: 512 * 1024 * 1024 }).toString(encoding);
}

export function pipeRecords(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
  const header = lines[0].split('|');
  return lines.slice(1).map((l) => {
    const f = l.split('|');
    return Object.fromEntries(header.map((h, i) => [h, f[i] ?? '']));
  });
}
