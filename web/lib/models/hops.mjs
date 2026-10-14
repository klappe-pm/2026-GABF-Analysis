// The hops lane's build time data: hop varieties, hop farms, and the hop profile of a beer, sliced out of
// the hop model the Node pipeline builds (scripts/lib/hops.mjs, reached through site() in ../site-model.mjs).
// Nothing here forks that model. It turns its Maps and class-like records into the plain, serializable
// records the pages draw, and leaves every visible word to the pages, which read the copy documents.
//
// Two kinds of farm link stay apart everywhere, as in the model: "named" (the brewery published this farm
// for this hop) and "grown" (the variety is published as grown at this farm). No record merges them.

import { humanize } from '../../../site/assets/charts.mjs';
import { valueLabel } from '../../../site/assets/filter-bar.mjs';
import { byMedalThenBeer } from '../../../scripts/lib/hops.mjs';
import { beer as siteBeer, notesHtml, site, WINNER_YEAR, winners } from '../site-model.mjs';

const collator = new Intl.Collator('en', { sensitivity: 'base' });
const byText = (a, b) => collator.compare(a, b);
const uniq = (list) => [...new Set(list.filter(Boolean))];
const num = (v) => {
  const n = Number(String(v ?? '').replace(/,/g, ''));
  return String(v ?? '').trim() !== '' && Number.isFinite(n) ? n : null;
};
const host = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };

// ---------- sources ----------
// A source is { label, url } for a link and { label, url: null } for plain text. A cell that holds several
// links joined by "|" becomes one source per link.
const sourcesOf = (s) => {
  if (!s) return [];
  if (s.url && /\s*\|\s*/.test(s.url)) return s.url.split(/\s*\|\s*/).filter(Boolean).map((u) => ({ label: host(u), url: u }));
  return [{ label: s.label, url: s.url ?? null }];
};
const sourceList = (list) => {
  const seen = new Set();
  return list.flatMap(sourcesOf).filter((s) => !seen.has(`${s.label}|${s.url}`) && seen.add(`${s.label}|${s.url}`));
};

// The labeled source cells of a record, one row per label with every source under it.
function sourceRowsOf(list) {
  const rows = new Map();
  for (const s of list) {
    const key = label(s.label);
    rows.set(key, [...(rows.get(key) ?? []), ...sourcesOf(s.source)]);
  }
  return [...rows].map(([name, sources]) => ({ label: name, sources: sourceList(sources.map((x) => ({ label: x.label, url: x.url }))) }));
}

const stateName = (code) => (code ? site().ds.stateByCode?.[code]?.name ?? code : '');
// A recorded column name as a label: "year note" reads Year Note. Small joining words stay lower case.
const SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to']);
const titleCase = (text) => text.split(' ').map((w, i) => (!w ? w : i > 0 && SMALL.has(w.toLowerCase()) ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1))).join(' ');
const label = (key) => titleCase(humanize(String(key).replace(/_/g, '-')));
const word = (v) => valueLabel('hop_value', v);

// A reference table cell: text, or the sources it names when the column holds links.
const readable = (v) => String(v ?? '').replace(/\s*See [\w-]+\.csv\.?/g, '').trim();
const cellOf = (key, raw) => {
  const v = readable(raw);
  if (!v) return null;
  if (/^source/.test(key) || /^https?:/.test(v)) {
    const sources = v.split(/\s*[;|]\s*/).filter(Boolean).map((x) => (/^https?:\/\//.test(x) ? { label: host(x), url: x } : { label: x, url: null }));
    return { sources };
  }
  return { text: v };
};

// ---------- beers ----------
// The winners list of the year by beer, so a beer listed on a hop page carries the fields the global filter reads.
const winnerByStem = new Map();
const winnerFor = (stem) => {
  if (!winnerByStem.size) for (const r of winners(WINNER_YEAR)) if (r.stem) winnerByStem.set(r.stem, r);
  return winnerByStem.get(stem) ?? null;
};
// What a beer profile card draws: the beer's record without its research notes.
const cardRecords = new Map();
const beerCardRecord = (stem) => {
  if (!cardRecords.has(stem)) {
    const { notesHtml: _notes, ...record } = siteBeer(stem);
    cardRecords.set(stem, record);
  }
  return cardRecords.get(stem);
};
const beerRef = (b) => ({
  stem: b.stem,
  year: b.year,
  beer: b.beer,
  medal: b.medal,
  brewery: b.brewery,
  brewerySlug: b.brewery_slug,
  category: b.category,
  categorySlug: b.category_slug,
  filter: winnerFor(b.stem),
  card: beerCardRecord(b.stem),
});
const varietyLink = (v) => ({ name: v.name, slug: v.slug });
const farmLink = (f) => ({ name: f.name, slug: f.slug, state: stateName(f.state) });
const farmsOf = (v) => [...v.farms.values()].map((x) => x.farm).sort((a, b) => byText(a.name, b.name));

// ---------- the hop card ----------
const trait = (v, key) => num(v.traits.find((t) => t.key === key)?.value);
const range = (v, base) => {
  const min = trait(v, `${base}_min`);
  const max = trait(v, `${base}_max`);
  return min !== null && max !== null ? { min, max } : null;
};
function latestAcreage(v) {
  const rows = v.acreage.filter((a) => num(a.acres) !== null && num(a.acres) > 0 && num(a.year) !== null);
  if (!rows.length) return null;
  const year = Math.max(...rows.map((a) => num(a.year)));
  const there = rows.filter((a) => num(a.year) === year);
  return { acres: there.reduce((s, a) => s + num(a.acres), 0), year, states: there.length };
}

// What a hop profile card draws, for a variety.
function cardOf(v) {
  const aromaSources = sourceList(v.aroma.map((a) => a.source).filter(Boolean));
  return {
    slug: v.slug,
    name: v.name,
    origin: v.origin || null,
    breeder: v.breeder || null,
    alpha: range(v, 'alpha'),
    oil: range(v, 'total_oil'),
    aroma: v.aroma.length ? { descriptors: v.aroma.map((a) => a.descriptor), source: aromaSources[0] ?? null } : null,
    acreage: latestAcreage(v),
    beers: v.counts.beers,
    farms: farmsOf(v).map(farmLink),
  };
}

// ---------- the hops index ----------
export function hopsIndex() {
  const { ds } = site();
  const model = ds.hops;
  const varieties = model.varieties
    .map((v) => ({
      slug: v.slug,
      name: v.name,
      origin: v.origin || null,
      beers: v.counts.beers,
      medals: v.counts.medals,
      gold: v.counts.gold,
      silver: v.counts.silver,
      bronze: v.counts.bronze,
      farms: v.counts.farms,
      card: cardOf(v),
    }))
    .sort((a, b) => b.medals - a.medals || byText(a.name, b.name));
  return {
    year: WINNER_YEAR,
    varieties,
    used: varieties.filter((v) => v.medals > 0).length,
    farmCount: model.farms.length,
  };
}

// The breweries behind a list of beers, with how many of the beers each has, most first.
function breweriesOf(beers, extra = {}) {
  const per = new Map();
  for (const b of beers) {
    const slot = per.get(b.brewery_slug) ?? { brewery: b.brewery, brewerySlug: b.brewery_slug, count: 0, ...extra };
    slot.count += 1;
    per.set(b.brewery_slug, slot);
  }
  return [...per.values()].sort((a, b) => b.count - a.count || byText(a.brewery, b.brewery));
}

// ---------- one variety ----------
function acreageOf(v) {
  const rows = [...v.acreage]
    .sort((a, b) => num(b.year) - num(a.year) || byText(stateName(a.state), stateName(b.state)))
    .map((a) => ({ state: stateName(a.state) || null, year: num(a.year), acres: num(a.acres), production: num(a.production), source: sourcesOf(a.source) }));
  // One line per state over the years any state reports. A year a state does not report stays null, a gap in its line.
  const reported = rows.filter((a) => a.state && a.year !== null && a.acres !== null);
  const years = [...new Set(reported.map((a) => a.year))].sort((x, y) => x - y);
  const states = [...new Set(reported.map((a) => a.state))].sort(byText);
  const series = states.map((state) => ({ state, values: years.map((y) => reported.find((a) => a.state === state && a.year === y)?.acres ?? null) }));
  return { rows, trend: { years, series } };
}

function varietyBeers(v) {
  return [...v.usages.values()]
    .sort((a, b) => byMedalThenBeer(a.beer, b.beer))
    .map((x) => {
      const named = x.entries.filter((e) => e.farm);
      return {
        ...beerRef(x.beer),
        forms: uniq(x.entries.map((e) => e.form)).map(word),
        uses: uniq(x.entries.map((e) => e.use)).map(word),
        farms: [...new Map(named.map((e) => [e.farm.slug, farmLink(e.farm)])).values()],
        otherFarms: uniq(x.entries.filter((e) => !e.farm).map((e) => e.lotOrFarm)),
      };
    });
}

// The recorded traits of a variety as label and value rows. A minimum and maximum of one measure read as
// one range row, and the slug the page address comes from is not a trait a reader needs.
function traitRows(v) {
  const byKey = new Map(v.traits.map((t) => [t.key, t.value]));
  const rows = [];
  for (const t of v.traits) {
    if (t.key === 'slug') continue;
    const min = t.key.match(/^(.+)_min$/);
    if (min && byKey.has(`${min[1]}_max`)) {
      rows.push({ key: min[1], label: label(min[1]), value: t.value, max: byKey.get(`${min[1]}_max`) });
      continue;
    }
    const max = t.key.match(/^(.+)_max$/);
    if (max && byKey.has(`${max[1]}_min`)) continue;
    rows.push({ key: t.key, label: label(t.key), value: t.value });
  }
  return rows;
}

export function hop(slug) {
  const v = site().ds.hops.varietyBySlug.get(slug);
  if (!v) return null;
  const grown = [...v.farms.values()].sort((a, b) => byText(a.farm.name, b.farm.name));
  return {
    ...cardOf(v),
    aliases: v.aliases,
    data: traitRows(v),
    sourceRows: sourceRowsOf(v.sources),
    aromaRows: v.aroma.map((a) => ({ descriptor: a.descriptor, source: sourcesOf(a.source) })),
    acreageByState: acreageOf(v),
    counts: v.counts,
    beerRows: varietyBeers(v),
    breweries: breweriesOf([...v.usages.values()].map((x) => x.beer)),
    farmRows: grown.map((x) => ({
      ...farmLink(x.farm),
      published: [...x.entry.published],
      years: [...x.entry.years].sort(),
      sources: sourceList(x.entry.sources),
    })),
    notesHtml: v.doc?.body?.trim() ? notesHtml(v.doc.body) : null,
  };
}

// ---------- the hop farms index ----------
const merchantCell = (m, key) => cellOf(key, m[key]);
const MERCHANT_COLS = ['name', 'type', 'location', 'ownership', 'processing', 'proprietary_varieties', 'notes', 'source_url', 'verified'];
function merchantTable(list) {
  const columns = MERCHANT_COLS.filter((k) => list.some((m) => readable(m[k])));
  return { columns: columns.map((k) => ({ key: k, label: label(k) })), rows: list.map((m) => Object.fromEntries(columns.map((k) => [k, merchantCell(m, k)]))) };
}

export function hopFarmsIndex() {
  const { ds } = site();
  const model = ds.hops;
  const groups = new Map();
  for (const f of model.farms) {
    const k = f.state || '';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(f);
  }
  const states = [...groups.entries()]
    .sort((a, b) => (a[0] ? 0 : 1) - (b[0] ? 0 : 1) || byText(stateName(a[0]), stateName(b[0])))
    .map(([code, list]) => ({
      code,
      name: code ? stateName(code) : null,
      farms: list.map((f) => ({ slug: f.slug, name: f.name, varieties: f.counts.varieties, grown: f.counts.grown, named: f.counts.named })),
    }));
  const gapKeys = ['topic', 'kind', 'finding', 'sources_checked'];
  return {
    year: WINNER_YEAR,
    farmCount: model.farms.length,
    states,
    merchants: model.merchants.length ? merchantTable(model.merchants) : null,
    gaps: model.gaps.length
      ? { columns: gapKeys.map((k) => ({ key: k, label: label(k) })), rows: model.gaps.map((g) => Object.fromEntries(gapKeys.map((k) => [k, cellOf(k, g[k])]))) }
      : null,
  };
}

// ---------- one farm ----------
export function hopFarm(slug) {
  const f = site().ds.hops.farmBySlug.get(slug);
  if (!f) return null;
  const { ds } = site();
  const varieties = [...f.varieties.values()].sort((a, b) => byText(a.variety.name, b.variety.name));
  const named = [...f.named.values()].sort((a, b) => byMedalThenBeer(a.beer, b.beer));
  const grown = [...f.grown.values()].sort((a, b) => byMedalThenBeer(a.beer, b.beer));
  return {
    slug: f.slug,
    name: f.name,
    state: f.state ? stateName(f.state) : null,
    aliases: f.aliases,
    data: f.fields.map((x) => ({ key: x.key, label: label(x.key), value: cellOf(x.key, x.value) ?? { text: x.value } })),
    sourceRows: sourceRowsOf(f.sources),
    counts: f.counts,
    varieties: varieties.map((x) => ({
      slug: x.variety.slug,
      name: x.variety.name,
      published: [...x.published],
      years: [...x.years].sort(),
      medals: x.variety.counts.medals,
      sources: sourceList(x.sources),
      verified: [...x.verified],
      notes: [...x.notes],
    })),
    varietyCards: varieties.map((x) => cardOf(x.variety)),
    named: named.map((x) => ({
      ...beerRef(x.beer),
      hops: uniq(x.entries.map((e) => e.variety.slug)).map((s) => varietyLink(ds.hops.varietyBySlug.get(s))),
      published: uniq(x.entries.map((e) => e.lotOrFarm)),
      sources: sourceList(x.entries.map((e) => e.source).filter(Boolean)),
    })),
    grown: grown.map((x) => ({ ...beerRef(x.beer), hops: [...x.varieties.values()].map(varietyLink) })),
    breweries: [
      ...breweriesOf(named.map((x) => x.beer), { kind: 'named' }),
      ...breweriesOf(grown.map((x) => x.beer), { kind: 'grown' }),
    ],
    merchants: f.merchants.length ? merchantTable(f.merchants) : null,
    notesHtml: f.doc?.body?.trim() ? notesHtml(f.doc.body) : null,
  };
}

// ---------- the hop profile of a beer ----------
export function beerHopProfile(stem) {
  const beer = site().ds.hops.beers.get(stem);
  if (!beer) return null;
  const usage = beer.usage.map((u) => ({
    hop: varietyLink(u.variety),
    published: u.published,
    form: u.form ? word(u.form) : null,
    use: u.use ? word(u.use) : null,
    farm: u.farm ? farmLink(u.farm) : null,
    lotOrFarm: u.farm ? null : u.lotOrFarm || null,
    source: sourcesOf(u.source),
  }));
  const seen = new Set();
  const varieties = beer.usage.map((u) => u.variety).filter((v) => !seen.has(v.slug) && seen.add(v.slug));
  return {
    usage,
    grown: varieties.filter((v) => v.farms.size).map((v) => ({ hop: varietyLink(v), farms: farmsOf(v).map(farmLink) })),
    cards: varieties.map(cardOf),
    details: beer.details.map((d) => ({ key: d.key.replace(/-/g, '_'), value: d.value, source: sourcesOf(d.source) })),
  };
}

// ---------- the winners list ----------
// The winners of a year as the shared model gives them, plus whether the brewery publishes a page for each
// beer, which the summary tiles of the list count.
export function winnerRows(year = WINNER_YEAR) {
  const { profiles } = site();
  return winners(year).map((r) => ({ ...r, beerPage: Boolean(r.stem && profiles.get(r.stem)?.fm?.['beer-url']) }));
}
