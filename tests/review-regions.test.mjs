// The journey step markers: every screen names the region of the framed page it concerns, or is
// about the whole page and names none, and every action chip in the spec names the control it
// acts on. The marker is drawn by the review build only; tests/web-review-build.test.mjs proves the
// public build carries none of it.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from '../scripts/lib/paths.mjs';
import { regionsPayload } from '../scripts/lib/review-screens.mjs';

const manifest = JSON.parse(readFileSync(resolve(ROOT, 'docs/design/design-nodes.json'), 'utf8'));
const spec = readFileSync(resolve(ROOT, 'docs/design/interaction-spec.md'), 'utf8');
const screens = Object.entries(manifest.nodes).filter(([id]) => id.startsWith('screen:'));

test('every screen has a region with a selector and a name, or is a whole page step with none, or says why the web app has no page for it', () => {
  assert.equal(screens.length, 51);
  for (const [id, node] of screens) {
    const region = node.state.region;
    if (node.state.unported) {
      assert.equal(region, null, `${id} has no page on the web app, so it marks no region`);
      assert.ok(node.state.unported.length > 20 && !/ - /.test(node.state.unported), `${id}: the reason is plain words`);
      continue;
    }
    if (region === undefined) {
      assert.equal(node.state.frame, 'phone', `${id} has no region but is not a phone width step`);
      continue;
    }
    assert.equal(typeof region.selector, 'string', id);
    assert.ok(region.selector.length > 0, id);
    assert.ok(region.name && !/-/.test(region.name), `${id}: the label is plain words`);
  }
});

test('screens that state a condition mark the part of the page that shows it', () => {
  const sel = (id) => manifest.nodes[`screen:${id}`].state.region?.selector ?? '';
  assert.match(sel('S-03'), /empty/);
  assert.match(sel('S-05'), /error/);
  assert.match(sel('S-16'), /popover/);
  assert.match(sel('S-46'), /filters-dialog/);
  assert.match(sel('S-02'), /filter-chips/);
});

test('every action chip in the interaction spec names the control it acts on, except the whole page ones', () => {
  const labels = new Set();
  for (const line of spec.split('\n').filter((l) => l.startsWith('Actions:'))) {
    for (const label of line.replace(/^Actions:\s*/, '').replace(/\.$/, '').split(',')) labels.add(label.trim());
  }
  labels.delete('view on a phone');
  const { controls } = regionsPayload(manifest);
  const missing = [...labels].filter((l) => !controls[l]);
  assert.deepEqual(missing, []);
  // A control with no web equivalent says why, and marks nothing.
  for (const [label, c] of Object.entries(controls)) assert.ok(c.name && (c.selector || c.unported), label);
});

test('the payload the page reads has one entry per screen, null for a whole page step', () => {
  const payload = regionsPayload(manifest);
  assert.equal(Object.keys(payload.screens).length, 51);
  assert.equal(payload.screens['S-07'], null);
  assert.equal(payload.screens['S-01'].name, 'headline figures');
});
