// The feedback widget is a review tool and must never reach the public site. These tests build the
// site both ways into scratch directories: the public build must carry no widget, no source
// attributes, no build record, and no feedback endpoint; the review build must carry all of them.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ROOT } from '../scripts/lib/paths.mjs';
import { assertReviewAllowed, REVIEW_MARKERS } from '../scripts/lib/review-build.mjs';

function buildInto(env) {
  const dir = mkdtempSync(join(tmpdir(), 'gabf-build-'));
  const clean = { ...process.env };
  delete clean.GABF_FEEDBACK;
  delete clean.CI;
  delete clean.GITHUB_ACTIONS;
  try {
    execFileSync(process.execPath, [resolve(ROOT, 'scripts/build-site.mjs')], { cwd: ROOT, env: { ...clean, GABF_DIST: dir, ...env }, stdio: 'ignore' });
  } catch (error) {
    rmSync(dir, { recursive: true, force: true });
    throw error;
  }
  return dir;
}

function filesUnder(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) filesUnder(full, out); else out.push(full);
  }
  return out;
}

test('the public build contains no part of the feedback widget', () => {
  const dir = buildInto({});
  try {
    const hits = [];
    for (const file of filesUnder(dir)) {
      if (file.includes(`${join('assets', 'review')}`)) hits.push(`${file}: review asset`);
      if (!/\.(html|m?js|css|json)$/.test(file)) continue;
      const text = readFileSync(file, 'utf8');
      for (const marker of REVIEW_MARKERS) if (text.includes(marker)) hits.push(`${file.slice(dir.length)}: ${marker}`);
    }
    assert.deepEqual(hits.slice(0, 10), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the review build carries the widget, the source attributes, and the build record', () => {
  const dir = buildInto({ GABF_FEEDBACK: '1' });
  try {
    const page = readFileSync(join(dir, 'breweries/green-cheek-beer-co/index.html'), 'utf8');
    for (const marker of ['feedback-widget', 'data-src=', 'gabf-review-build']) assert.ok(page.includes(marker), `review page lacks ${marker}`);
    assert.match(page, /<main data-src="scripts\/build-site\.mjs:\d+ breweryPage"/);
    const widget = readFileSync(join(dir, 'assets/review/feedback-widget.mjs'), 'utf8');
    for (const marker of ['/review/regions', 'gabf-review', 'gabf-control-plane', 'gfw-region']) assert.ok(widget.includes(marker), `the page picker lacks ${marker}`);
    assert.ok(!widget.includes('gfw-fab'), 'the page picker has no floating Feedback button: the control plane owns the one entry point');
    const css = readFileSync(join(dir, 'assets/review/feedback-widget.css'), 'utf8');
    assert.ok(css.includes('.gfw-region') && css.includes('.gfw-pin'), 'the step marker and the numbered pins are drawn by distinct rules');
    assert.ok(widget.includes("LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost'"), 'the widget must refuse to start off this machine');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a review build is refused in continuous integration', () => {
  assert.throws(() => assertReviewAllowed({ GABF_FEEDBACK: '1', CI: 'true' }), /refused in continuous integration/);
  assert.throws(() => assertReviewAllowed({ GABF_FEEDBACK: '1', GITHUB_ACTIONS: 'true' }), /refused/);
  assert.doesNotThrow(() => assertReviewAllowed({ CI: 'true' }));
});
