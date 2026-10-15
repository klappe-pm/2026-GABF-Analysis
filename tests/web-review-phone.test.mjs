// No feedback is collected at phone width (owner decision on issue #72). The web review widget draws no
// Feedback entry and no panel below the phone breakpoint, the stylesheet hides the layer at the same width,
// and neither the panel nor the in place editor ever records a phone device on a ticket.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from '../scripts/lib/paths.mjs';

const read = (path) => readFileSync(resolve(ROOT, 'web/review', path), 'utf8');

test('the phone breakpoint is defined once and the stylesheet hides the widget at it', () => {
  const dom = read('dom.ts');
  const query = /export const PHONE_QUERY = '\((max-width: [\d.]+rem)\)'/.exec(dom);
  assert.ok(query, 'dom.ts exports PHONE_QUERY');
  const css = read('review.css');
  const rule = new RegExp(`@media \\(${query[1].replace('.', '\\.')}\\) \\{[^\\n]*\\.gfw-root \\{ display: none; \\}`);
  assert.match(css, rule, 'review.css hides .gfw-root at the same width');
  assert.doesNotMatch(css, /--gfw-width: 100vw/, 'the panel no longer goes full width on a phone');
});

test('the widget closes and draws nothing at phone width, and Shift F does not open it there', () => {
  const widget = read('widget.tsx');
  assert.match(widget, /matchMedia\(PHONE_QUERY\)/);
  assert.match(widget, /if \(mq\.matches\) setOpen\(false\)/);
  assert.match(widget, /!typing && !phoneRef\.current\)/);
  assert.match(widget, /return phone \? null : createPortal\(nodes, host \?\? document\.body\)/);
});

test('no ticket records a phone device', () => {
  for (const file of ['widget.tsx', 'inline-editor.tsx']) {
    const src = read(file);
    assert.doesNotMatch(src, /'phone'/, `${file} never sends a phone device`);
    assert.match(src, /device: deviceOf\(\)/, `${file} sends the device from deviceOf`);
  }
  assert.match(read('dom.ts'), /export const deviceOf = \(\): 'tablet' \| 'desktop' =>/);
});

// The control plane files no ticket of its own: its Feedback button opens the widget inside the framed page, which
// sends the device rules above.
test('the control plane Feedback entry opens the framed page widget and posts no ticket', () => {
  const panel = readFileSync(resolve(ROOT, 'docs/design/prototype/feedback-panel.js'), 'utf8');
  assert.doesNotMatch(panel, /'\/review\/feedback'/);
  assert.match(panel, /kind: 'open-feedback'/);
});
