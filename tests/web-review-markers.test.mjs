// The copy-key marking the in place editor reads, and the table that gives each route its copy page id.

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from '../scripts/lib/paths.mjs';
import { CLOSE, mark, OPEN, parse, SEP, strip, wholeKey } from '../web/review/markers.mjs';
import { copyPageFor, PAGES } from '../web/review/pages.mjs';

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

test('every route in the page table names a copy page that exists', { skip: !existsSync(resolve(ROOT, '.docs/content-management-system/pages')) && 'the copy folder is not in this checkout' }, () => {
  const dir = resolve(ROOT, '.docs/content-management-system/pages');
  assert.ok(PAGES.length > 15);
  for (const [route, page] of PAGES) assert.ok(existsSync(resolve(dir, `${page}.md`)), `${route} names ${page}, which has no copy file`);
});

test('a route finds its copy page, a detail route finds its detail page, and an unknown route finds none', () => {
  assert.equal(copyPageFor('/'), 'home');
  assert.equal(copyPageFor('/breweries/'), 'breweries-index');
  assert.equal(copyPageFor('/breweries/green-cheek-beer-co/'), 'brewery-detail');
  assert.equal(copyPageFor('/beers/2026/'), 'beers-index');
  assert.equal(copyPageFor('/beers/2026/001-american-wheat-beer-1-wormtown-brewery-summer-ale/'), 'beer-detail');
  assert.equal(copyPageFor('/hop-farms/3d-farm/#x=1'), 'hop-farm-detail');
  assert.equal(copyPageFor('/hops/adeena/'), 'hop-detail');
  assert.equal(copyPageFor('/nowhere/at/all/'), undefined);
});

test('the copy lookup marks only when the review build asks, and the public build never does', () => {
  const source = readFileSync(resolve(ROOT, 'web/lib/content.ts'), 'utf8');
  // The marking is the foundation's to add; when it is there it must be gated on WEB_REVIEW.
  if (source.includes('0x2062')) assert.match(source, /process\.env\.WEB_REVIEW === '1'/);
});
