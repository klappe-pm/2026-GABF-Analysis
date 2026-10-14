#!/usr/bin/env node
// Build the hop reference data and pages from the catalogue (scripts/lib/hop-catalogue.mjs):
//   data/reference/hop-varieties.csv   one row per variety, every field, a source column and a gap column per field group
//   data/reference/hop-aliases.csv     the alias lookup read by scripts/lib/hop-aliases.mjs
//   docs/hops/varieties/<slug>.md      one page per variety
//   docs/hops/README.md                the hop section guide with the variety index
// Acreage is built separately by scripts/ingest-nass-hops.mjs; the pages read data/reference/hop-acreage.csv when it exists.

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { REFERENCE, ROOT } from './lib/paths.mjs';
import { readCsvRecords, toCsv } from './lib/csv.mjs';
import { CATALOGUE } from './lib/hop-catalogue.mjs';
import { HOP_FORMS, hopSlug, normalizeHopName } from './lib/hop-aliases.mjs';
import { NASS_REPORTS } from './lib/nass-hops.mjs';

const TODAY = '2026-10-14';
const NASS_PAGE = 'https://www.nass.usda.gov/Surveys/Guide_to_NASS_Surveys/Hops/';

export const MEASURES = [
  { key: 'a', col: 'alpha', label: 'alpha acids', unit: 'percent' },
  { key: 'b', col: 'beta', label: 'beta acids', unit: 'percent' },
  { key: 'c', col: 'cohumulone', label: 'cohumulone', unit: 'percent of alpha acids' },
  { key: 'o', col: 'total_oil', label: 'total oil', unit: 'ml per 100 g' },
  { key: 'my', col: 'myrcene', label: 'myrcene', unit: 'percent of total oil' },
  { key: 'hu', col: 'humulene', label: 'humulene', unit: 'percent of total oil' },
  { key: 'ca', col: 'caryophyllene', label: 'caryophyllene', unit: 'percent of total oil' },
  { key: 'fa', col: 'farnesene', label: 'farnesene', unit: 'percent of total oil' },
];

export const VARIETY_COLUMNS = [
  'slug', 'canonical_variety', 'kind', 'aliases', 'origin_country', 'us_grown', 'breeder', 'trademark', 'status', 'year_released', 'year_note', 'parentage',
  'use', 'use_basis', 'alpha_class',
  ...MEASURES.flatMap((m) => [`${m.col}_min`, `${m.col}_max`]),
  'aroma_descriptors', 'aroma_attribution', 'nass_label',
  'identity_source_urls', 'chemistry_source_urls', 'aroma_source_urls', 'acreage_source_url',
  'identity_gap', 'chemistry_gap', 'aroma_gap', 'notes',
];

// "11.0-13.0" is a range, "12.1" a single value, "<1" and "up to 71" have no lower bound.
export function parseRange(text) {
  if (text === undefined || text === null || text === '') return null;
  const s = String(text).trim();
  let m = s.match(/^<\s*([\d.]+)$/) ?? s.match(/^up to ([\d.]+)$/);
  if (m) return [null, Number(m[1])];
  m = s.match(/^([\d.]+)-([\d.]+)$/);
  if (m) return [Number(m[1]), Number(m[2])];
  m = s.match(/^[\d.]+$/);
  if (m) return [Number(s), Number(s)];
  throw new Error(`unreadable range "${text}"`);
}

function useFromPublished(text) {
  if (!text) return '';
  const t = text.toLowerCase();
  if (/^dual/.test(t)) return 'dual';
  if (/^aroma/.test(t)) return 'aroma';
  if (/bitter|high alpha|super alpha/.test(t)) return 'bittering';
  return '';
}

// A factual bin of the published alpha range, not an interpretation of how brewers use the hop.
function alphaClass(range) {
  if (!range) return '';
  const [min, max] = range;
  const lo = min ?? max;
  if (max < 8) return 'low (below 8 percent)';
  if (lo >= 14) return 'high (14 percent and above)';
  return 'medium (8 to 14 percent)';
}

const asList = (urls) => (urls ?? []).join('|');

export function buildVarietyRecords() {
  return CATALOGUE.map((rec) => {
    const slug = hopSlug(rec.canonical);
    const ranges = {};
    for (const m of MEASURES) ranges[m.key] = parseRange(rec.chem?.[m.key]);
    const missing = MEASURES.filter((m) => !ranges[m.key]).map((m) => m.label);
    const idSources = rec.src?.id ?? [];
    const idMissing = [];
    if (!rec.program) idMissing.push('breeder');
    if (!rec.year) idMissing.push('year_released');
    if (!rec.parentage) idMissing.push('parentage');
    const idGapParts = idMissing.map((f) => {
      if (f === 'year_released' && (rec.yearChecked)) return `year_released: ${rec.yearChecked}`;
      if (f === 'parentage' && (rec.parentageChecked)) return `parentage: ${rec.parentageChecked}`;
      return `${f}: not published in the sources checked (${idSources.map((u) => `\`${u}\``).join(', ') || 'none readable'})`;
    });
    if (rec.identityChecked) idGapParts.push(rec.identityChecked);
    const chemGap = missing.length
      ? `${missing.join(', ')} not published. ${rec.chemChecked ?? `Not listed on ${(rec.src?.chem ?? []).map((u) => `\`${u}\``).join(', ') || 'any readable page'}.`}`
      : '';
    const aromaGap = rec.aroma ? '' : (rec.aromaChecked ?? `no descriptors on ${(rec.src?.aroma ?? idSources).map((u) => `\`${u}\``).join(', ') || 'any readable page'}`);
    const usePublished = rec.usePublished ?? rec.published;
    const published = useFromPublished(usePublished);
    const row = {
      slug,
      canonical_variety: rec.canonical,
      kind: rec.kind ?? 'variety',
      aliases: (rec.aliases ?? []).join(';'),
      origin_country: rec.origin,
      us_grown: rec.nass || rec.origin === 'United States' ? 'yes' : 'no',
      breeder: rec.program ?? '',
      trademark: rec.trademark ?? '',
      status: rec.status,
      year_released: rec.year ?? '',
      year_note: rec.yearNote ?? '',
      parentage: rec.parentage ?? '',
      use: published || 'not published',
      use_basis: published ? usePublished : '',
      alpha_class: alphaClass(ranges.a),
      aroma_descriptors: (rec.aroma?.text ?? '').replace(/\.$/, ''),
      aroma_attribution: rec.aroma?.by ?? '',
      nass_label: rec.nass ?? '',
      identity_source_urls: asList(idSources),
      chemistry_source_urls: asList(rec.src?.chem),
      aroma_source_urls: asList(rec.src?.aroma),
      acreage_source_url: rec.nass ? NASS_REPORTS[0].url : '',
      identity_gap: idGapParts.join(' | '),
      chemistry_gap: chemGap,
      aroma_gap: aromaGap,
      notes: rec.note ?? '',
    };
    for (const m of MEASURES) {
      row[`${m.col}_min`] = ranges[m.key]?.[0] ?? '';
      row[`${m.col}_max`] = ranges[m.key]?.[1] ?? '';
    }
    return row;
  });
}

// Experimental codes carry a breeder prefix and digits (HBC 394, YCR 14, ADHA 871); everything else is a spelling or brand variant.
function kindOfAlias(alias) {
  return /(^|\s)(HBC|YCR|ADHA|YQH|VGXP|USDA|HS|OR|D|X)[ -]?\d/i.test(alias) || /^24B/i.test(alias) ? 'code' : 'alias';
}

export function buildAliasRows(records) {
  const rows = [];
  const seen = new Map();
  const add = (alias, slug, canonical, kind) => {
    const key = normalizeHopName(alias);
    if (seen.has(key)) {
      if (seen.get(key) !== slug) throw new Error(`alias "${alias}" claimed by ${seen.get(key)} and ${slug}`);
      return;
    }
    seen.set(key, slug);
    rows.push({ alias, normalized: key, slug, canonical, kind });
  };
  for (const r of records) {
    add(r.canonical_variety, r.slug, r.canonical_variety, 'canonical');
    for (const alias of r.aliases ? r.aliases.split(';') : []) add(alias, r.slug, r.canonical_variety, kindOfAlias(alias));
  }
  for (const f of HOP_FORMS) for (const v of f.variants) rows.push({ alias: v, normalized: normalizeHopName(v), slug: '', canonical: f.form, kind: 'form' });
  return rows;
}

const range = (min, max) => {
  if (min === '' && max === '') return 'not published';
  if (min === '') return `up to ${max}`;
  if (min === max) return `${min} (single value)`;
  return `${min} to ${max}`;
};

const link = (url) => {
  const label = url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
  return /--/.test(url) ? `\`${url}\`` : `[${label}](${url})`;
};

function yamlList(items) {
  const sorted = [...new Set(items)].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  return sorted.length ? `\n${sorted.map((i) => `  - ${JSON.stringify(i)}`).join('\n')}` : ' []';
}

const CODE_LABEL = { D: 'withheld by NASS to avoid disclosing individual operations', NA: 'not available', X: 'not applicable' };

function acreageSection(row, acreage) {
  if (!row.nass_label) {
    return row.us_grown === 'yes'
      ? 'NASS names no line for this variety in the National Hop Report, so no state acreage is published for it.'
      : 'This variety is not grown commercially in the United States as far as the sources checked show, so US acreage does not apply.';
  }
  const rows = acreage.filter((a) => a.variety_slug === row.slug);
  const years = [...new Set(rows.map((a) => a.year))].sort();
  const states = ['Idaho', 'Oregon', 'Washington'];
  const cell = (state, year, measure) => {
    const r = rows.find((a) => a.state === state && a.year === year);
    if (!r) return 'not listed';
    const value = r[measure === 'acres' ? 'acres' : 'production_1000_lb'];
    const code = r[measure === 'acres' ? 'acres_code' : 'production_code'];
    if (value === '' && code) return CODE_LABEL[code];
    return value === '' ? 'not listed' : Number(value).toLocaleString('en-US');
  };
  const table = (measure) => `| Year | ${states.join(' | ')} |\n|---|---|---|---|\n${years.map((y) => `| ${y} | ${states.map((s) => cell(s, y, measure)).join(' | ')} |`).join('\n')}`;
  const total = (year, key) => {
    const vals = states.map((s) => rows.find((a) => a.state === s && a.year === year)).map((r) => (r ? r[key] : ''));
    return vals.some((v) => v === '') ? null : vals.reduce((sum, v) => sum + Number(v), 0);
  };
  const complete = years.map((y) => ({ y, acres: total(y, 'acres') })).filter((t) => t.acres !== null);
  let trend = 'A three state total cannot be computed for any year because at least one state is withheld or not listed.';
  if (complete.length >= 2) {
    const first = complete[0];
    const last = complete[complete.length - 1];
    const pct = first.acres ? Math.round(((last.acres - first.acres) / first.acres) * 100) : null;
    trend = `Summed over the three states where every state is published, harvested area was ${first.acres.toLocaleString('en-US')} acres in ${first.y} and ${last.acres.toLocaleString('en-US')} acres in ${last.y}${pct === null ? '' : ` (${pct > 0 ? 'up' : 'down'} ${Math.abs(pct)} percent)`}; years with a withheld state are left out of the comparison.`;
  }
  return `Area harvested in acres, from the USDA NASS National Hop Report (line "${row.nass_label}"). Each year comes from the newest report that covers it.\n\n${table('acres')}\n\nProduction in 1,000 pounds.\n\n${table('production')}\n\n${trend}`;
}

export function buildPage(row, acreage) {
  const aliases = row.aliases ? row.aliases.split(';') : [];
  const tags = [row.status.replace(/ /g, '-'), row.origin_country.toLowerCase().replace(/ /g, '-'), row.kind];
  const topics = ['hop-varieties', 'hops'];
  const fm = [
    '---',
    'domain: beer',
    'category: hops',
    'sub-category: variety',
    `topics:${yamlList(topics)}`,
    `types:${yamlList(['hop-variety'])}`,
    `date-created: ${TODAY}`,
    `date-revised: ${TODAY}`,
    'status: DONE',
    `aliases:${yamlList(aliases)}`,
    `tags:${yamlList(tags)}`,
    `variety: ${JSON.stringify(row.canonical_variety)}`,
    `kind: ${JSON.stringify(row.kind)}`,
    `origin-country: ${JSON.stringify(row.origin_country)}`,
    `program: ${JSON.stringify(row.breeder || 'not published')}`,
    `proprietary-status: ${JSON.stringify(row.status)}`,
    `slug: ${JSON.stringify(row.slug)}`,
    `year-released: ${row.year_released ? JSON.stringify(row.year_released) : 'null'}`,
    '---',
  ].join('\n');
  const measureRows = MEASURES.map((m) => `| ${m.label} | ${range(row[`${m.col}_min`], row[`${m.col}_max`])} | ${m.unit} |`).join('\n');
  const idRows = [
    ['Origin', row.origin_country],
    ['Breeder or owner program', row.breeder || 'not published'],
    ['Trademark', row.trademark || 'none found'],
    ['Proprietary or public', row.status],
    ['Year released', row.year_released ? `${row.year_released}${row.year_note ? ` (${row.year_note})` : ''}` : 'not published'],
    ['Parentage', row.parentage || 'not published'],
    ['Published use', row.use === 'not published' ? 'not published' : `${row.use} (${row.use_basis})`],
    ['Alpha class', row.alpha_class || 'not published'],
  ].map(([k, v]) => `| ${k} | ${v} |`).join('\n');
  const aroma = row.aroma_descriptors ? `As published by ${row.aroma_attribution}: "${row.aroma_descriptors}"` : 'No descriptors were published on any page that could be read.';
  const gaps = [...row.identity_gap.split(' | ').filter(Boolean).map((g) => `Identity, ${g}`), row.chemistry_gap && `Chemistry, ${row.chemistry_gap}`, row.aroma_gap && `Aroma, ${row.aroma_gap}`].filter(Boolean);
  const urls = [...new Set([...row.identity_source_urls.split('|'), ...row.chemistry_source_urls.split('|'), ...row.aroma_source_urls.split('|'), row.acreage_source_url].filter(Boolean))];
  const lines = [
    fm, '',
    `# ${row.slug}`, '',
    `${row.canonical_variety} is ${row.kind === 'variety' ? 'a hop variety' : `a hop ${row.kind}`} from ${row.origin_country === 'United States' ? 'the United States' : row.origin_country}, ${row.status === 'proprietary' ? 'proprietary' : row.status === 'public' ? 'public' : 'with proprietary status not published'}${row.breeder ? `, from ${row.breeder}` : ''}. ${row.year_released ? `It was released in ${row.year_released}. ` : ''}${row.alpha_class ? `Its published alpha acid range is ${range(row.alpha_min, row.alpha_max)} percent.` : 'No alpha acid range was published on any page that could be read.'}`, '',
    '## identity', '',
    '| Field | Value |', '|---|---|', idRows, '',
    aliases.length ? `Also published as: ${aliases.join(', ')}.` : 'No other published names were found.', '',
    '## chemistry', '',
    'Ranges are as published by the breeder or supplier named under sources; a single value means the source printed one figure.', '',
    '| Measure | Published | Unit |', '|---|---|---|', measureRows, '',
    row.notes ? `${row.notes}` : '', row.notes ? '' : null,
    '## aroma', '', aroma, '',
    '## acreage', '', acreageSection(row, acreage), '',
    '## gaps', '', gaps.length ? gaps.map((g) => `- ${g}`).join('\n') : 'No gaps: every field is published by the sources listed below.', '',
    '## sources', '', urls.map((u) => `- ${link(u)}`).join('\n'), '',
  ].filter((l) => l !== null);
  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n')}`;
}

export function buildReadme(records) {
  const count = (pred) => records.filter(pred).length;
  const index = records.slice().sort((a, b) => a.canonical_variety.localeCompare(b.canonical_variety)).map((r) => `| [${r.canonical_variety}](varieties/${r.slug}.md) | ${r.origin_country} | ${r.status} | ${r.breeder || 'not published'} |`).join('\n');
  return `---
domain: beer
category: hops
sub-category: guide
topics:
  - "hop-varieties"
  - "hops"
types:
  - "guide"
date-created: ${TODAY}
date-revised: ${TODAY}
status: DONE
aliases: []
tags:
  - "hops"
---

# README.MD

The hop section links every hop named in a 2026 medal beer profile to a published variety record: who bred or owns it, when it was released, what it is crossed from, its alpha, beta, cohumulone and oil figures, how its breeder or supplier describes its aroma, and, for the US grown ones, how many acres and pounds the USDA counts by state. ${records.length} records are held: ${count((r) => r.status === 'proprietary')} proprietary, ${count((r) => r.status === 'public')} public and ${count((r) => r.status === 'not published')} whose status no source states.

## what-is-here

- [hop-varieties.csv](../../data/reference/hop-varieties.csv) holds one row per variety with every field, a source column per field group and a gap column per field group.
- [hop-acreage.csv](../../data/reference/hop-acreage.csv) holds NASS harvested acres, yield and production by variety, state and crop year.
- [hop-acreage-totals.csv](../../data/reference/hop-acreage-totals.csv) holds the NASS state totals and the experimental and other varieties lines, kept apart so the acreage file lists only varieties.
- [hop-aliases.csv](../../data/reference/hop-aliases.csv) maps every published name, brand name, experimental code and spelling to a canonical variety, and lists the product forms (Cryo, LupuLN2, LUPOMAX, Incognito, HyperBoost, DynaBoost, Spectrum, T90) that brewers append to a name.
- [hop-unmapped.csv](../../data/reference/hop-unmapped.csv) lists the names that are deliberately not a single variety, each with its reason.
- One page per variety sits in [varieties](varieties).

## looking-up-a-name

\`scripts/lib/hop-aliases.mjs\` reads the alias and unmapped files. \`resolveHop('Citra LupuLN2', loadHopLookup())\` returns the canonical variety and the form separately. A name that is neither mapped nor listed as unmapped comes back as unknown, which the test in \`tests/hop-varieties.test.mjs\` treats as a failure, so a new profile name must be added to the catalogue or to the unmapped file.

## reading-the-data

- Ranges are stored as numeric minimum and maximum columns. A blank minimum with a maximum means the source printed "below" or "up to"; equal minimum and maximum means the source printed one value.
- Alpha, beta and cohumulone are percent (cohumulone as a share of alpha acids). Total oil is ml per 100 g. Myrcene, humulene, caryophyllene and farnesene are percent of total oil.
- Breeder and supplier figures are ranges for typical crops and differ between sources. Where two sources disagree the record keeps the primary source and the notes column names the other.
- Proprietary means the variety carries a trademark or patent or comes from a private company or farm breeding program. Public means a USDA or university release, a public research institute release (Hüll) or a landrace. Not published means no source read states which. Hüll varieties are classed public on the institute alone; their licensing is unverified.
- Alpha class is a bin of the published alpha range (low below 8 percent, medium 8 to 14 percent, high 14 percent and above), not a claim about how the hop is used. Published use is filled only where a breeder or supplier sheet states it.
- A gap is stated plainly with the pages that were checked; nothing is estimated. Values that a source printed implausibly (a shifted decimal) are left out and named in the gap.
- Acreage is the USDA NASS National Hop Report for the 2025 crop, released December 19, 2025, with the four earlier crop years from the 2024 and 2023 reports. A withheld value is blank with a code and the state totals are never summed across a withheld state.
- US acreage applies only to US grown varieties. NASS names a line for a variety only when it is large enough; a US grown variety without a line sits inside the other varieties line.

## rebuilding

\`\`\`bash
cd /Users/kevinlappe/projects/active/gabf-analysis && node scripts/ingest-nass-hops.mjs --fetch && node scripts/build-hop-data.mjs
\`\`\`

The catalogue in \`scripts/lib/hop-catalogue.mjs\` is the hand curated source: each figure there is copied from the page named beside it. \`npm run hops:check\` validates the files and the 2026 profiles.

## sources

- USDA NASS National Hop Report, ${NASS_REPORTS.map((r) => `[${r.releaseYear}](${r.url})`).join(', ')}, and the [NASS hops survey guide](${NASS_PAGE}).
- John I. Haas variety sheets at johnihaas.com, Hopsteiner variety data sheets at hopsteiner.us, the Hop Breeding Company site, Hop Products Australia data sheets, Charles Faram hop oracle, and Yakima Valley Hops product pages, each cited on the variety pages that use them.

## varieties

| Variety | Origin | Status | Program |
|---|---|---|---|
${index}
`;
}

function main() {
  const records = buildVarietyRecords();
  const aliasRows = buildAliasRows(records);
  writeFileSync(resolve(REFERENCE, 'hop-varieties.csv'), toCsv(records, VARIETY_COLUMNS));
  writeFileSync(resolve(REFERENCE, 'hop-aliases.csv'), toCsv(aliasRows, ['alias', 'normalized', 'slug', 'canonical', 'kind']));
  const acreageFile = resolve(REFERENCE, 'hop-acreage.csv');
  const acreage = existsSync(acreageFile) ? readCsvRecords(readFileSync(acreageFile, 'utf8')) : [];
  const dir = resolve(ROOT, 'docs/hops/varieties');
  mkdirSync(dir, { recursive: true });
  const keep = new Set(records.map((r) => `${r.slug}.md`));
  for (const f of readdirSync(dir)) if (f.endsWith('.md') && !keep.has(f)) rmSync(resolve(dir, f));
  for (const r of records) writeFileSync(resolve(dir, `${r.slug}.md`), buildPage(r, acreage));
  writeFileSync(resolve(ROOT, 'docs/hops/README.md'), buildReadme(records));
  console.log(`wrote ${records.length} varieties, ${aliasRows.length} alias rows, ${records.length} pages`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
