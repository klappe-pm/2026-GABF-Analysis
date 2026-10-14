// The copy-key marking the in place editor reads, and the map from page regions to design system components.

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from '../scripts/lib/paths.mjs';
import { CLOSE, mark, OPEN, parse, SEP, strip, wholeKey } from '../web/review/markers.mjs';
import { COMPONENT_MAP } from '../web/review/component-map.mjs';

test('a marked string reads back as its text and its key', () => {
  const text = mark('global.site.header.skip_link', 'Skip to content');
  assert.equal(strip(text), 'Skip to content');
  assert.equal(wholeKey(text), 'global.site.header.skip_link');
  assert.deepEqual(parse(text).segments, [{ key: 'global.site.header.skip_link', text: 'Skip to content', start: 0, end: 15 }]);
});

test('unmarked text has no key and is returned as it is', () => {
  assert.equal(strip('Plain words'), 'Plain words');
  assert.equal(wholeKey('Plain words'), null);
});

test('text built from several entries is not one line of copy', () => {
  const text = `${mark('a.one', 'First')} and ${mark('a.two', 'second')}`;
  assert.equal(strip(text), 'First and second');
  assert.equal(wholeKey(text), null);
  assert.equal(parse(text).segments.length, 2);
});

test('an entry with words around it is not one line of copy', () => {
  assert.equal(wholeKey(`Open ${mark('a.one', 'the explorer')} now`), null);
});

test('a mark split across text nodes by markup is removed and flagged', () => {
  const start = `${OPEN}global.site.footer.beer_details${SEP}Some beer details are from `;
  const end = `Catalog.beer${CLOSE}`;
  const a = parse(start);
  const b = parse(end);
  assert.equal(a.plain, 'Some beer details are from ');
  assert.equal(b.plain, 'Catalog.beer');
  assert.ok(a.dangling && b.dangling);
  assert.equal(wholeKey(start), null);
  for (const s of [OPEN, SEP, CLOSE]) assert.ok(!a.plain.includes(s) && !b.plain.includes(s));
});

test('every component in the map is a design system component', () => {
  const dir = resolve(ROOT, '.design/design-system/components');
  assert.ok(COMPONENT_MAP.length > 10);
  for (const e of COMPONENT_MAP) {
    assert.ok(existsSync(resolve(dir, e.component)), `${e.component} has no folder under ${dir}`);
    assert.ok(e.selector.trim().length > 0);
  }
});

test('the copy lookup marks only when the review build asks, and the public build never does', () => {
  const source = readFileSync(resolve(ROOT, 'web/lib/content.ts'), 'utf8');
  // The marking is the foundation's to add; when it is there it must be gated on WEB_REVIEW.
  if (source.includes('0x2062')) assert.match(source, /process\.env\.WEB_REVIEW === '1'/);
});
