// Whether the built web export (web/out) is current, for the tests that run against it. A test that reads an
// export older than its sources checks old code: it can fail a correct change or pass a broken one. So a stale
// export fails those tests with the newest changed file and the command that rebuilds it, and a missing export
// fails them too, except in continuous integration, where the export is built after the tests (ci.yml).
//
// Fresh means web/out/index.html is newer than every file under the sources the export is built from: the web
// app itself, the copy, the design settings, and the root modules and data it imports. Generated files
// (node_modules, build folders, the winners SQLite files, the fetch cache) are not sources. Every generator
// that runs during npm test or npm run verify writes outside these folders or only when its content changes.

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ROOT } from './paths.mjs';

export const WEB_OUT_SOURCES = [
  'web/app', 'web/lib', 'web/components', 'web/design', 'web/review', 'web/next.config.ts', 'web/package.json',
  '.docs/content-management-system', '.design', 'site/assets', 'scripts/lib', 'data/reference', 'data/results', 'data/enriched/breweries.json',
];
const SKIP_DIR = (name) => name === 'node_modules' || name === '.next' || name === 'cache' || name === 'out' || name.startsWith('out-');
const SKIP_FILE = (name) => name.endsWith('.sqlite') || name === '.DS_Store';

function newestUnder(path, best) {
  if (!existsSync(path)) return best;
  const s = statSync(path);
  if (s.isFile()) return s.mtimeMs > best.time ? { time: s.mtimeMs, file: path } : best;
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (entry.isDirectory() ? SKIP_DIR(entry.name) : SKIP_FILE(entry.name)) continue;
    best = newestUnder(join(path, entry.name), best);
  }
  return best;
}

const stamp = (ms) => new Date(ms).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');

// { status: 'fresh' } or { status: 'missing' | 'stale', reason } with the rebuild command in the reason.
export function webOutState({ root = ROOT, out = 'web/out' } = {}) {
  const rebuild = `Rebuild it: cd ${root} && npm run web:build`;
  const index = join(root, out, 'index.html');
  if (!existsSync(index)) return { status: 'missing', reason: `${out} is not built. ${rebuild}` };
  const built = statSync(index).mtimeMs;
  const newest = WEB_OUT_SOURCES.reduce((best, p) => newestUnder(join(root, p), best), { time: 0, file: null });
  if (newest.time > built) {
    return { status: 'stale', reason: `${out} (built ${stamp(built)}) is older than ${relative(root, newest.file)} (changed ${stamp(newest.time)}), so its tests would check old code. ${rebuild}` };
  }
  return { status: 'fresh' };
}

// For a test: false when the export is fresh; a skip message in continuous integration when it is missing;
// otherwise throws, so the test fails loudly with the reason.
export function webOutGate({ root = ROOT, out = 'web/out', env = process.env } = {}) {
  const state = webOutState({ root, out });
  if (state.status === 'fresh') return false;
  if (state.status === 'missing' && env.CI) return `${state.reason} (continuous integration builds it after the tests)`;
  throw new Error(state.reason);
}
