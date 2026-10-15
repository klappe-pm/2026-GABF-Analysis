// The panels of the dashboards: for each, the chart builder, the table view of the same numbers, and what
// selecting a mark does. A panel is a function of the context (the rows in view, the lookups, the copy).
// Every visible word comes from the copy documents through ctx.copy.
import { TextLink } from '@/components/TextLink';
import type { Column } from '@/components/DataTable';
import { href, paths } from '@/lib/href';
import { medalRates } from '@/lib/models/rates.mjs';
import { bins, rateEdges, type Bin, type Kit } from '@/design/chart-kit';
import { esc, fmtN, heatmap, labelColumn, lollipop, rankedBars, scatter, stackedBars, tileGrid, treemap, type RankItem } from './charts';
import type { ChartSpec } from './OptionChart';
import type { Copy } from './copy';

/* eslint-disable @typescript-eslint/no-explicit-any */
export type MedalRow = Record<string, any>;
export type Meta = Record<string, any>;
export type Brewery = Record<string, any>;

export type Ctx = {
  rows: MedalRow[];
  all: MedalRow[];
  meta: Meta;
  breweries: Brewery[];
  years: number[];
  brewery: Brewery | null;
  filter: Record<string, string>;
  toggle: (id: string, value: string) => void;
  go: (path: string) => void;
  copy: Copy;
  tiles: Record<string, [number, number]>;
  rateYears: { latest: number; data: number };
};

const MEDAL_KEYS = ['Gold', 'Silver', 'Bronze'] as const;
const STATE_BINS = [0, 1, 10, 25, 50, 100, 250];

export const countBy = (rows: MedalRow[], key: string): [string, number][] => {
  const m = new Map<string, number>();
  for (const r of rows) {
    const v = r[key];
    if (v === null || v === undefined || v === '') continue;
    m.set(String(v), (m.get(String(v)) ?? 0) + 1);
  }
  return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
};

const split = (rows: MedalRow[]) => MEDAL_KEYS.map((m) => rows.filter((r) => r.medal === m).length);

/** Compact figures: one decimal at most, K, M, B, a trailing .0 dropped. */
export const compact = (n: number) => {
  const a = Math.abs(n);
  const f = (v: number, s: string) => `${Number(v.toFixed(1))}${s}`;
  return a >= 1e9 ? f(n / 1e9, 'B') : a >= 1e6 ? f(n / 1e6, 'M') : a >= 1e3 ? f(n / 1e3, 'K') : fmtN(Math.round(n));
};
const rate = (n: number) => (n >= 100 ? String(Math.round(n)) : n >= 10 ? n.toFixed(1) : n.toFixed(2));

/** A name in a table that filters the dashboard to it. */
function Pick({ label, onPick }: { label: string; onPick: () => void }) {
  return <button type="button" onClick={onPick} className="inline-flex min-h-6 items-center text-left text-primary underline state-hover:decoration-2">{label}</button>;
}

export const labelOf = (copy: Copy, group: string, value: unknown) => {
  const v = String(value ?? '');
  try {
    return copy.group(`labels.${group}`)[v] ?? v;
  } catch {
    return v;
  }
};

function chart(ctx: Ctx, id: string, key: string, rest: Omit<ChartSpec, 'id' | 'title' | 'ariaLabel' | 'tableSummary' | 'saveLabel' | 'subtitle'> & { subtitle?: string; values?: Record<string, string | number> }, titleKey = 'title'): ChartSpec {
  const { copy } = ctx;
  const title = copy.t(`page.panels.${key}.${titleKey}`, rest.values);
  const subtitle = rest.subtitle ?? (copy.has(`page.panels.${key}.subtitle`) ? copy.t(`page.panels.${key}.subtitle`, rest.values) : undefined);
  return { ...rest, id, title, subtitle, ariaLabel: copy.t('page.chart.aria', { title }), tableSummary: copy.t('charts.table_view.summary'), saveLabel: copy.t('charts.toolbox.save_png') };
}

const yearLabel = (ctx: Ctx, y: number) => {
  const c = ctx.meta.coverage?.[y];
  return !c || c === 'complete' ? String(y) : `${y}\n${labelOf(ctx.copy, 'coverage', c)}`;
};
const yearName = (ctx: Ctx, y: number) => yearLabel(ctx, y).replace('\n', ', ');
const col = (key: string, label: string, numeric = false, sortable = true): Column => ({ key, label, numeric, sortable });
const gsb = (g: number, s: number, b: number) => `${g} / ${s} / ${b}`;
const medalColor = (m: string) => (k: Kit) => k.medal[m];

// ---------- the panels ----------

export function medalsByYear(ctx: Ctx): ChartSpec {
  const { copy } = ctx;
  const med = copy.group('labels.medal');
  const data = ctx.years.map((y) => {
    const yr = ctx.rows.filter((r) => r.year === y);
    const [g, s, b] = split(yr);
    return { year: y, g, s, b, total: yr.length };
  });
  const pickYear = (i: number) => ctx.toggle('year', String(data[i].year));
  return chart(ctx, 'medals-by-year', 'medals_by_year', {
    build: stackedBars({
      labels: data.map((d) => yearLabel(ctx, d.year)),
      series: MEDAL_KEYS.map((m, k) => ({ name: med[m], data: data.map((d) => [d.g, d.s, d.b][k]), color: medalColor(m) })),
      totals: { values: data.map((d) => d.total), format: fmtN },
      tip: (i) => `<b>${esc(yearName(ctx, data[i].year))}</b><br>${esc(med.Gold)} ${data[i].g}, ${esc(med.Silver)} ${data[i].s}, ${esc(med.Bronze)} ${data[i].b}<br>${fmtN(data[i].total)} ${esc(copy.t('charts.units.medals').toLowerCase())}`,
    }),
    legend: (k) => MEDAL_KEYS.map((m) => ({ label: med[m], color: k.medal[m], shape: 'square' })),
    onSelect: (_n, i) => pickYear(i),
    table: {
      caption: copy.t('page.panels.medals_by_year.title'),
      columns: [col('year', copy.t('tables.medal_columns.year')), col('split', copy.t('tables.brewery_columns.medal_split')), col('total', copy.t('charts.units.medals'), true), col('coverage', copy.t('page.panels.medals_by_year.coverage_column'))],
      rows: data.map((d, i) => ({
        key: String(d.year),
        sort: { year: d.year, total: d.total, split: d.total },
        cells: { year: <Pick label={String(d.year)} onPick={() => pickYear(i)} />, split: gsb(d.g, d.s, d.b), total: fmtN(d.total), coverage: labelOf(copy, 'coverage', ctx.meta.coverage?.[d.year]) },
      })),
      initialSort: { key: 'year', dir: 'ascending' },
    },
  });
}

function stateList(ctx: Ctx) {
  const by = new Map<string, MedalRow[]>();
  for (const r of ctx.rows) by.set(r.state, [...(by.get(r.state) ?? []), r]);
  return (ctx.meta.states as Meta[]).map((s) => {
    const list = by.get(s.state) ?? [];
    const [g, sv, b] = split(list);
    return { code: s.state as string, name: s.name as string, region: s.region as string, division: s.division as string, medals: list.length, g, s: sv, b };
  });
}

const binLegend = (ctx: Ctx, set: Bin[], format: (n: number) => string = fmtN) => set.map((b, i) => {
  const next = set[i + 1];
  const label = !next ? ctx.copy.t('page.chart.bin_open', { min: format(b.min) }) : next.min - b.min <= 1 || (b.min === 0 && next.min === 1) ? ctx.copy.t('page.chart.bin_single', { min: format(b.min) }) : ctx.copy.t('page.chart.bin_range', { min: format(b.min), max: format(Number.isInteger(next.min) ? next.min - 1 : next.min) });
  return { label, color: b.fill };
});

export function medalsByState(ctx: Ctx): ChartSpec {
  const { copy } = ctx;
  const list = stateList(ctx);
  const byCode = new Map(list.map((s) => [s.code, s]));
  const med = copy.group('labels.medal');
  const set = (k: Kit) => bins(k, STATE_BINS);
  return chart(ctx, 'map', 'map', {
    build: tileGrid({
      tiles: ctx.tiles,
      value: (c) => byCode.get(c)?.medals ?? 0,
      bins: set,
      tip: (c) => {
        const s = byCode.get(c);
        return s ? `<b>${esc(s.name)}</b><br>${fmtN(s.medals)} ${esc(copy.t('charts.units.medals').toLowerCase())}<br>${esc(med.Gold)} ${s.g}, ${esc(med.Silver)} ${s.s}, ${esc(med.Bronze)} ${s.b}` : esc(c);
      },
    }),
    legend: (k) => binLegend(ctx, set(k)),
    onSelect: (code) => ctx.toggle('state', code),
    table: {
      caption: copy.t('page.panels.map.title'),
      columns: [col('name', copy.t('tables.place_columns.state')), col('region', copy.t('tables.place_columns.region')), col('medals', copy.t('charts.units.medals'), true), col('split', copy.t('tables.brewery_columns.medal_split'))],
      rows: list.filter((s) => s.medals).sort((a, b) => b.medals - a.medals).map((s) => ({
        key: s.code,
        sort: { name: s.name, region: s.region, medals: s.medals, split: s.medals },
        cells: { name: <Pick label={s.name} onPick={() => ctx.toggle('state', s.code)} />, region: labelOf(copy, 'region', s.region), medals: fmtN(s.medals), split: gsb(s.g, s.s, s.b) },
      })),
      initialSort: { key: 'medals', dir: 'descending' },
    },
  });
}

export function topStates(ctx: Ctx): ChartSpec {
  const { copy } = ctx;
  const list = stateList(ctx).filter((s) => s.medals).sort((a, b) => b.medals - a.medals || a.name.localeCompare(b.name)).slice(0, 20);
  const items: RankItem[] = list.map((s) => ({ name: s.code, label: s.name, value: s.medals, color: (k) => k.region[s.region] ?? k.series[4] }));
  const regions = [...new Set(list.map((s) => s.region))];
  return chart(ctx, 'map-ranked', 'map_ranked', {
    build: rankedBars({ items }),
    legend: (k) => regions.map((r) => ({ label: labelOf(copy, 'region', r), color: k.region[r] ?? k.series[4] })),
    onSelect: (code) => ctx.toggle('state', code),
    table: {
      caption: copy.t('page.panels.map_ranked.title'),
      columns: [col('name', copy.t('tables.place_columns.state')), col('region', copy.t('tables.place_columns.region')), col('medals', copy.t('charts.units.medals'), true)],
      rows: list.map((s) => ({ key: s.code, sort: { name: s.name, region: s.region, medals: s.medals }, cells: { name: <Pick label={s.name} onPick={() => ctx.toggle('state', s.code)} />, region: labelOf(copy, 'region', s.region), medals: fmtN(s.medals) } })),
      initialSort: { key: 'medals', dir: 'descending' },
    },
  });
}

const FAMILY_COLORS = [0, 1, 2, 3];
export function styleFamilies(ctx: Ctx): ChartSpec {
  const { copy } = ctx;
  const fams = new Map<string, { medals: number; cats: Map<string, number> }>();
  for (const r of ctx.rows) {
    const f = fams.get(r.style_family) ?? { medals: 0, cats: new Map() };
    f.medals += 1;
    f.cats.set(r.category_name, (f.cats.get(r.category_name) ?? 0) + 1);
    fams.set(r.style_family, f);
  }
  const list = [...fams].map(([name, f]) => ({ name, label: labelOf(copy, 'style_family', name), medals: f.medals, categories: f.cats.size, top: [...f.cats].sort((a, b) => b[1] - a[1])[0] })).sort((a, b) => b.medals - a.medals);
  const items = list.map((f, i) => ({ name: f.name, value: f.medals, color: (k: Kit) => k.series[FAMILY_COLORS[i % FAMILY_COLORS.length]], detail: '' }));
  return chart(ctx, 'by-family', 'by_family', {
    build: treemap({
      items,
      label: (i) => `${labelOf(copy, 'style_family', i.name)}\n${fmtN(i.value)}`,
      tip: (i) => {
        const f = list.find((x) => x.name === i.name)!;
        return `<b>${esc(f.label)}</b><br>${fmtN(f.medals)} ${esc(copy.t('charts.units.medals').toLowerCase())}<br>${esc(copy.t('page.panels.by_family.tip', { categories: f.categories, top: f.top[0], top_medals: f.top[1] }))}`;
      },
    }),
    onSelect: (name) => ctx.toggle('style_family', name),
    table: {
      caption: copy.t('page.panels.by_family.title'),
      columns: [col('name', copy.t('tables.medal_columns.style_family')), col('medals', copy.t('charts.units.medals'), true), col('categories', copy.t('tables.category_columns.category'), true)],
      rows: list.map((f) => ({ key: f.name, sort: { name: f.label, medals: f.medals, categories: f.categories }, cells: { name: <Pick label={f.label} onPick={() => ctx.toggle('style_family', f.name)} />, medals: fmtN(f.medals), categories: fmtN(f.categories) } })),
      initialSort: { key: 'medals', dir: 'descending' },
    },
  });
}

export function topBreweries(ctx: Ctx): ChartSpec {
  const { copy } = ctx;
  const med = copy.group('labels.medal');
  const m = new Map<string, { name: string; slug: string; g: number; s: number; b: number; pts: number }>();
  for (const r of ctx.rows) {
    const c = m.get(r.brewery_key) ?? { name: r.brewery_name, slug: r.brewery_slug, g: 0, s: 0, b: 0, pts: 0 };
    if (r.medal === 'Gold') c.g += 1; else if (r.medal === 'Silver') c.s += 1; else c.b += 1;
    c.pts += r.points;
    m.set(r.brewery_key, c);
  }
  const list = [...m.values()].sort((a, b) => b.pts - a.pts || b.g + b.s + b.b - (a.g + a.s + a.b) || a.name.localeCompare(b.name)).slice(0, 15);
  const open = (i: number) => ctx.go(paths.brewery(list[i].slug));
  return chart(ctx, 'top-breweries', 'top_breweries', {
    build: stackedBars({
      labels: list.map((b) => b.name),
      series: MEDAL_KEYS.map((k, i) => ({ name: med[k], data: list.map((b) => [b.g, b.s, b.b][i]), color: medalColor(k) })),
      totals: { values: list.map((b) => b.pts), format: (n) => copy.t('page.panels.top_breweries.total', { count: fmtN(n) }) },
      labelWidth: labelColumn(108, 168),
      minLabel: 1,
      tip: (i) => `<b>${esc(list[i].name)}</b><br>${esc(med.Gold)} ${list[i].g}, ${esc(med.Silver)} ${list[i].s}, ${esc(med.Bronze)} ${list[i].b}<br>${esc(copy.t('page.panels.top_breweries.total', { count: fmtN(list[i].pts) }))}`,
    }),
    legend: (k) => MEDAL_KEYS.map((x) => ({ label: med[x], color: k.medal[x] })),
    onSelect: (_n, i) => { if (i < list.length) open(i); },
    table: {
      caption: copy.t('page.panels.top_breweries.title'),
      columns: [col('name', copy.t('tables.brewery_columns.brewery')), col('split', copy.t('tables.brewery_columns.medal_split')), col('pts', copy.t('charts.units.points'), true)],
      rows: list.map((b) => ({ key: b.slug, sort: { name: b.name, pts: b.pts, split: b.pts }, cells: { name: <TextLink href={href(paths.brewery(b.slug))}>{b.name}</TextLink>, split: gsb(b.g, b.s, b.b), pts: fmtN(b.pts) } })),
      initialSort: { key: 'pts', dir: 'descending' },
    },
  });
}

export function byRegion(ctx: Ctx): ChartSpec {
  const { copy } = ctx;
  const list = countBy(ctx.rows, 'region');
  const items: RankItem[] = list.map(([name, value]) => ({ name, label: labelOf(copy, 'region', name), value, color: (k) => k.region[name] ?? k.series[4] }));
  return chart(ctx, 'by-region', 'by_region', {
    build: rankedBars({ items }),
    onSelect: (name) => ctx.toggle('region', name),
    table: {
      caption: copy.t('page.panels.by_region.title'),
      columns: [col('name', copy.t('tables.place_columns.region')), col('medals', copy.t('charts.units.medals'), true)],
      rows: items.map((i) => ({ key: i.name, sort: { name: i.label ?? i.name, medals: i.value }, cells: { name: <Pick label={i.label ?? i.name} onPick={() => ctx.toggle('region', i.name)} />, medals: fmtN(i.value) } })),
      initialSort: { key: 'medals', dir: 'descending' },
    },
  });
}

export function byDivision(ctx: Ctx): ChartSpec {
  const { copy } = ctx;
  const regionOf = new Map((ctx.meta.states as Meta[]).map((s) => [s.division, s.region]));
  const list = countBy(ctx.rows, 'division');
  const items: RankItem[] = list.map(([name, value]) => ({ name, label: labelOf(copy, 'division', name), value, color: (k) => k.region[regionOf.get(name)] ?? k.series[4] }));
  const regions = [...new Set(list.map(([n]) => regionOf.get(n)).filter(Boolean))] as string[];
  return chart(ctx, 'by-division', 'by_division', {
    build: rankedBars({ items }),
    legend: (k) => regions.map((r) => ({ label: labelOf(copy, 'region', r), color: k.region[r] ?? k.series[4] })),
    table: {
      caption: copy.t('page.panels.by_division.title'),
      columns: [col('name', copy.t('tables.place_columns.division')), col('region', copy.t('tables.place_columns.region')), col('medals', copy.t('charts.units.medals'), true)],
      rows: items.map((i) => ({ key: i.name, sort: { name: i.label ?? i.name, region: regionOf.get(i.name) ?? '', medals: i.value }, cells: { name: i.label ?? i.name, region: labelOf(copy, 'region', regionOf.get(i.name)), medals: fmtN(i.value) } })),
      initialSort: { key: 'medals', dir: 'descending' },
    },
  });
}

// Medals per million residents or per $100 billion of real GDP, by state, as the tile grid.
function stateRates(ctx: Ctx, field: 'per_million' | 'per_100b_gdp', id: string, key: string, unit: string): ChartSpec {
  const { copy } = ctx;
  const rates = medalRates(ctx.rows, (r) => r.state, ctx.meta.indicators?.state);
  const names = new Map((ctx.meta.states as Meta[]).map((s) => [s.state as string, s.name as string]));
  const value = (c: string) => Number((rates.get(c)?.[field] ?? 0).toFixed(2));
  const codes = Object.keys(ctx.tiles);
  const edges = rateEdges(codes.map(value));
  const set = (k: Kit) => bins(k, edges);
  const ranked = codes.filter((c) => value(c) > 0).sort((a, b) => value(b) - value(a));
  return chart(ctx, id, key, {
    values: { latest_year: ctx.rateYears.latest, data_year: ctx.rateYears.data },
    build: tileGrid({
      tiles: ctx.tiles,
      value,
      format: rate,
      bins: set,
      tip: (c) => `<b>${esc(names.get(c) ?? c)}</b><br>${rate(value(c))} ${esc(unit.toLowerCase())}<br>${fmtN(rates.get(c)?.medals ?? 0)} ${esc(copy.t('charts.units.medals').toLowerCase())}`,
    }),
    legend: (k) => binLegend(ctx, set(k), rate),
    onSelect: (code) => ctx.toggle('state', code),
    table: {
      caption: copy.t(`page.panels.${key}.title`, { latest_year: ctx.rateYears.latest, data_year: ctx.rateYears.data }),
      columns: [col('name', copy.t('tables.place_columns.state')), col('medals', copy.t('charts.units.medals'), true), col('value', unit, true)],
      rows: ranked.map((c) => ({ key: c, sort: { name: names.get(c) ?? c, medals: rates.get(c)?.medals ?? 0, value: value(c) }, cells: { name: <Pick label={names.get(c) ?? c} onPick={() => ctx.toggle('state', c)} />, medals: fmtN(rates.get(c)?.medals ?? 0), value: rate(value(c)) } })),
      initialSort: { key: 'value', dir: 'descending' },
    },
  });
}

export const perCapita = (ctx: Ctx) => stateRates(ctx, 'per_million', 'per-capita', 'per_capita', ctx.copy.t('charts.units.per_million'));
export const perGdp = (ctx: Ctx) => stateRates(ctx, 'per_100b_gdp', 'per-gdp', 'per_gdp', ctx.copy.t('charts.units.per_100b_gdp'));

function districtItems(ctx: Ctx) {
  const rates = medalRates(ctx.rows, (r) => r.fed_district, ctx.meta.indicators?.district);
  const names = new Map(ctx.rows.filter((r) => r.fed_district).map((r) => [String(r.fed_district), r.fed_district_name as string]));
  return [...rates.values()].map((x) => ({ ...x, name: names.get(x.key) ?? x.key, label: `${x.key} ${names.get(x.key) ?? ''}`.trim() })).sort((a, b) => Number(a.key) - Number(b.key));
}

export function byFedDistrict(ctx: Ctx): ChartSpec {
  const { copy } = ctx;
  const items = districtItems(ctx).sort((a, b) => b.medals - a.medals);
  const approx = ctx.rows.filter((r) => /approximation/.test(r.fed_district_method ?? '')).length;
  return chart(ctx, 'by-fed-district', 'by_fed_district', {
    build: rankedBars({ items: items.map((d) => ({ name: d.name, label: d.label, value: d.medals, color: (k: Kit) => k.series[0] })), labelWidth: labelColumn(120, 190) }),
    onSelect: (name) => ctx.toggle('fed_district_name', name),
    note: approx ? copy.t(approx === 1 ? 'page.panels.by_fed_district.note_one' : 'page.panels.by_fed_district.note_many', { count: fmtN(approx) }) : undefined,
    table: {
      caption: copy.t('page.panels.by_fed_district.title'),
      columns: [col('name', copy.t('tables.place_columns.district')), col('medals', copy.t('charts.units.medals'), true)],
      rows: items.map((d) => ({ key: d.key, sort: { name: d.label, medals: d.medals }, cells: { name: <Pick label={d.label} onPick={() => ctx.toggle('fed_district_name', d.name)} />, medals: fmtN(d.medals) } })),
      initialSort: { key: 'medals', dir: 'descending' },
    },
  });
}

export function districtRates(ctx: Ctx): ChartSpec {
  const { copy } = ctx;
  const items = districtItems(ctx).map((d) => ({ ...d, pm: Number(d.per_million.toFixed(2)), pg: Number(d.per_100b_gdp.toFixed(2)) })).sort((a, b) => b.pm - a.pm);
  return chart(ctx, 'district-rates', 'district_rates', {
    build: lollipop({ items: items.map((d) => ({ name: d.name, label: d.label, value: d.pm, tip: `<b>${esc(d.label)}</b><br>${d.pm} ${esc(copy.t('charts.units.per_million').toLowerCase())}<br>${fmtN(d.medals)} ${esc(copy.t('charts.units.medals').toLowerCase())}` })), format: rate, labelWidth: labelColumn(120, 190) }),
    onSelect: (name) => ctx.toggle('fed_district_name', name),
    note: copy.t('page.panels.district_rates.note'),
    table: {
      caption: copy.t('page.panels.district_rates.title'),
      columns: [col('name', copy.t('tables.place_columns.district')), col('medals', copy.t('charts.units.medals'), true), col('pm', copy.t('charts.units.per_million'), true), col('pg', copy.t('tables.place_columns.per_100b_gdp_estimate'), true)],
      rows: items.map((d) => ({ key: d.key, sort: { name: d.label, medals: d.medals, pm: d.pm, pg: d.pg }, cells: { name: <Pick label={d.label} onPick={() => ctx.toggle('fed_district_name', d.name)} />, medals: fmtN(d.medals), pm: rate(d.pm), pg: rate(d.pg) } })),
      initialSort: { key: 'pm', dir: 'descending' },
    },
  });
}

function categoryEntries(ctx: Ctx) {
  const m = new Map<string, { name: string; value: number; special: boolean; years: Set<number> }>();
  for (const r of ctx.rows) {
    if (!r.entries) continue;
    const c = m.get(r.category_name) ?? { name: r.category_name, value: 0, special: Boolean(r.special), years: new Set<number>() };
    c.value = Math.max(c.value, r.entries);
    c.years.add(r.year);
    m.set(r.category_name, c);
  }
  return [...m.values()].sort((a, b) => b.value - a.value);
}

const yearList = (years: Set<number>) => [...years].sort().join(', ');

export function entrants(ctx: Ctx): ChartSpec {
  const { copy } = ctx;
  const special = copy.t('labels.category_pill.special_short');
  const items = categoryEntries(ctx).slice(0, 25);
  const show = (c: { name: string; special: boolean }) => (c.special ? `${c.name} (${special})` : c.name);
  return chart(ctx, 'entrants', 'entrants', {
    build: lollipop({ items: items.map((c) => ({ name: c.name, label: show(c), value: c.value })) }),
    onSelect: (name) => ctx.toggle('category_name', name),
    note: copy.t('page.panels.entrants.note'),
    table: {
      caption: copy.t('page.panels.entrants.title'),
      columns: [col('name', copy.t('tables.medal_columns.category')), col('value', copy.t('charts.units.entries'), true), col('years', copy.t('tables.category_columns.years'))],
      rows: items.map((c) => ({ key: c.name, sort: { name: c.name, value: c.value, years: yearList(c.years) }, cells: { name: <Pick label={show(c)} onPick={() => ctx.toggle('category_name', c.name)} />, value: fmtN(c.value), years: yearList(c.years) } })),
      initialSort: { key: 'value', dir: 'descending' },
    },
  });
}

function oddsOf(rows: MedalRow[]) {
  const m = new Map<string, { label: string; entries: number; medals: number; seen: Set<number> }>();
  let missing = 0;
  for (const x of rows) {
    if (!x.entries || !x.category_medals) { missing += 1; continue; }
    const c = m.get(x.category_name) ?? { label: x.category_name, entries: 0, medals: 0, seen: new Set<number>() };
    if (!c.seen.has(x.year)) { c.seen.add(x.year); c.entries += x.entries; c.medals += x.category_medals; }
    m.set(x.category_name, c);
  }
  const list = [...m.values()].map((c) => ({ ...c, value: Number((c.entries / c.medals).toFixed(1)) })).sort((a, b) => b.value - a.value);
  return { list, missing };
}

export function entryOdds(ctx: Ctx): ChartSpec | { empty: string } {
  const { copy } = ctx;
  const { list, missing } = oddsOf(ctx.rows);
  if (!list.length) return { empty: copy.t('page.panels.entry_odds.empty') };
  const items = list.slice(0, 20);
  const note = `${copy.t('page.panels.entry_odds.note')}${missing ? ` ${copy.t(missing === 1 ? 'page.panels.entry_odds.missing_one' : 'page.panels.entry_odds.missing_many', { count: fmtN(missing) })}` : ''}`;
  return chart(ctx, 'entry-odds', 'entry_odds', {
    build: lollipop({ items: items.map((c) => ({ name: c.label, value: c.value })), format: (n) => String(n) }),
    onSelect: (name) => ctx.toggle('category_name', name),
    note,
    table: {
      caption: copy.t('page.panels.entry_odds.title'),
      columns: [col('name', copy.t('tables.medal_columns.category')), col('value', copy.t('charts.units.entries_per_medal'), true), col('entries', copy.t('charts.units.entries'), true), col('medals', copy.t('charts.units.medals'), true), col('years', copy.t('tables.category_columns.years'))],
      rows: list.map((c) => ({ key: c.label, sort: { name: c.label, value: c.value, entries: c.entries, medals: c.medals, years: yearList(c.seen) }, cells: { name: <Pick label={c.label} onPick={() => ctx.toggle('category_name', c.label)} />, value: String(c.value), entries: fmtN(c.entries), medals: fmtN(c.medals), years: yearList(c.seen) } })),
      initialSort: { key: 'value', dir: 'descending' },
    },
  });
}

// Entries per medal for each category in each year of the record in view, for the categories offered in
// at least three of them.
export function entryOddsHeat(ctx: Ctx): ChartSpec | null {
  const { copy } = ctx;
  const years = ctx.years.filter((y) => ctx.meta.coverage?.[y] === 'complete');
  const cats = new Map<string, Map<number, { entries: number; medals: number }>>();
  for (const r of ctx.rows) {
    if (!r.entries || !r.category_medals || !years.includes(r.year)) continue;
    const per = cats.get(r.category_name) ?? new Map();
    per.set(r.year, { entries: r.entries, medals: r.category_medals });
    cats.set(r.category_name, per);
  }
  const list = [...cats].filter(([, per]) => per.size >= Math.min(3, years.length)).map(([name, per]) => {
    const e = [...per.values()].reduce((s, v) => s + v.entries, 0);
    const m = [...per.values()].reduce((s, v) => s + v.medals, 0);
    return { name, odds: e / m, byYear: years.map((y) => (per.has(y) ? Number((per.get(y)!.entries / per.get(y)!.medals).toFixed(1)) : null)) };
  }).sort((a, b) => b.odds - a.odds).slice(0, 20);
  if (!list.length) return null;
  const set = (k: Kit) => bins(k, [0, 15, 30, 45, 70, 100], [k.seq[0], k.seq[1], k.seq[2], k.seq[4], k.seq[5], k.seq[6]]);
  return chart(ctx, 'entry-odds-heat', 'entry_odds_heat', {
    build: heatmap({ rows: list.map((c) => c.name), cols: years.map(String), cells: list.map((c) => c.byYear), bins: set, tip: (r, c, v) => `<b>${esc(list[r].name)}</b><br>${years[c]}: ${v} ${esc(copy.t('charts.units.entries_per_medal').toLowerCase())}` }),
    legend: (k) => binLegend(ctx, set(k)),
    table: {
      caption: copy.t('page.panels.entry_odds_heat.title'),
      columns: [col('name', copy.t('tables.medal_columns.category')), ...years.map((y) => col(String(y), String(y), true))],
      rows: list.map((c) => ({ key: c.name, sort: { name: c.name, ...Object.fromEntries(years.map((y, i) => [String(y), c.byYear[i]])) }, cells: { name: c.name, ...Object.fromEntries(years.map((y, i) => [String(y), c.byYear[i] === null ? '' : String(c.byYear[i])])) } })),
      initialSort: { key: years.length ? String(years[years.length - 1]) : 'name', dir: 'descending' },
    },
  });
}

export function specialShare(ctx: Ctx): ChartSpec {
  const { copy } = ctx;
  const data = ctx.years.map((y) => {
    const yr = ctx.rows.filter((r) => r.year === y);
    return { year: y, classic: yr.filter((r) => !r.special).length, special: yr.filter((r) => r.special).length };
  });
  return chart(ctx, 'special-share', 'special_share', {
    build: stackedBars({
      labels: data.map((d) => yearLabel(ctx, d.year)),
      percent: true,
      series: [
        { name: copy.t('charts.legend.classic'), data: data.map((d) => d.classic), color: (k) => k.series[0] },
        { name: copy.t('charts.legend.special'), data: data.map((d) => d.special), color: (k) => k.series[1] },
      ],
      tip: (i) => `<b>${esc(yearName(ctx, data[i].year))}</b><br>${esc(copy.t('charts.legend.classic'))}: ${data[i].classic}<br>${esc(copy.t('charts.legend.special'))}: ${data[i].special}`,
    }),
    legend: (k) => [{ label: copy.t('charts.legend.classic'), color: k.series[0] }, { label: copy.t('charts.legend.special'), color: k.series[1] }],
    table: {
      caption: copy.t('page.panels.special_share.title'),
      columns: [col('year', copy.t('tables.medal_columns.year')), col('classic', copy.t('charts.legend.classic'), true), col('special', copy.t('charts.legend.special'), true)],
      rows: data.map((d) => ({ key: String(d.year), sort: { year: d.year, classic: d.classic, special: d.special }, cells: { year: String(d.year), classic: fmtN(d.classic), special: fmtN(d.special) } })),
      initialSort: { key: 'year', dir: 'ascending' },
    },
  });
}

export function entriesVsBreweries(ctx: Ctx): ChartSpec {
  const { copy } = ctx;
  const m = new Map<string, { name: string; x: number; b: Set<string> }>();
  for (const r of ctx.rows) {
    if (!r.entries) continue;
    const c = m.get(r.category_name) ?? { name: r.category_name, x: 0, b: new Set<string>() };
    c.x = Math.max(c.x, r.entries);
    c.b.add(r.brewery_key);
    m.set(r.category_name, c);
  }
  const points = [...m.values()].map((c) => ({ name: c.name, x: c.x, y: c.b.size }));
  const named = new Set([...points].sort((a, b) => b.y - a.y).slice(0, 4).concat([...points].sort((a, b) => b.x - a.x).slice(0, 4)).map((p) => p.name));
  const xName = copy.t('charts.units.entries');
  const yName = copy.t('charts.units.breweries');
  return chart(ctx, 'entries-vs-breweries', 'entries_vs_breweries', {
    build: scatter({ points, xName, yName, named, tip: (name, x, y) => esc(copy.t('charts.tooltip.scatter', { name, x: fmtN(x), y: fmtN(y) })) }),
    onSelect: (name) => ctx.toggle('category_name', name),
    table: {
      caption: copy.t('page.panels.entries_vs_breweries.title'),
      columns: [col('name', copy.t('tables.medal_columns.category')), col('x', xName, true), col('y', yName, true)],
      rows: points.map((p) => ({ key: p.name, sort: { name: p.name, x: p.x, y: p.y }, cells: { name: <Pick label={p.name} onPick={() => ctx.toggle('category_name', p.name)} />, x: fmtN(p.x), y: fmtN(p.y) } })),
      initialSort: { key: 'x', dir: 'descending' },
    },
  });
}

// ---------- one brewery ----------

const SHORT_STATUS = (copy: Copy, status: string) => labelOf(copy, 'trend_status_short', status);

export function breweryTrend(ctx: Ctx): ChartSpec | null {
  const { copy, brewery: b } = ctx;
  if (!b) return null;
  const med = copy.group('labels.medal');
  const years = new Set(ctx.years);
  const trend = (b.trend as Meta[]).filter((t) => years.has(t.year));
  const note = (t: Meta) => { const s = SHORT_STATUS(copy, t.status); return s ? `\n${s}` : ''; };
  return chart(ctx, 'brewery-trend', 'brewery_trend', {
    values: { brewery_name: b.name },
    build: stackedBars({
      labels: trend.map((t) => `${t.year}${note(t)}`),
      series: MEDAL_KEYS.map((m, k) => ({ name: med[m], data: trend.map((t) => [t.gold, t.silver, t.bronze][k]), color: medalColor(m) })),
      totals: { values: trend.map((t) => t.total), format: fmtN },
      minLabel: 1,
      tip: (i) => `<b>${trend[i].year}</b> ${esc(labelOf(copy, 'trend_status', trend[i].status))}<br>${esc(med.Gold)} ${trend[i].gold}, ${esc(med.Silver)} ${trend[i].silver}, ${esc(med.Bronze)} ${trend[i].bronze}`,
    }),
    legend: (k) => MEDAL_KEYS.map((m) => ({ label: med[m], color: k.medal[m] })),
    table: {
      caption: copy.t('page.panels.brewery_trend.title'),
      columns: [col('year', copy.t('tables.medal_columns.year')), col('split', copy.t('tables.brewery_columns.medal_split')), col('status', copy.t('tables.medal_columns.notes'))],
      rows: trend.map((t) => ({ key: String(t.year), sort: { year: t.year, split: t.total, status: t.status }, cells: { year: String(t.year), split: gsb(t.gold, t.silver, t.bronze), status: labelOf(copy, 'trend_status', t.status) } })),
      initialSort: { key: 'year', dir: 'ascending' },
    },
  });
}

function breweryStack(ctx: Ctx, id: string, key: string, field: (r: MedalRow) => string): ChartSpec | null {
  const { copy, brewery: b } = ctx;
  if (!b) return null;
  const med = copy.group('labels.medal');
  const rows = ctx.all.filter((r) => r.brewery_key === b.key);
  const groups = new Map<string, MedalRow[]>();
  for (const r of rows) groups.set(field(r), [...(groups.get(field(r)) ?? []), r]);
  const list = [...groups].map(([name, list]) => ({ name, list, g: split(list)[0], s: split(list)[1], b: split(list)[2], total: list.length })).sort((a, c) => c.total - a.total || a.name.localeCompare(c.name));
  return chart(ctx, id, key, {
    values: { brewery_name: b.name },
    build: stackedBars({
      labels: list.map((c) => c.name),
      series: MEDAL_KEYS.map((m, k) => ({ name: med[m], data: list.map((c) => [c.g, c.s, c.b][k]), color: medalColor(m) })),
      totals: { values: list.map((c) => c.total), format: fmtN },
      labelWidth: labelColumn(112, 230),
      minLabel: 1,
      tip: (i) => `<b>${esc(list[i].name)}</b><br>${esc(med.Gold)} ${list[i].g}, ${esc(med.Silver)} ${list[i].s}, ${esc(med.Bronze)} ${list[i].b}`,
    }),
    legend: (k) => MEDAL_KEYS.map((m) => ({ label: med[m], color: k.medal[m] })),
    table: {
      caption: copy.t(`page.panels.${key}.title`),
      columns: [col('name', copy.t(key === 'brewery_categories' ? 'tables.medal_columns.category' : 'tables.medal_columns.location_credited')), col('split', copy.t('tables.brewery_columns.medal_split')), col('total', copy.t('charts.units.medals'), true)],
      rows: list.map((c) => ({ key: c.name, sort: { name: c.name, split: c.total, total: c.total }, cells: { name: c.name, split: gsb(c.g, c.s, c.b), total: fmtN(c.total) } })),
      initialSort: { key: 'total', dir: 'descending' },
    },
  });
}

export const breweryCategories = (ctx: Ctx) => breweryStack(ctx, 'brewery-categories', 'brewery_categories', (r) => r.category_name);
export const breweryLocations = (ctx: Ctx) => breweryStack(ctx, 'brewery-locations', 'brewery_locations', (r) => r.brewery_location || `${r.city}, ${r.state}`);

// ---------- ownership and economics ----------

export function ownershipShare(ctx: Ctx): ChartSpec {
  const { copy } = ctx;
  const list = countBy(ctx.rows, 'ownership_type');
  const total = list.reduce((s, [, n]) => s + n, 0);
  const tones = (k: Kit) => [...k.series, k.seq[2], k.seq[4], k.seq[6]];
  const label = (v: string) => labelOf(copy, 'ownership_type', v);
  const byLabel = new Map(list.map(([v]) => [label(v), v]));
  return chart(ctx, 'ownership-share', 'ownership_share', {
    build: stackedBars({
      labels: [copy.t('charts.units.medals')],
      percent: true,
      labelWidth: labelColumn(64, 80),
      series: list.map(([v, n], i) => ({ name: label(v), data: [n], color: (k: Kit) => tones(k)[i % tones(k).length] })),
      tip: () => list.map(([v, n]) => `${esc(label(v))}: ${fmtN(n)}`).join('<br>'),
    }),
    legend: (k) => list.map(([v, n], i) => ({ label: `${label(v)} (${fmtN(n)})`, color: tones(k)[i % tones(k).length] })),
    onSelect: (_n, _i, series) => { const v = byLabel.get(series); if (v) ctx.toggle('ownership_type', v); },
    table: {
      caption: copy.t('page.panels.ownership_share.title'),
      columns: [col('name', copy.t('tables.medal_columns.ownership')), col('value', copy.t('charts.units.medals'), true), col('share', '%', true)],
      rows: list.map(([v, n]) => ({ key: v, sort: { name: label(v), value: n, share: n }, cells: { name: <Pick label={label(v)} onPick={() => ctx.toggle('ownership_type', v)} />, value: fmtN(n), share: `${((n / total) * 100).toFixed(1)}%` } })),
      initialSort: { key: 'value', dir: 'descending' },
    },
  });
}

export function parents(ctx: Ctx): ChartSpec | { empty: string } {
  const { copy } = ctx;
  const list = countBy(ctx.rows.filter((r) => r.parent), 'parent');
  if (!list.length) return { empty: copy.t('page.panels.parents.empty') };
  const items: RankItem[] = list.map(([name, value]) => ({ name, value, color: (k) => k.series[1] }));
  return chart(ctx, 'parents', 'parents', {
    build: rankedBars({ items, labelWidth: labelColumn(112, 190) }),
    table: {
      caption: copy.t('page.panels.parents.title'),
      columns: [col('name', copy.t('page.panels.parents.title')), col('value', copy.t('charts.units.medals'), true)],
      rows: items.map((i) => ({ key: i.name, sort: { name: i.name, value: i.value }, cells: { name: i.name, value: fmtN(i.value) } })),
      initialSort: { key: 'value', dir: 'descending' },
    },
  });
}

export function revenueByBrewery(ctx: Ctx): ChartSpec {
  const { copy } = ctx;
  const keys = new Set(ctx.rows.map((r) => r.brewery_key));
  const list = ctx.breweries.filter((b) => keys.has(b.key)).sort((a, b) => b.estimate.revenue_usd - a.estimate.revenue_usd).slice(0, 15);
  const money = (n: number) => `$${compact(n)}`;
  return chart(ctx, 'revenue-by-brewery', 'revenue', {
    build: lollipop({ items: list.map((b) => ({ name: b.slug, label: b.name, value: b.estimate.revenue_usd })), format: money, color: (k) => k.series[2], labelWidth: labelColumn(112, 220) }),
    onSelect: (slug) => ctx.go(paths.brewery(slug)),
    table: {
      caption: copy.t('page.panels.revenue.title'),
      columns: [col('name', copy.t('tables.brewery_columns.brewery')), col('value', copy.t('charts.units.revenue'), true), col('basis', copy.t('page.panels.revenue.basis_column'))],
      rows: list.map((b) => ({ key: b.key, sort: { name: b.name, value: b.estimate.revenue_usd, basis: b.estimate.basis }, cells: { name: <TextLink href={href(paths.brewery(b.slug))}>{b.name}</TextLink>, value: money(b.estimate.revenue_usd), basis: labelOf(copy, 'estimate_basis', b.estimate.basis) } })),
      initialSort: { key: 'value', dir: 'descending' },
    },
  });
}

