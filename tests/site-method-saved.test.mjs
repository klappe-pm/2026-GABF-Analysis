import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from '../scripts/lib/paths.mjs';
import { methodModel } from '../web/lib/models/method.mjs';
import { addView, canStore, cleanView, deleteView, filterCount, isSitePath, MAX_NAME, readViews, renameView, STORAGE_KEY, viewLink } from '../web/lib/saved-views-model.mjs';

// A Storage stand in: a map, or one whose reads or writes throw like a browser that blocks site data.
function memory({ readThrows = false, writeThrows = false } = {}) {
  const map = new Map();
  return {
    map,
    getItem(k) { if (readThrows) throw new Error('blocked'); return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { if (writeThrows) throw new Error('blocked'); map.set(k, String(v)); },
    removeItem(k) { map.delete(k); },
  };
}

const view = { name: 'Hazy IPA in Colorado', path: '/beers/2026/', hash: '#state=CO&q=hazy', title: '2026 winning beers' };

test('a view is added, renamed, and deleted, newest first', () => {
  const s = memory();
  assert.deepEqual(readViews(s), { blocked: false, views: [] });
  const a = addView(s, view, new Date('2026-10-01T12:00:00Z'));
  const b = addView(s, { ...view, name: 'Second' });
  assert.ok(a.ok && b.ok);
  assert.deepEqual(readViews(s).views.map((v) => v.name), ['Second', 'Hazy IPA in Colorado']);
  assert.ok(renameView(s, a.view.id, '  New   name ').ok);
  assert.equal(readViews(s).views[1].name, 'New name');
  assert.ok(!renameView(s, a.view.id, '   ').ok, 'an empty name is refused');
  assert.ok(deleteView(s, a.view.id).ok);
  assert.deepEqual(readViews(s).views.map((v) => v.name), ['Second']);
});

test('a name is trimmed and capped, and an empty one is not saved', () => {
  const s = memory();
  assert.ok(!addView(s, { ...view, name: '   ' }).ok);
  const long = addView(s, { ...view, name: 'x'.repeat(MAX_NAME + 40) });
  assert.equal(long.view.name.length, MAX_NAME);
});

test('blocked storage never throws and reports itself', () => {
  assert.deepEqual(readViews(null), { blocked: true, views: [] });
  assert.ok(!addView(null, view).ok);
  const noWrite = memory({ writeThrows: true });
  assert.ok(!canStore(noWrite));
  assert.ok(!addView(noWrite, view).ok);
  assert.ok(!deleteView(noWrite, 'x').ok);
  const noRead = memory({ readThrows: true, writeThrows: true });
  assert.equal(readViews(noRead).blocked, true);
});

test('damaged storage reads as no views', () => {
  const s = memory();
  s.map.set(STORAGE_KEY, '{not json');
  assert.deepEqual(readViews(s), { blocked: false, views: [] });
  s.map.set(STORAGE_KEY, JSON.stringify([{ id: '1', name: 'ok', path: '/a/', hash: '' }, { id: '2', name: 'bad', path: 'https://evil.example/', hash: '' }, null, 7]));
  assert.deepEqual(readViews(s).views.map((v) => v.id), ['1']);
});

test('only an address inside the site is a view path', () => {
  for (const ok of ['/', '/beers/2026/', '/breweries/green-cheek/']) assert.ok(isSitePath(ok), ok);
  for (const bad of ['//evil.example/', 'https://evil.example/', 'javascript:alert(1)', '/\\evil', '', '/a b/', null]) assert.ok(!isSitePath(bad), String(bad));
  assert.equal(cleanView({ id: '1', name: 'x', path: '/a/', hash: 'no-hash-mark' }), null);
});

test('filters are counted from the hash, page keys are not filters', () => {
  assert.equal(filterCount(''), 0);
  assert.equal(filterCount('#state=CO&q=hazy'), 2);
  assert.equal(filterCount('#tab=map&medal=Gold'), 1);
});

test('a link carries the origin, the base path, the page, and the filters', () => {
  assert.equal(viewLink({ path: '/beers/2026/', hash: '#medal=Gold' }, 'https://gabf.beer'), 'https://gabf.beer/beers/2026/#medal=Gold');
  assert.equal(viewLink({ path: '/a/', hash: '' }, 'https://x.github.io', '/GABF'), 'https://x.github.io/GABF/a/');
});

test('the method model fills every value from the dataset and the estimation parameters', () => {
  const { coverage, values } = methodModel();
  const params = JSON.parse(readFileSync(resolve(ROOT, 'data/reference/estimation-parameters.json'), 'utf8'));
  assert.ok(coverage.length >= 5);
  assert.ok(values.first_year < values.last_year);
  assert.match(values.complete_range, /^\d{4} to \d{4}$/);
  assert.ok(values.data_year <= values.latest_year);
  assert.equal(values.direct_revenue_per_barrel, `$${params.revenue_per_barrel_by_brewery_type.taproom.toLocaleString('en-US')}`);
  const [lo, hi] = params.ebitda_margin_range_by_channel.taproom;
  assert.equal(values.taproom_margin_range, `${Math.round(lo * 100)} to ${Math.round(hi * 100)} percent`);
  for (const row of coverage) for (const s of row.sources) assert.doesNotMatch(s, /\.(pdf|csv)\b/, 'a file name is not a source');
});
