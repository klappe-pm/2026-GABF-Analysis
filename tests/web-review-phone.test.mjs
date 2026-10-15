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
  assert.match(widget, /return phone \? null : createPortal\(nodes, document\.body\)/);
});

test('no ticket records a phone device', () => {
  for (const file of ['widget.tsx', 'inline-editor.tsx']) {
    const src = read(file);
    assert.doesNotMatch(src, /'phone'/, `${file} never sends a phone device`);
    assert.match(src, /device: deviceOf\(\)/, `${file} sends the device from deviceOf`);
  }
  assert.match(read('dom.ts'), /export const deviceOf = \(\): 'tablet' \| 'desktop' =>/);
});

// The old static review path runs inside the design control plane, where a phone width frame is a design
// preview and stays usable, but a ticket made from it carries no device.
test('the static review widget and the control plane panel send no phone device', () => {
  const widget = readFileSync(resolve(ROOT, 'site/review/feedback-widget.mjs'), 'utf8');
  const panel = readFileSync(resolve(ROOT, 'scripts/control-plane/feedback-panel.js'), 'utf8');
  for (const [name, src] of [['feedback-widget.mjs', widget], ['feedback-panel.js', panel]]) {
    assert.doesNotMatch(src, /'phone'/, `${name} never sends a phone device`);
  }
  assert.match(widget, /const PHONE_QUERY = '\(max-width: 40rem\)'/, 'same breakpoint as the web widget');
  assert.match(widget, /device: deviceOf\(\)/);
  assert.match(panel, /var PHONE_MAX = 640;/, '40rem in pixels, the frame width the panel reads');
  const deviceOf = new Function(`${/var PHONE_MAX = \d+;/.exec(panel)[0]} ${/function deviceOf\(width\) \{[^\n]*\}/.exec(panel)[0]} return deviceOf;`)();
  assert.deepEqual([390, 640, 641, 1023, 1024, 1440].map(deviceOf), [null, null, 'tablet', 'tablet', 'desktop', 'desktop']);
});
