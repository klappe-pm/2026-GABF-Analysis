// Hops, hop farms, and the 2026 medal beers that use them, joined into one model.
//
// The join, in order: a beer's hop profile entry, then the canonical variety through the alias map,
// then the farms that grow that variety (hop-farm-varieties.csv), then the farm the brewery itself
// named in `lot-or-farm`, when it published one. Two kinds of farm link are kept apart everywhere:
//
//   named   the brewery named this farm for this hop. A direct, sourced link from the beer.
//   grown   the variety is grown at this farm. A link through the variety, never from the beer.
//
// No function here merges the two, and a farm that is only "grown" never reads as "named".
//
// Every input is optional: a missing file reads as empty, so the model works on the `hops` list of
// the winner profiles alone, with form, use, and farm left undefined.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { hopSlug } from '../../site/assets/hop-links.mjs';
import { readCsvRecords } from './csv.mjs';
import { parseFrontmatter } from './frontmatter.mjs';
import { matchKey } from './winner-profiles.mjs';

export { hopSlug };

// "Citra®", "citra", and " Citra " are one name; nothing beyond case, symbols, accents, spacing and
// punctuation is merged.
export const foldName = (name) => String(name ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[®™©]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const clean = (name) => String(name ?? '').replace(/[®™©]/g, '').replace(/\s+/g, ' ').trim();

const str = (v) => (v === null || v === undefined ? '' : String(v).trim());
const isBlank = (v) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

// ---------- reading the reference files ----------
const normKey = (k) => String(k).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
export function normRecord(rec) {
  const out = {};
  for (const [k, v] of Object.entries(rec ?? {})) out[normKey(k)] = str(v);
  return out;
}
const pick = (n, ...names) => { for (const k of names) if (n[k]) return n[k]; return ''; };
const splitList = (s) => String(s ?? '').split(/[;|]/).map((x) => x.trim()).filter(Boolean);

function readCsv(path) {
  return existsSync(path) ? readCsvRecords(readFileSync(path, 'utf8')).map(normRecord) : [];
}

function readDocs(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.md') && !/^(readme|agents)/i.test(f)).sort().map((f) => {
    const { data, body } = parseFrontmatter(readFileSync(resolve(dir, f), 'utf8'));
    return { file: f, stem: basename(f, '.md'), data, body };
  });
}

// The reference tables and research documents, each empty when its file is absent.
export function loadHopReference({ referenceDir, docsDir } = {}) {
  const ref = (f) => readCsv(resolve(referenceDir, f));
  return {
    varieties: ref('hop-varieties.csv'),
    acreage: ref('hop-acreage.csv'),
    farms: ref('hop-farms.csv'),
    farmVarieties: ref('hop-farm-varieties.csv'),
    merchants: ref('hop-merchants.csv'),
    gaps: ref('hop-farm-gaps.csv'),
    varietyDocs: readDocs(resolve(docsDir, 'hops', 'varieties')),
    farmDocs: readDocs(resolve(docsDir, 'hops', 'farms')),
  };
}

// ---------- sources and detail fields on a winner profile ----------
// A source is a link or a label; { label, url } for a link, { label, url: null } for text.
export function sourceOf(x) {
  if (isBlank(x)) return null;
  const one = Array.isArray(x) ? x[0] : x;
  if (isBlank(one)) return null;
  if (typeof one === 'object') {
    const url = str(one.url ?? one.link);
    const label = str(one.label ?? one.title ?? one.name) || url;
    return url || label ? { label: label || url, url: /^https?:\/\//.test(url) ? url : null } : null;
  }
  const s = str(one);
  const md = s.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
  if (md) return { label: md[1], url: md[2] };
  if (/^https?:\/\//.test(s)) {
    let host = s;
    try { host = new URL(s).hostname.replace(/^www\./, ''); } catch { /* keep the text */ }
    return { label: host, url: s };
  }
  return { label: s, url: null };
}

// The hop profile of a beer: the entries of `hop-profile`, then any name in `hops` the profile does
// not cover, so a beer with only a `hops` list still lists every hop it names.
export function hopEntries(fm) {
  const entries = [];
  const profile = Array.isArray(fm?.['hop-profile']) ? fm['hop-profile'] : [];
  for (const raw of profile) {
    if (!raw || typeof raw !== 'object') continue;
    const published = clean(raw.published ?? raw.variety);
    const variety = clean(raw.variety ?? raw.published);
    if (!variety) continue;
    entries.push({
      published: published || variety,
      variety,
      form: str(raw.form),
      use: str(raw.use),
      lotOrFarm: str(raw['lot-or-farm'] ?? raw.lot_or_farm ?? raw.lotOrFarm ?? raw.farm),
      source: sourceOf(raw.source ?? raw.sources),
    });
  }
  const covered = new Set(entries.flatMap((e) => [foldName(e.variety), foldName(e.published)]));
  for (const name of Array.isArray(fm?.hops) ? fm.hops : []) {
    const n = clean(name);
    if (n && !covered.has(foldName(n))) entries.push({ published: n, variety: n, form: '', use: '', lotOrFarm: '', source: null });
  }
  return entries;
}

export const DETAIL_KEYS = ['description', 'tasting-notes', 'srm', 'og', 'fg', 'water', 'process'];
// { key, value, source } for each detail field a profile carries. A value may be plain, a list, or
// { value, source }; a source may also sit beside it as `<key>-source`.
export function detailFields(fm) {
  const out = [];
  for (const key of DETAIL_KEYS) {
    const raw = fm?.[key];
    if (isBlank(raw)) continue;
    let value;
    let source = fm?.[`${key}-source`] ?? fm?.[`${key}-sources`];
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      value = raw.value ?? raw.text ?? raw.description ?? raw.notes;
      source = raw.source ?? raw.sources ?? source;
    } else value = raw;
    if (isBlank(value)) continue;
    out.push({ key, value: Array.isArray(value) ? value.map(str).filter(Boolean).join('; ') : str(value), source: sourceOf(source) });
  }
  return out;
}

// ---------- the model ----------
const byName = (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });

export function buildHopModel({ profiles = [], rows = [], reference = {}, breweries = [] } = {}) {
  const ref = { varieties: [], acreage: [], farms: [], farmVarieties: [], merchants: [], gaps: [], varietyDocs: [], farmDocs: [], ...reference };
  const varietyByKey = new Map();
  const varieties = [];
  const farmByKey = new Map();
  const farms = [];
  const usedSlugs = new Set();

  const uniqueSlug = (base, extra) => {
    let slug = base || 'unnamed';
    if (usedSlugs.has(slug) && extra) slug = `${slug}-${hopSlug(extra)}`;
    let n = 2;
    const root = slug;
    while (usedSlugs.has(slug)) { slug = `${root}-${n}`; n += 1; }
    usedSlugs.add(slug);
    return slug;
  };

  // ----- varieties and the alias map -----
  const makeVariety = (name, rec = null) => {
    const v = {
      name, slug: '', listed: Boolean(rec), aliases: [], breeder: '', origin: '', aroma: [], traits: [], sources: [],
      acreage: [], farms: new Map(), usages: new Map(), doc: null,
    };
    v.slug = uniqueSlug(hopSlug(name));
    varietyByKey.set(foldName(name), v);
    varieties.push(v);
    return v;
  };
  const KNOWN = new Set(['variety', 'canonical_variety', 'canonical', 'name', 'aliases', 'alias', 'breeder', 'origin', 'origin_country', 'country', 'aroma_descriptors', 'aroma', 'descriptors']);
  for (const rec of ref.varieties) {
    const name = clean(pick(rec, 'canonical_variety', 'variety', 'canonical', 'name'));
    if (!name || varietyByKey.has(foldName(name))) continue;
    const v = makeVariety(name, rec);
    v.aliases = splitList(pick(rec, 'aliases', 'alias'));
    v.breeder = pick(rec, 'breeder');
    v.origin = pick(rec, 'origin_country', 'origin', 'country');
    const aromaSource = sourceOf(pick(rec, 'aroma_source', 'aroma_descriptors_source', 'aroma_source_url', 'aroma_attribution'));
    const desc = pick(rec, 'aroma_descriptors', 'aroma', 'descriptors');
    v.aroma = (/[;|]/.test(desc) ? splitList(desc) : desc.split(',').map((x) => x.trim()).filter(Boolean)).map((d) => ({ descriptor: d, source: aromaSource }));
    for (const [k, val] of Object.entries(rec)) {
      if (!val || KNOWN.has(k) || k === 'aroma_source' || k === 'aroma_descriptors_source' || k === 'aroma_source_url' || k === 'aroma_attribution') continue;
      if (/(^|_)sources?(_|$)|(^|_)url$/.test(k)) v.sources.push({ label: k.replace(/_/g, ' '), source: sourceOf(val) });
      else v.traits.push({ key: k, value: val });
    }
  }
  for (const v of [...varieties]) for (const a of v.aliases) if (!varietyByKey.has(foldName(a))) varietyByKey.set(foldName(a), v);
  const resolveVariety = (name) => {
    const n = clean(name);
    if (!foldName(n)) return null;
    return varietyByKey.get(foldName(n)) ?? makeVariety(n);
  };

  // ----- farms -----
  const FARM_KNOWN = new Set(['slug', 'farm', 'farm_name', 'name', 'state', 'aliases', 'alias']);
  // A source cell may hold several links or labels separated by semicolons.
  const sourceList = (label, value) => splitList(value).map((x) => ({ label, source: sourceOf(x) })).filter((x) => x.source);
  for (const rec of ref.farms) {
    const name = clean(pick(rec, 'farm', 'farm_name', 'name'));
    if (!name || farmByKey.has(foldName(name))) continue;
    const f = { name, slug: '', state: pick(rec, 'state', 'state_code'), aliases: splitList(pick(rec, 'aliases', 'alias')), fields: [], sources: [], varieties: new Map(), named: new Map(), grown: new Map(), merchants: [], doc: null };
    f.slug = uniqueSlug(hopSlug(rec.slug) || hopSlug(name), f.state);
    if (rec.slug) farmByKey.set(foldName(rec.slug), f);
    for (const [k, val] of Object.entries(rec)) {
      if (!val || FARM_KNOWN.has(k)) continue;
      if (/(^|_)sources?(_|$)/.test(k)) f.sources.push(...sourceList(k.replace(/_/g, ' '), val));
      else f.fields.push({ key: k, value: val });
    }
    farmByKey.set(foldName(name), f);
    farms.push(f);
  }
  for (const f of [...farms]) for (const a of f.aliases) if (!farmByKey.has(foldName(a))) farmByKey.set(foldName(a), f);
  const farmFor = (text) => (foldName(text) ? farmByKey.get(foldName(text)) ?? null : null);

  // ----- farm varieties: the "grown by" side -----
  const unmatchedFarmRows = [];
  for (const rec of ref.farmVarieties) {
    const f = farmFor(pick(rec, 'farm', 'farm_name', 'name'));
    const published = clean(pick(rec, 'variety_as_published', 'variety', 'published', 'variety_published'));
    if (!f || !published) { unmatchedFarmRows.push(rec); continue; }
    const v = resolveVariety(published);
    if (!v) continue;
    const entry = f.varieties.get(v.slug) ?? { variety: v, published: new Set(), years: new Set(), sources: [], notes: new Set(), verified: new Set() };
    if (pick(rec, 'notes')) entry.notes.add(pick(rec, 'notes'));
    if (pick(rec, 'verified')) entry.verified.add(pick(rec, 'verified'));
    entry.published.add(published);
    const year = pick(rec, 'year');
    if (year) entry.years.add(year);
    const src = sourceOf(pick(rec, 'source', 'source_url'));
    if (src && !entry.sources.some((s) => s.label === src.label && s.url === src.url)) entry.sources.push(src);
    f.varieties.set(v.slug, entry);
    v.farms.set(f.slug, { farm: f, entry });
  }

  // ----- acreage -----
  for (const rec of ref.acreage) {
    const v = resolveVariety(pick(rec, 'variety', 'canonical_variety', 'name'));
    if (!v) continue;
    v.acreage.push({ state: pick(rec, 'state'), year: pick(rec, 'year'), acres: pick(rec, 'acres', 'acreage'), production: pick(rec, 'production', 'production_lbs', 'pounds'), source: sourceOf(pick(rec, 'source', 'source_url')) });
  }

  // ----- beers -----
  const rowByKey = new Map();
  for (const r of rows) if (!r.competition || r.competition === 'GABF') rowByKey.set(`${r.year}|${matchKey(r.beer_name, r.medal, r.category_name)}`, r);
  const breweryByKey = new Map(breweries.map((b) => [b.key, b]));
  const beers = new Map();
  for (const p of profiles) {
    const fm = p.fm ?? {};
    const row = rowByKey.get(`${p.year}|${p.key ?? matchKey(fm.beer, fm.medal, fm['category-name'])}`) ?? null;
    const brewery = row ? breweryByKey.get(row.brewery_key) : null;
    const beer = {
      stem: p.stem, year: p.year, page: `beers/${p.year}/${p.stem}/`, beer: str(fm.beer), medal: str(fm.medal), category: str(fm['category-name']),
      category_slug: row?.category_slug ?? hopSlug(fm['category-name']), category_number: fm['category-number'] ?? null,
      brewery: str(fm.brewery), brewery_key: row?.brewery_key ?? '', brewery_slug: brewery?.slug ?? row?.brewery_slug ?? hopSlug(fm.brewery),
      city: str(fm['brewery-city']), state: str(fm['brewery-state']), matched: Boolean(row), row,
      usage: [], details: detailFields(fm),
    };
    for (const e of hopEntries(fm)) {
      const v = resolveVariety(e.variety) ?? resolveVariety(e.published);
      if (!v) continue;
      const farm = e.lotOrFarm ? farmFor(e.lotOrFarm) : null;
      beer.usage.push({ ...e, canonical: v.name, slug: v.slug, variety: v, farm });
    }
    beers.set(p.stem, beer);
    for (const u of beer.usage) {
      const slot = u.variety.usages.get(p.stem) ?? { beer, entries: [] };
      slot.entries.push(u);
      u.variety.usages.set(p.stem, slot);
      if (u.farm) {
        const named = u.farm.named.get(p.stem) ?? { beer, entries: [] };
        named.entries.push(u);
        u.farm.named.set(p.stem, named);
      }
    }
  }
  // Grown by: a farm reaches a beer only through the varieties it grows.
  for (const v of varieties) {
    for (const { farm } of v.farms.values()) {
      for (const [stem, { beer }] of v.usages) {
        const slot = farm.grown.get(stem) ?? { beer, varieties: new Map() };
        slot.varieties.set(v.slug, v);
        farm.grown.set(stem, slot);
      }
    }
  }

  // ----- documents -----
  for (const doc of ref.varietyDocs) {
    const names = [doc.data?.variety, doc.data?.name, doc.data?.title, doc.stem].filter(Boolean);
    const v = names.map((n) => varietyByKey.get(foldName(n))).find(Boolean);
    if (v) v.doc = doc;
  }
  for (const doc of ref.farmDocs) {
    const names = [doc.data?.farm, doc.data?.name, doc.data?.title, doc.stem].filter(Boolean);
    const f = names.map((n) => farmByKey.get(foldName(n))).find(Boolean);
    if (f) f.doc = doc;
  }
  if (ref.merchants.length) {
    for (const m of ref.merchants) {
      const linked = new Set([farmFor(pick(m, 'farm', 'farm_name')), ...splitList(m.farms_sourced).map(farmFor)].filter(Boolean));
      for (const f of linked) f.merchants.push(m);
    }
  }

  // ----- counts and the fields the filter reads -----
  for (const v of varieties) {
    const beersHere = [...v.usages.values()].map((s) => s.beer);
    v.counts = {
      beers: new Set(beersHere.map((b) => `${b.brewery_key || b.brewery}|${foldName(b.beer)}`)).size,
      medals: beersHere.length,
      gold: beersHere.filter((b) => b.medal === 'Gold').length,
      silver: beersHere.filter((b) => b.medal === 'Silver').length,
      bronze: beersHere.filter((b) => b.medal === 'Bronze').length,
      farms: v.farms.size,
    };
  }
  for (const f of farms) f.counts = { varieties: f.varieties.size, named: f.named.size, grown: f.grown.size };
  let fieldRows = 0;
  for (const beer of beers.values()) {
    const r = beer.row;
    if (!r) continue;
    const names = (list) => [...new Set(list)].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
    r.hop_varieties = names(beer.usage.map((u) => u.canonical));
    r.hop_farms_named = names(beer.usage.filter((u) => u.farm).map((u) => u.farm.name));
    r.hop_farms_grown = names(beer.usage.flatMap((u) => [...u.variety.farms.values()].map((x) => x.farm.name)));
    fieldRows += 1;
  }

  return {
    varieties: varieties.sort(byName),
    farms: farms.sort(byName),
    beers,
    varietyBySlug: new Map(varieties.map((v) => [v.slug, v])),
    farmBySlug: new Map(farms.map((f) => [f.slug, f])),
    resolveVariety,
    farmFor,
    unmatchedFarmRows,
    acreage: ref.acreage.length,
    merchants: ref.merchants,
    gaps: ref.gaps,
    fieldRows,
  };
}

// Medal order for lists: gold first, then silver, then bronze, then by beer name.
export const MEDAL_RANK = { Gold: 1, Silver: 2, Bronze: 3 };
export const byMedalThenBeer = (a, b) => (MEDAL_RANK[a.medal] ?? 9) - (MEDAL_RANK[b.medal] ?? 9) || a.beer.localeCompare(b.beer, 'en', { sensitivity: 'base' });
