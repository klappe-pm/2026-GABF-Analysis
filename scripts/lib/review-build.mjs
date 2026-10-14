// The review build: the same site with the inline feedback widget, source location attributes,
// and a build record on every page. It exists only when GABF_FEEDBACK=1, writes to dist-review/,
// and refuses to run in continuous integration, so the public build and the Pages deploy never
// carry any of it. tests/review-build.test.mjs builds both and checks the public one is clean.

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { ROOT, SITE } from './paths.mjs';

export const REVIEW = process.env.GABF_FEEDBACK === '1';

// Markers the public build must never contain. The test scans every file in dist/ for them.
export const REVIEW_MARKERS = ['feedback-widget', 'data-src=', '/review/feedback', 'gabf-review-build'];

export function assertReviewAllowed(env = process.env) {
  if (env.GABF_FEEDBACK === '1' && (env.CI || env.GITHUB_ACTIONS)) {
    throw new Error('GABF_FEEDBACK=1 is refused in continuous integration: the review build is local only and is never deployed.');
  }
}

function git(args) {
  try { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; }
}

let buildInfo = null;
export function reviewBuildInfo() {
  buildInfo ??= { commit: git(['rev-parse', 'HEAD']), branch: git(['rev-parse', '--abbrev-ref', 'HEAD']), dirty: git(['status', '--porcelain']).length > 0, built_at: new Date().toISOString() };
  return buildInfo;
}

// The page writer that called write(), read from the stack: "scripts/build-site.mjs:390 breweryPage".
export function callerLocation(skip = ['write', 'callerLocation', 'annotatePage']) {
  const frames = String(new Error().stack).split('\n').slice(1);
  for (const frame of frames) {
    const m = /at (?:async )?([\w$.<>]+)? ?\(?(?:file:\/\/)?([^():]+):(\d+):\d+\)?/.exec(frame.trim());
    if (!m) continue;
    const fn = (m[1] || '').split('.').pop();
    if (skip.includes(fn)) continue;
    const file = relative(ROOT, m[2]);
    if (file.startsWith('..') || file.includes('node_modules')) continue;
    return `${file}:${m[3]}${fn ? ` ${fn}` : ''}`;
  }
  return 'scripts/build-site.mjs';
}

function lineOf(file, symbol) {
  const text = readFileSync(resolve(ROOT, file), 'utf8').split('\n');
  const patterns = [new RegExp(`function\\s+${symbol}\\b`), new RegExp(`(?:const|let)\\s+${symbol}\\s*=`), new RegExp(`['"]?${symbol}['"]?\\s*:\\s*\\{`), new RegExp(`\\b${symbol}\\b`)];
  for (const p of patterns) {
    const i = text.findIndex((l) => p.test(l));
    if (i !== -1) return i + 1;
  }
  return null;
}

// site/review/source-map.json names the client module and function behind each region; the
// review build resolves each to a line so a ticket names a place to edit, not just a file.
export function resolvedSourceMap() {
  const map = JSON.parse(readFileSync(resolve(SITE, 'review', 'source-map.json'), 'utf8'));
  return map.entries.map((e) => ({ ...e, line: existsSync(resolve(ROOT, e.file)) ? lineOf(e.file, e.symbol) : null }));
}

export function copyReviewAssets(dist) {
  const out = resolve(dist, 'assets', 'review');
  mkdirSync(out, { recursive: true });
  for (const f of ['feedback-widget.mjs', 'feedback-widget.css']) cpSync(resolve(SITE, 'review', f), resolve(out, f));
  writeFileSync(resolve(out, 'source-map.json'), JSON.stringify(resolvedSourceMap()));
}

const depthOf = (relPath) => relPath.split('/').length - 1;

// Adds source attributes to the regions the build writes, a build record, and the widget.
export function annotatePage(html, relPath, writer) {
  const r = depthOf(relPath) === 0 ? './' : '../'.repeat(depthOf(relPath));
  const assets = [...html.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+\.(?:m?js|css))"/g)].map((m) => m[1].replace(/^(\.\.\/|\.\/)+/, 'site/'));
  const record = { ...reviewBuildInfo(), page: relPath, writer, assets: [...new Set(assets)] };
  const tag = (re, value) => { html = html.replace(re, (m) => m.replace(/^<(\w+)/, `<$1 data-src="${value}"`)); };
  tag(/<header class="site-header[^>]*>/, 'scripts/build-site.mjs layout');
  tag(/<footer class="site-footer[^>]*>/, 'scripts/build-site.mjs layout');
  tag(/<main id="main"[^>]*>/, writer);
  html = html.replace(/<div class="view" data-view="([^"]+)"/g, (m, view) => `<div data-src="site/assets/page-views.mjs renderView(${view})" class="view" data-view="${view}"`);
  const inject = `<script type="application/json" id="gabf-review-build">${JSON.stringify(record).replace(/</g, '\\u003c')}</script>\n<link rel="stylesheet" href="${r}assets/review/feedback-widget.css">\n<script type="module" src="${r}assets/review/feedback-widget.mjs"></script>\n`;
  return html.includes('</body>') ? html.replace(/<\/body>(?![\s\S]*<\/body>)/, `${inject}</body>`) : html + inject;
}
