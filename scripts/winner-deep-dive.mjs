// Deep dive sections for the 2026 winner profiles (docs/<year>/winner/NNN-*.md).
//
// The frontmatter is the source of truth. This script:
// 1. adds the deep dive keys when a profile lacks them (description, fg, gaps, hop-profile, og,
//    process, srm, tasting-notes, water), seeding description from the brewery-description quote,
//    hop-profile from the hops list and its specs source, and process left for research (the specs Other row stays as written);
// 2. keeps a gaps entry for every field that is still empty, naming the sources already checked;
// 3. regenerates the body sections tasting-notes, hop-profile, brewing-details, awards-history,
//    brewery-context and gaps from the frontmatter and the data (awards from data/results, links
//    from data/reference/brewery-links.csv, city and type from the enriched brewery data).
//
// Other keys keep their exact text; keys are ordered canonical first, then A to Z.
// Usage: node scripts/winner-deep-dive.mjs [year] [file-filter-regex]

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import YAML from 'yaml';
import { readCsvRecords } from './lib/csv.mjs';
import { breweryKey } from './lib/slug.mjs';
import { ROOT } from './lib/paths.mjs';

export const CANONICAL = ['domain', 'category', 'sub-category', 'topics', 'types', 'date-created', 'date-revised', 'status', 'aliases', 'tags'];
export const DEEP_KEYS = ['description', 'fg', 'gaps', 'hop-profile', 'og', 'process', 'srm', 'tasting-notes', 'water'];
const HOP_KEYS = ['published', 'variety', 'form', 'use', 'lot-or-farm', 'source'];

// Field names as a reader sees them, in page order.
export const GAP_FIELDS = [
  ['description', 'Description'], ['tasting-notes', 'Tasting notes'], ['abv', 'ABV'], ['ibu', 'IBU'], ['srm', 'Color (SRM)'], ['og', 'Original gravity'], ['fg', 'Final gravity'],
  ['hops', 'Hops'], ['hop-form', 'Hop form'], ['hop-use', 'Hop use'], ['lot-or-farm', 'Hop lot or farm'], ['malts', 'Malts and grains'], ['yeast', 'Yeast'], ['adjuncts', 'Adjuncts'], ['water', 'Water'], ['process', 'Process'],
];
const GAP_LABEL = Object.fromEntries(GAP_FIELDS);

const isBlank = (v) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

// ---------- frontmatter as raw key blocks ----------
export function splitDoc(text) {
  const end = text.indexOf('\n---', 4);
  const raw = text.slice(4, end + 1);
  const body = text.slice(end + 4).replace(/^\n+/, '');
  const blocks = new Map();
  let key = null;
  for (const line of raw.split('\n')) {
    if (!line) continue;
    const m = line.match(/^([A-Za-z][\w-]*):/);
    if (m) { key = m[1]; blocks.set(key, `${line}\n`); } else if (key) blocks.set(key, blocks.get(key) + `${line}\n`);
  }
  return { data: YAML.parse(raw) ?? {}, blocks, body };
}

const scalar = (v) => (v === null || v === undefined ? 'null' : typeof v === 'number' || typeof v === 'boolean' ? String(v) : JSON.stringify(String(v)));
function serialize(key, v) {
  if (Array.isArray(v)) {
    if (!v.length) return `${key}: []\n`;
    return `${key}:\n${v.map((item) => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const keys = Object.keys(item);
        return keys.map((k, i) => `${i === 0 ? '  - ' : '    '}${k}:${Array.isArray(item[k]) ? (item[k].length ? `\n${item[k].map((x) => `      - ${scalar(x)}`).join('\n')}` : ' []') : ` ${scalar(item[k])}`}`).join('\n');
      }
      return `  - ${scalar(item)}`;
    }).join('\n')}\n`;
  }
  if (v && typeof v === 'object') return `${key}:\n${Object.entries(v).map(([k, x]) => `  ${k}: ${scalar(x)}`).join('\n')}\n`;
  return `${key}: ${scalar(v)}\n`;
}

export function orderKeys(keys) {
  const canon = CANONICAL.filter((k) => keys.includes(k));
  const rest = keys.filter((k) => !CANONICAL.includes(k)).sort((a, b) => a.localeCompare(b));
  return [...canon, ...rest];
}

// ---------- body sections ----------
export function section(body, name) {
  const hit = body.match(new RegExp(`^## ${name}\\s*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm'));
  return hit ? hit[1].trim() : '';
}

function setSection(body, name, content, after) {
  const block = `## ${name}\n\n${content.trim()}\n\n`;
  const re = new RegExp(`^## ${name}\\s*\\n[\\s\\S]*?(?=^## |(?![\\s\\S]))`, 'm');
  if (re.test(body)) return body.replace(re, block);
  for (const a of after) {
    const at = new RegExp(`^## ${a}\\s*\\n[\\s\\S]*?(?=^## |(?![\\s\\S]))`, 'm').exec(body);
    if (at) return body.slice(0, at.index + at[0].length) + block + body.slice(at.index + at[0].length);
  }
  return `${body.trimEnd()}\n\n${block}`;
}

// Link text is the site's host name; a host on an unusual domain reads as "web page".
const host = (url) => { try { const h = new URL(url).hostname.replace(/^www\./, ''); return /\.(com|org|net|beer|co|us|io|biz|info|brewing|pub)$/.test(h) ? h : 'web page'; } catch { return String(url); } };
// A literal double hyphen in a URL is escaped so the prose check does not read it as a dash.
const link = (url) => (/^https?:\/\//.test(String(url)) ? `[${host(url)}](${String(url).replace(/--/g, '-%2D')})` : String(url));
const cell = (v) => String(v ?? '').replace(/\|/g, '&#124;');
const sourceCell = (url) => (url ? link(url) : 'none found');

// Seed values from the existing body.
function seedDescription(body) {
  const s = section(body, 'brewery-description');
  const quote = s.split('\n').filter((l) => l.startsWith('>')).map((l) => l.replace(/^>\s?/, '')).join(' ').trim();
  const src = s.match(/Source:[^\n]*?\]\((https?:\/\/[^)\s]+)\)/);
  return quote && src ? { text: quote, source: src[1] } : null;
}
function specsRow(body, label) {
  for (const line of section(body, 'specs').split('\n')) {
    const cells = line.split('|').map((c) => c.trim());
    if (cells[1] === label) return { value: cells[2], url: cells[3]?.match(/\]\((https?:\/\/[^)\s]+)\)/)?.[1] ?? null };
  }
  return null;
}

// What a gap entry seeds as already checked: the profile's own sources, and the searches its notes record.
function seedChecked(data, body) {
  const out = (data.sources ?? []).filter((u) => !/brewersassociation\.org\/edu\/brewers-association-beer-style-guidelines/.test(u));
  const notes = section(body, 'research-notes');
  if (/search/i.test(notes)) out.push('web searches recorded in the research notes');
  return out;
}

export function missingFields(d) {
  const hp = Array.isArray(d['hop-profile']) ? d['hop-profile'] : [];
  const out = [];
  if (isBlank(d.description)) out.push('description');
  if (isBlank(d['tasting-notes'])) out.push('tasting-notes');
  for (const k of ['abv', 'ibu', 'srm', 'og', 'fg']) if (isBlank(d[k])) out.push(k);
  if (isBlank(d.hops)) out.push('hops');
  if (!hp.some((h) => !isBlank(h.form))) out.push('hop-form');
  if (!hp.some((h) => !isBlank(h.use))) out.push('hop-use');
  if (!hp.some((h) => !isBlank(h['lot-or-farm']))) out.push('lot-or-farm');
  for (const k of ['malts', 'yeast', 'adjuncts', 'water', 'process']) if (isBlank(d[k])) out.push(k);
  return out;
}

// ---------- data joins ----------
const norm = (s) => String(s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
export function loadContext(root = ROOT) {
  const results = [];
  const dir = resolve(root, 'data/results');
  for (const f of readdirSync(dir).filter((x) => /^(gabf-\d{4}|world-beer-cup)\.csv$/.test(x))) results.push(...readCsvRecords(readFileSync(resolve(dir, f), 'utf8')));
  const linksPath = resolve(root, 'data/reference/brewery-links.csv');
  const links = new Map(existsSync(linksPath) ? readCsvRecords(readFileSync(linksPath, 'utf8')).map((l) => [breweryKey(l.brewery_name), l]) : []);
  const enrichedPath = resolve(root, 'data/enriched/breweries.json');
  const enriched = existsSync(enrichedPath) ? JSON.parse(readFileSync(enrichedPath, 'utf8')).breweries ?? {} : {};
  return { results, links, enriched };
}

export function awardsFor(ctx, brewery, beer) {
  const key = breweryKey(brewery);
  const b = norm(beer);
  return ctx.results.filter((r) => breweryKey(r.brewery_name) === key && norm(r.beer_name) === b)
    .sort((x, y) => Number(x.year) - Number(y.year) || String(x.competition).localeCompare(String(y.competition)));
}

const TYPE_LABEL = { micro: 'Microbrewery', brewpub: 'Brewpub', regional: 'Regional brewery', planning: 'In planning', large: 'Large brewery', closed: 'Closed', contract: 'Contract brewer', proprietor: 'Alternating proprietor', nano: 'Nanobrewery', bar: 'Bar', taproom: 'Taproom' };
const COMPETITION = { GABF: 'Great American Beer Festival', WBC: 'World Beer Cup' };

// ---------- one profile ----------
export function deepDive(text, ctx) {
  const { data, blocks, body: body0 } = splitDoc(text);
  const d = { ...data };
  const set = new Map();
  const put = (k, v) => { d[k] = v; set.set(k, v); };

  if (!('description' in data)) put('description', seedDescription(body0));
  if (!('tasting-notes' in data)) put('tasting-notes', null);
  if (!('hop-profile' in data)) {
    const src = specsRow(body0, 'Hops')?.url ?? null;
    put('hop-profile', (data.hops ?? []).map((h) => ({ published: h, variety: h, form: null, use: null, 'lot-or-farm': null, source: src })));
  }
  for (const k of ['srm', 'og', 'fg', 'water']) if (!(k in data)) put(k, null);
  if (!('process' in data)) put('process', null);
  const missing = missingFields(d);
  const prior = Array.isArray(data.gaps) ? data.gaps : [];
  const gaps = missing.map((f) => prior.find((g) => g.field === f) ?? { field: f, 'sources-checked': seedChecked(data, body0) });
  if (JSON.stringify(gaps) !== JSON.stringify(prior) || !('gaps' in data)) put('gaps', gaps);

  // body
  let body = body0;
  const tn = d['tasting-notes'];
  body = setSection(body, 'tasting-notes', tn ? `> ${tn.text}\n\nSource: ${link(tn.source)}` : 'The brewery has published no tasting notes for this beer that the research could find.', ['brewery-description']);
  const hp = d['hop-profile'] ?? [];
  body = setSection(body, 'hop-profile', hp.length
    ? `| Hop as published | Variety | Form | Use | Lot or farm | Source |\n|---|---|---|---|---|---|\n${hp.map((h) => `| ${cell(h.published)} | ${cell(h.variety)} | ${cell(h.form ?? 'not published')} | ${cell(h.use ?? 'not published')} | ${cell(h['lot-or-farm'] ?? 'not published')} | ${sourceCell(h.source)} |`).join('\n')}`
    : 'No hop variety is published for this beer.', ['ingredients']);
  const detail = (label, v) => `| ${label} | ${v ? cell(v.value) : 'not published'} | ${v ? sourceCell(v.source) : 'none found'} |`;
  body = setSection(body, 'brewing-details', `| Field | Value | Source |\n|---|---|---|\n${detail('Color (SRM)', d.srm)}\n${detail('Original gravity', d.og)}\n${detail('Final gravity', d.fg)}\n${detail('Water', d.water)}\n${detail('Process', d.process)}`, ['hop-profile']);
  const awards = awardsFor(ctx, d.brewery, d.beer);
  body = setSection(body, 'awards-history', `${awards.length ? `| Year | Competition | Category | Medal |\n|---|---|---|---|\n${awards.map((a) => `| ${a.year} | ${COMPETITION[a.competition] ?? cell(a.competition)} | ${cell(a.category_name)} | ${cell(a.medal)} |`).join('\n')}` : 'No medal rows for this beer are loaded.'}\n\nGenerated from the loaded results for this brewery and beer name, not researched separately; years not loaded are not covered.`, ['style-context']);
  const key = breweryKey(d.brewery);
  const l = ctx.links.get(key);
  const best = ctx.enriched[key]?.best ?? {};
  const linkList = l ? [['Website', l.website], ['Instagram', l.instagram], ['Untappd', l.untappd], ['BeerAdvocate', l.beeradvocate]].filter(([, u]) => u).map(([n, u]) => `[${n}](${u})`) : [];
  body = setSection(body, 'brewery-context', [
    `${d.brewery} is in ${d['brewery-city']}, ${d['brewery-state']}.${best.brewery_type && TYPE_LABEL[best.brewery_type] ? ` Brewery type in Open Brewery DB: ${TYPE_LABEL[best.brewery_type]}.` : ''}`,
    linkList.length ? `Links checked ${l.checked}: ${linkList.join(', ')}.` : 'No brewery links have been checked yet.',
  ].join('\n\n'), ['awards-history']);
  // Fields checked against the same sources share one line.
  const groups = new Map();
  for (const g of gaps) {
    const c = g['sources-checked'] ?? [];
    const k = JSON.stringify(c);
    if (!groups.has(k)) groups.set(k, { checked: c, fields: [] });
    groups.get(k).fields.push(GAP_LABEL[g.field] ?? g.field);
  }
  body = setSection(body, 'gaps', gaps.length
    ? [...groups.values()].map((g) => `- Not published: ${g.fields.join(', ')}. Checked ${g.checked.length ? g.checked.map(link).join(', ') : 'no source yet'}.`).join('\n')
    : 'Every field has a published value.', ['links']);

  // frontmatter
  const keys = orderKeys([...new Set([...blocks.keys(), ...set.keys()])]);
  const fm = keys.map((k) => (set.has(k) ? serialize(k, set.get(k)) : blocks.get(k))).join('');
  return `---\n${fm}---\n\n${body.trimEnd()}\n`;
}

// Mark a profile revised today when its content changed.
export function touch(text, date) {
  return text.replace(/^date-revised: .*$/m, `date-revised: ${date}`);
}

function main() {
  const year = process.argv[2] ?? '2026';
  const filter = process.argv[3] ? new RegExp(process.argv[3]) : null;
  const today = process.env.REVISED_DATE ?? new Date().toISOString().slice(0, 10);
  const dir = resolve(ROOT, 'docs', year, 'winner');
  const ctx = loadContext();
  let changed = 0;
  for (const f of readdirSync(dir).filter((x) => /^\d{3}-.+\.md$/.test(x)).sort()) {
    if (filter && !filter.test(f)) continue;
    const path = resolve(dir, f);
    const before = readFileSync(path, 'utf8');
    let after = deepDive(before, ctx);
    if (after !== before) { after = touch(after, today); writeFileSync(path, after); changed += 1; }
  }
  console.log(`${changed} profiles updated`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
