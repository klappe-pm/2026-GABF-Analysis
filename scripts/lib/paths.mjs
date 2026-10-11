import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DATA = resolve(ROOT, 'data');
export const RAW = resolve(DATA, 'raw');
export const RESULTS = resolve(DATA, 'results');
export const REFERENCE = resolve(DATA, 'reference');
export const ENRICHED = resolve(DATA, 'enriched');
export const CACHE = resolve(DATA, 'cache');
export const BREWERIES = resolve(ROOT, 'breweries');
export const SITE = resolve(ROOT, 'site');
export const DIST = resolve(ROOT, 'dist');
export const REPORTS = resolve(ROOT, 'reports');

export function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (v !== undefined) args[k] = v;
      else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        args[k] = argv[i + 1];
        i += 1;
      } else args[k] = true;
    } else args._.push(a);
  }
  return args;
}
