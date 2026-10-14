import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHopModel, hopEntries, normRecord, sourceOf, detailFields } from '../scripts/lib/hops.mjs';
import { createHopPages } from '../scripts/lib/hop-pages.mjs';
import { loadSiteCopy } from '../scripts/lib/site-copy.mjs';
import { matchKey } from '../scripts/lib/winner-profiles.mjs';
import { applyFilters, FILTERS, optionList } from '../site/assets/filter-bar.mjs';
import { hopSlug } from '../site/assets/hop-links.mjs';
import { medalTable } from '../site/assets/page-views.mjs';
import { beerCardHtml, beerCardsHtml } from '../site/assets/profile-cards.mjs';
import { excerpt } from '../scripts/lib/hops.mjs';

// Small fixtures stand in for the reference tables and winner profiles.
const rec = (o) => normRecord(o);
const reference = {
  varieties: [
    rec({ canonical_variety: 'Citra', aliases: 'Citra BRS-1;HBC 394', breeder: 'Hop Breeding Company', origin_country: 'United States', aroma_descriptors: 'citrus;tropical fruit', aroma_source: 'https://example.org/aroma' }),
    rec({ canonical_variety: 'Mosaic', aliases: 'HBC 369', origin_country: 'United States' }),
  ],
  acreage: [rec({ variety: 'Citra', state: 'WA', year: '2025', acres: '4000', production: '9000000', source: 'https://example.org/acreage' })],
  farms: [rec({ farm: 'Alpha Ranch', state: 'WA' }), rec({ farm: 'Beta Farm', state: 'OR', aliases: 'Beta Hop Farm' })],
  farmVarieties: [
    rec({ farm: 'Alpha Ranch', variety: 'Citra BRS-1', year: '2025', source: 'https://example.org/f1' }),
    rec({ farm: 'Alpha Ranch', variety: 'Mosaic', year: '2025', source: 'https://example.org/f2' }),
    rec({ farm: 'Beta Farm', variety: 'HBC 369', year: '2025', source: 'https://example.org/f3' }),
  ],
};

const profile = (stem, fm) => ({ year: 2026, stem, fm: { category: 'x', 'category-name': 'American IPA', brewery: 'Brew Co', ...fm }, body: '', key: matchKey(fm.beer, fm.medal, 'American IPA') });
const profiles = [
  profile('001-a', { beer: 'Beer A', medal: 'Gold', hops: ['Citra'], 'hop-profile': [{ published: 'Citra BRS-1', variety: 'Citra', form: 'pellet', use: 'dry hop', 'lot-or-farm': 'Beta Hop Farm', source: 'https://example.org/b' }], description: { value: 'A hazy beer.', source: 'https://example.org/d' } }),
  profile('001-b', { beer: 'Beer B', medal: 'Silver', hops: ['HBC 369'] }),
  profile('001-c', { beer: 'Beer C', medal: 'Bronze', hops: ['Citra', 'Mosaic'], 'hop-profile': [{ published: 'Citra®', variety: 'Citra' }, { published: 'Mosaic', variety: 'Mosaic', 'lot-or-farm': 'Lot 42' }] }),
];
const rows = () => profiles.map((p) => ({ year: 2026, competition: 'GABF', beer_name: p.fm.beer, medal: p.fm.medal, category_name: 'American IPA', category_slug: 'american-ipa', brewery_key: 'brew', brewery_slug: 'brew-co', brewery_name: 'Brew Co', city: 'Denver', state: 'CO', partial: false }));
const model = (r = rows()) => buildHopModel({ profiles, rows: r, reference });

test('a beer joins its hop profile entry to the canonical variety through the alias map', () => {
  const m = model();
  const a = m.beers.get('001-a');
  assert.equal(a.usage.length, 1);
  assert.equal(a.usage[0].published, 'Citra BRS-1');
  assert.equal(a.usage[0].canonical, 'Citra');
  // A name only in `hops` is resolved by alias too, and a beer that lists the same variety twice counts once.
  assert.deepEqual(m.beers.get('001-b').usage.map((u) => u.canonical), ['Mosaic']);
  assert.deepEqual(m.beers.get('001-c').usage.map((u) => u.canonical).sort(), ['Citra', 'Mosaic']);
  assert.equal(m.varieties.length, 2);
});

test('the grown by link reaches farms through the variety only', () => {
  const m = model();
  const citra = m.varietyBySlug.get('citra');
  assert.deepEqual([...citra.farms.values()].map((x) => x.farm.name), ['Alpha Ranch']);
  const mosaic = m.varietyBySlug.get('mosaic');
  assert.deepEqual([...mosaic.farms.values()].map((x) => x.farm.name).sort(), ['Alpha Ranch', 'Beta Farm']);
  assert.deepEqual([...m.farmBySlug.get('alpha-ranch').grown.keys()].sort(), ['001-a', '001-b', '001-c']);
  assert.deepEqual([...m.farmBySlug.get('beta-farm').grown.keys()].sort(), ['001-b', '001-c']);
});

test('a farm the brewery named is a direct link and is never read as grown by', () => {
  const m = model();
  const beta = m.farmBySlug.get('beta-farm');
  assert.deepEqual([...beta.named.keys()], ['001-a']);
  // Beta Farm does not publish Citra, so Beer A is named by Beta but not grown by Beta.
  assert.equal(beta.grown.has('001-a'), false);
  // Alpha Ranch grows Citra, so Beer A is grown by Alpha but not named by Alpha.
  assert.equal(m.farmBySlug.get('alpha-ranch').named.has('001-a'), false);
  // A lot that matches no known farm is text only: no farm link is guessed.
  assert.equal(m.beers.get('001-c').usage.find((u) => u.canonical === 'Mosaic').farm, null);
});

test('rendered pages keep the two farm link kinds in separate, labelled tables', () => {
  const m = model();
  const out = new Map();
  const COPY = loadSiteCopy();
  const pages = createHopPages({ model: m, ds: { stateByCode: {} }, layout: ({ body }) => body, write: (p, html) => out.set(p, html), COPY, renderMarkdownBody: (b) => b, registerDocs: () => {}, notDefined: 'Not defined', year: 2026 });
  pages.writeAll();
  const beta = out.get('hop-farms/beta-farm/index.html');
  const [named, grown] = beta.split(COPY('pages.hop-farm-detail.grown.title', { year: 2026 }));
  assert.match(named, /beers\/2026\/001-a\//, 'the named table lists Beer A');
  assert.ok(!/beers\/2026\/001-a\//.test(grown), 'the grown table never lists a beer only named by the farm');
  assert.ok(grown.includes('beers/2026/001-b/'));
  const alpha = out.get('hop-farms/alpha-ranch/index.html');
  const [aNamed, aGrown] = alpha.split(COPY('pages.hop-farm-detail.grown.title', { year: 2026 }));
  assert.ok(!/beers\/2026\/001-a\//.test(aNamed), 'a grown by farm is not shown as named');
  assert.match(aNamed, new RegExp(COPY('pages.hop-farm-detail.named.missing', { year: 2026 })));
  assert.match(aGrown, /beers\/2026\/001-a\//);
  // The beer page labels the direct farm link and keeps the grown by farms apart.
  const html = pages.beerHopHtml(m.beers.get('001-a'), { r: '../../../' });
  assert.match(html, new RegExp(`${COPY('pages.beer-detail.hop_profile.named_label')}`));
  assert.match(html, /hop-farms\/beta-farm\//);
  assert.match(html, /<details[\s\S]*hop-farms\/alpha-ranch\//);
  // Beer C names no known farm: the lot shows as text and the named label is absent.
  const c = pages.beerHopHtml(m.beers.get('001-c'), { r: '../../../' });
  assert.match(c, /Lot 42/);
  assert.ok(!c.includes(COPY('pages.beer-detail.hop_profile.named_label')));
});

test('every variety page lists every beer that uses it', () => {
  const m = model();
  const out = new Map();
  const COPY = loadSiteCopy();
  createHopPages({ model: m, ds: { stateByCode: {} }, layout: ({ body }) => body, write: (p, html) => out.set(p, html), COPY, renderMarkdownBody: (b) => b, registerDocs: () => {}, notDefined: 'Not defined', year: 2026 }).writeAll();
  for (const v of m.varieties) {
    const html = out.get(`hops/${v.slug}/index.html`);
    const expected = [...m.beers.values()].filter((b) => b.usage.some((u) => u.variety === v));
    assert.ok(expected.length > 0);
    for (const b of expected) assert.ok(html.includes(`beers/2026/${b.stem}/`), `${v.name} lists ${b.stem}`);
  }
  assert.ok(out.has('hops/index.html') && out.has('hop-farms/index.html'));
  assert.match(out.get('hops/citra/index.html'), /citrus/);
  assert.match(out.get('hops/citra/index.html'), /example\.org\/aroma/);
});

test('the hop filters narrow the medal rows and offer only options that match', () => {
  const r = rows();
  model(r);
  assert.deepEqual(applyFilters(r, { hop_variety: 'Citra' }).map((x) => x.beer_name), ['Beer A', 'Beer C']);
  assert.deepEqual(applyFilters(r, { hop_variety: 'Mosaic', medal: 'Silver' }).map((x) => x.beer_name), ['Beer B']);
  assert.deepEqual(applyFilters(r, { hop_farm_named: 'Beta Farm' }).map((x) => x.beer_name), ['Beer A']);
  assert.deepEqual(applyFilters(r, { hop_farm_grown: 'Beta Farm' }).map((x) => x.beer_name), ['Beer B', 'Beer C']);
  assert.deepEqual(optionList(r, 'hop_variety', {}).map((o) => [o.value, o.count]), [['Citra', 2], ['Mosaic', 2]]);
  assert.deepEqual(optionList(r, 'hop_variety', { hop_farm_named: 'Beta Farm' }).map((o) => o.value), ['Citra']);
  for (const s of [{}, { hop_variety: 'Mosaic' }, { medal: 'Gold' }]) {
    for (const def of FILTERS.filter((d) => d.multi)) {
      for (const o of optionList(r, def.id, s)) assert.equal(applyFilters(r, { ...s, [def.id]: o.value }).length, o.count, `${def.id}=${o.value}`);
    }
  }
});

test('rows without hops offer only Not defined in the hop filters, and the beer rows carry arrays', () => {
  const r = rows();
  model(r);
  assert.deepEqual(r[0].hop_varieties, ['Citra']);
  assert.deepEqual(r[0].hop_farms_named, ['Beta Farm']);
  assert.deepEqual(r[0].hop_farms_grown, ['Alpha Ranch']);
  assert.deepEqual(optionList([{ year: 2025, medal: 'Gold' }], 'hop_variety', {}).map((o) => [o.value, o.label, o.count]), [['not-defined', 'Not defined', 1]]);
});

test('the Hops column of a medal table links each variety and is dropped when no row has hops', () => {
  const r = rows();
  model(r);
  const withHops = medalTable(r, { r: '../', showBrewery: true });
  assert.match(withHops, /href="..\/hops\/citra\/"/);
  const none = medalTable([{ year: 2025, medal: 'Gold', beer_name: 'Old', brewery_slug: 'x', brewery_name: 'X', city: 'A', state: 'B', category_name: 'C', category_slug: 'c' }], { r: '../', compact: true });
  assert.ok(!/>Hops</.test(none));
});

test('profile helpers read hop entries, sources, and detail fields', () => {
  assert.deepEqual(hopEntries({ hops: ['Cascade'] }).map((e) => e.variety), ['Cascade']);
  assert.equal(hopEntries({ 'hop-profile': [{ published: 'X', variety: 'Cascade' }], hops: ['Cascade'] }).length, 1);
  assert.deepEqual(sourceOf('https://www.example.org/page'), { label: 'example.org', url: 'https://www.example.org/page' });
  assert.deepEqual(sourceOf('Brewery label'), { label: 'Brewery label', url: null });
  const d = detailFields({ description: 'Text', 'description-source': 'https://example.org/s', 'tasting-notes': { value: 'Citrus', source: 'https://example.org/t' }, og: 1.05 });
  assert.deepEqual(d.map((x) => [x.key, x.value, Boolean(x.source)]), [['description', 'Text', true], ['tasting-notes', 'Citrus', true], ['og', '1.05', false]]);
  assert.equal(hopSlug('Hallertau Mittelfrüh'), 'hallertau-mittelfruh');
});

test('a beer profile card carries the fields, linked hop chips, a sourced tasting excerpt, and the deep dive link', () => {
  const r = rows();
  profiles[0].fm['tasting-notes'] = { value: 'Hazy and bright. '.repeat(30), source: 'https://example.org/t' };
  profiles[0].fm.style = 'Hazy IPA';
  model(r);
  Object.assign(r[0], { beer_profile: 'beers/2026/001-a/', abv: 6.5, ibu: 40 });
  const card = beerCardHtml(r[0], { r: '../' });
  assert.match(card, /Beer A/);
  assert.match(card, /href="..\/hops\/citra\/"/);
  assert.match(card, /6\.5%/);
  assert.match(card, /Hazy IPA/);
  assert.match(card, /example\.org/);
  assert.match(card, /href="..\/beers\/2026\/001-a\/"/);
  assert.ok(r[0].tasting_note.length <= 181 && r[0].tasting_note.endsWith('…'));
  // A beer with no tasting note says so instead of inventing one.
  Object.assign(r[1], { beer_profile: 'beers/2026/001-b/' });
  assert.match(beerCardHtml(r[1], { r: '../' }), /Not defined/);
  assert.equal(beerCardsHtml([{ year: 2025 }], { r: '../' }), '');
  assert.equal(excerpt('short'), 'short');
  delete profiles[0].fm['tasting-notes'];
  delete profiles[0].fm.style;
});

test('the hops index, variety, farm and beer pages draw profile cards', () => {
  const r = rows();
  const m = model(r);
  r.forEach((x, i) => { x.beer_profile = `beers/2026/${profiles[i].stem}/`; });
  const out = new Map();
  const COPY = loadSiteCopy();
  const pages = createHopPages({ model: m, ds: { stateByCode: {} }, layout: ({ body }) => body, write: (p, html) => out.set(p, html), COPY, renderMarkdownBody: (b) => b, registerDocs: () => {}, notDefined: 'Not defined', year: 2026, meta: null });
  pages.writeAll();
  assert.match(out.get('hops/index.html'), /hop-profile-card/);
  assert.match(out.get('hops/citra/index.html'), /beer-profile-card/);
  assert.match(out.get('hop-farms/alpha-ranch/index.html'), /hop-profile-card[\s\S]*beer-profile-card/);
  assert.match(pages.beerHopHtml(m.beers.get('001-a'), { r: '../../../' }), /hop-profile-card/);
});
