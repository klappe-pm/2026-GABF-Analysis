// Playwright for the browser tests and the screenshot scripts: the module, and the Chromium to launch.
// Either may be missing on a machine or a runner; callers skip rather than fail.

import { existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

// PLAYWRIGHT_MODULE first, then the repository, then the global npm root.
export async function loadPlaywright({ root, env = process.env, globalRoot = null } = {}) {
  const require = createRequire(import.meta.url);
  const candidates = [env.PLAYWRIGHT_MODULE, root ? resolve(root, 'node_modules', 'playwright') : null, globalRoot ? resolve(globalRoot, 'playwright') : null].filter(Boolean);
  for (const c of candidates) if (existsSync(c)) return require(c);
  throw new Error('Playwright was not found. Set PLAYWRIGHT_MODULE to its folder.');
}

// The Chromium to launch: PLAYWRIGHT_CHROMIUM, else the newest headless shell Playwright cached.
export function chromiumPath(env = process.env, cache = resolve(homedir(), 'Library/Caches/ms-playwright')) {
  if (env.PLAYWRIGHT_CHROMIUM) return env.PLAYWRIGHT_CHROMIUM;
  if (!existsSync(cache)) return undefined;
  const shells = readdirSync(cache).filter((n) => n.startsWith('chromium_headless_shell-')).sort().reverse();
  for (const dir of shells) {
    const base = resolve(cache, dir);
    for (const sub of readdirSync(base)) {
      const exe = resolve(base, sub, 'chrome-headless-shell');
      if (existsSync(exe)) return exe;
    }
  }
  return undefined;
}
