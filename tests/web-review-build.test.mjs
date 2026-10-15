// The public export carries no review code. The site is built twice, as the public build (no WEB_REVIEW) and as
// the review build (WEB_REVIEW=1), each into its own folder under web/. The review build must hold the widget,
// or the scan proves nothing; the public build must hold none of it: not the widget's markup or classes, not
// the endpoints it calls, not the copy-key marks.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ROOT } from '../scripts/lib/paths.mjs';
import { CLOSE, OPEN, SEP } from '../web/review/markers.mjs';

const WEB = resolve(ROOT, 'web');
const ready = existsSync(resolve(WEB, 'node_modules/next'));

// What only the review widget, the in place editor, or the marking can leave in a page.
const REVIEW_TRACES = ['gfw-', 'data-gfw', 'gabf-control-plane', 'open-feedback', '/review/inline/resolve', '/review/regions', '/review/feedback', '/review/inline/save', '/review/web/screens', '/review/content', '/__design/', 'Open in Obsidian', 'Journey Step', 'Spots on the Page', OPEN, SEP, CLOSE];

function build(dist, env) {
  const full = resolve(WEB, dist);
  rmSync(full, { recursive: true, force: true });
  execFileSync('npm', ['run', 'build', '--prefix', 'web'], { cwd: ROOT, env: { ...process.env, ...env, WEB_DIST_DIR: dist }, stdio: 'pipe' });
  return full;
}

function files(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) files(full, out);
    else if (/\.(html|js|css|txt|json|map)$/.test(name)) out.push(full);
  }
  return out;
}

const hits = (dir) => {
  const found = new Map();
  for (const f of files(dir)) {
    const text = readFileSync(f, 'utf8');
    for (const trace of REVIEW_TRACES) if (text.includes(trace)) found.set(trace, [...(found.get(trace) ?? []), f.slice(dir.length)]);
  }
  return found;
};

test('the public export contains no review code, and the review build does', { skip: !ready && 'run npm run web:install first', timeout: 600_000 }, () => {
  const pub = build('out-test-public', { WEB_REVIEW: '', DESIGN_REVIEW: '' });
  const review = build('out-test-review', { WEB_REVIEW: '1', DESIGN_REVIEW: '1' });
  try {
    const leaked = hits(pub);
    assert.deepEqual([...leaked].map(([trace, where]) => `${JSON.stringify(trace)} in ${where.slice(0, 3).join(', ')}`), [], 'the public export holds review code');
    assert.ok(files(pub).length > 50, 'the public build produced pages');
    const present = hits(review);
    assert.ok(present.has('gfw-'), 'the review build holds the widget, so the scan above could find it');
    assert.ok(present.has('/review/feedback'), 'the review build holds the endpoint the widget sends to');
    assert.ok(present.has('Spots on the Page'), 'the review build carries the widget words read from the copy documents');
    assert.ok(present.has('/__design/'), 'the review build holds the settings panel, mounted inside the widget');
  } finally {
    rmSync(pub, { recursive: true, force: true });
    rmSync(review, { recursive: true, force: true });
  }
});

test('the public build aliases the widget to a stand in, and the widget stays out of the stand in', () => {
  const config = readFileSync(resolve(WEB, 'next.config.ts'), 'utf8');
  assert.match(config, /'web-review': webReview \? '\.\/review\/widget\.tsx' : '\.\/review\/widget-off\.tsx'/);
  const off = readFileSync(resolve(WEB, 'review/widget-off.tsx'), 'utf8');
  assert.ok(!/import /.test(off.replace(/^\/\/.*$/gm, '')), 'the stand in imports nothing');
  assert.match(off, /return null/);
});
