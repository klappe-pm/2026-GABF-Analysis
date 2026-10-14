'use client';

// The tables under the charts: the medals in view, the financials by brewery, and the controls by state or
// district. They follow the table rules: left aligned, no wrapping, a bold header, scrolling inside their
// own box. A long table shows 25 rows and offers more.
import { useMemo, useState } from 'react';
import { Button } from '@/components/Button';
import { DataTable, type Column, type Row } from '@/components/DataTable';
import { EstimateTooltip } from '@/components/EstimateTooltip';
import { MedalMark, type MedalName } from '@/components/MedalMark';
import { Select } from '@/components/Select';
import { TextLink } from '@/components/TextLink';
import { href, paths } from '@/lib/href';
import { CONTROL_FIELDS, latestValue, medalRates, sortByLabel } from '@/lib/models/rates.mjs';
import { fmtN } from './charts';
import type { Copy } from './copy';
import { compact, labelOf, type Brewery, type MedalRow, type Meta } from './panels';

const PAGE = 25;
const stemOf = (r: MedalRow) => (r.beer_profile ? String(r.beer_profile).split('/').filter(Boolean).at(-1) : null);
const abvText = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1).replace(/\.0$/, '')}%`;
const MEDAL_RANK: Record<string, number> = { Gold: 0, Silver: 1, Bronze: 2 };

function Pager({ copy, shown, total, onMore, onAll }: { copy: Copy; shown: number; total: number; onMore: () => void; onAll: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="type-body-medium tabular-nums text-on-surface-variant">{copy.t('tables.pager.showing', { shown: fmtN(shown), total: fmtN(total) })}</p>
      {shown < total ? (
        <>
          <Button onClick={onMore}><span style={{ fontFamily: 'var(--md-ref-typeface-plain)' }}>{copy.t('tables.pager.show_more', { count: Math.min(100, total - shown) })}</span></Button>
          <Button variant="quiet" onClick={onAll}>{copy.t('tables.pager.show_all')}</Button>
        </>
      ) : null}
    </div>
  );
}

export function ResultsTable({ rows, copy, caption }: { rows: MedalRow[]; copy: Copy; caption: string }) {
  const [limit, setLimit] = useState(PAGE);
  const sorted = useMemo(() => [...rows].sort((a, b) => b.year - a.year || String(a.category_name).localeCompare(String(b.category_name)) || (MEDAL_RANK[a.medal] ?? 9) - (MEDAL_RANK[b.medal] ?? 9)), [rows]);
  const med = copy.group('labels.medal');
  const none = <span className="text-on-surface-variant">{copy.t('states.gaps.not_defined')}</span>;
  const c = (key: string) => copy.t(`tables.medal_columns.${key}`);
  const columns: Column[] = [
    { key: 'year', label: c('year'), sortable: true },
    { key: 'medal', label: c('medal'), sortable: true },
    { key: 'beer', label: c('beer'), sortable: true },
    { key: 'brewery', label: c('brewery'), sortable: true },
    { key: 'city', label: c('city'), sortable: true },
    { key: 'category', label: c('category'), sortable: true },
    { key: 'entries', label: c('entrants'), numeric: true, sortable: true },
    { key: 'family', label: c('style_family'), sortable: true },
    { key: 'abv', label: c('abv'), numeric: true, sortable: true },
    { key: 'ibu', label: copy.t('page.chart.ibu'), numeric: true, sortable: true },
    { key: 'ownership', label: c('ownership'), sortable: true },
    { key: 'distribution', label: c('distribution'), sortable: true },
  ];
  const table: Row[] = sorted.slice(0, limit).map((r, i) => {
    const stem = stemOf(r);
    return {
      key: `${r.year}-${r.category_slug}-${r.medal}-${r.brewery_key}-${i}`,
      sort: { year: r.year, medal: MEDAL_RANK[r.medal] ?? 9, beer: r.beer_name, brewery: r.brewery_name, city: `${r.city}, ${r.state}`, category: r.category_name, entries: r.entries, family: r.style_family, abv: r.abv, ibu: r.ibu, ownership: r.ownership_type, distribution: r.distribution_channel },
      cells: {
        year: String(r.year),
        medal: <span className="inline-flex items-center gap-2"><MedalMark medal={r.medal as MedalName} size="sm" title={med[r.medal] ?? r.medal} />{med[r.medal] ?? r.medal}</span>,
        beer: stem ? <TextLink href={href(paths.beer(r.year, stem))}>{r.beer_name}</TextLink> : r.beer_name,
        brewery: <>
          <TextLink href={href(paths.brewery(r.brewery_slug))}>{r.brewery_name}</TextLink>
          {r.brewery_location ? <span className="text-on-surface-variant"> ({r.brewery_location})</span> : null}
        </>,
        city: `${r.city}, ${r.state}`,
        category: <>
          <TextLink href={href(paths.category(r.category_slug))}>{r.category_name}</TextLink>
          {r.special ? <span className="text-on-surface-variant"> ({copy.t('labels.category_pill.special_short')})</span> : null}
        </>,
        entries: r.entries ? fmtN(r.entries) : '',
        family: labelOf(copy, 'style_family', r.style_family),
        abv: r.abv === null || r.abv === undefined ? none : abvText(r.abv),
        ibu: r.ibu === null || r.ibu === undefined ? none : String(r.ibu),
        ownership: <>{labelOf(copy, 'ownership_type', r.ownership_type)}{r.parent ? ` (${r.parent})` : ''}</>,
        distribution: labelOf(copy, 'distribution_channel', r.distribution_channel),
      },
    };
  });
  return (
    <div className="flex flex-col gap-3">
      <DataTable caption={caption} sortHint={copy.t('tables.sorting.hint')} columns={columns} rows={table} scroll={false} />
      <Pager copy={copy} shown={Math.min(limit, sorted.length)} total={sorted.length} onMore={() => setLimit(limit + 100)} onAll={() => setLimit(Infinity)} />
    </div>
  );
}

type Explain = { text?: Record<string, string> };

function Est({ id, metric, label, ex, copy, methodLabel }: { id: string; metric: string; label: string; ex: Explain | undefined; copy: Copy; methodLabel: string }) {
  return (
    <EstimateTooltip
      id={`est-${id.replace(/[^a-z0-9]+/gi, '-')}-${metric}`}
      marker={copy.t('states.estimates.marker')}
      label={`${label}: ${copy.t('states.estimates.short')}`}
      explanation={ex?.text?.[metric] ?? copy.t('states.estimates.explanation')}
      linkText={methodLabel}
    />
  );
}

export function FinancialTable({ breweries, copy, estimates, methodLabel, caption }: { breweries: Brewery[]; copy: Copy; estimates: Record<string, Explain> | null; methodLabel: string; caption: string }) {
  const [limit, setLimit] = useState(PAGE);
  const list = useMemo(() => [...breweries].sort((a, b) => b.financials.arr_usd - a.financials.arr_usd), [breweries]);
  const col = (key: string) => copy.t(`page.economics.columns.${key}`);
  const columns: Column[] = [
    { key: 'name', label: col('brewery'), sortable: true },
    { key: 'type', label: col('type'), sortable: true },
    { key: 'barrels', label: col('barrels'), numeric: true, sortable: true },
    { key: 'arr', label: col('arr'), numeric: true, sortable: true },
    { key: 'gm', label: col('gross_margin'), numeric: true, sortable: true },
    { key: 'ebitda', label: col('ebitda'), numeric: true, sortable: true },
    { key: 'channel', label: col('distribution'), sortable: true },
    { key: 'ownership', label: col('ownership'), sortable: true },
    { key: 'basis', label: col('basis'), sortable: true },
  ];
  const pct = (x: number) => Math.round(x * 100);
  const rows: Row[] = list.slice(0, limit).map((b) => {
    const ex = estimates?.[b.key];
    const mark = (metric: string, label: string) => <> <Est id={b.key} metric={metric} label={label} ex={ex} copy={copy} methodLabel={methodLabel} /></>;
    return {
      key: b.key,
      sort: { name: b.name, type: b.brewery_type, barrels: b.estimate.barrels, arr: b.financials.arr_usd, gm: b.financials.gross_margin, ebitda: b.financials.ebitda_usd, channel: b.distribution_channel, ownership: b.ownership?.type ?? '', basis: b.estimate.basis },
      cells: {
        name: <TextLink href={href(paths.brewery(b.slug))}>{b.name}</TextLink>,
        type: labelOf(copy, 'brewery_type', b.brewery_type),
        barrels: <>{compact(b.estimate.barrels)}{b.estimate.basis === 'reported' ? null : mark('barrels', col('barrels'))}</>,
        arr: <>{`$${compact(b.financials.arr_usd)}`}{mark('arr', col('arr'))}</>,
        gm: <>{`${pct(b.financials.gross_margin)}%`}{mark('gross_margin', col('gross_margin'))}</>,
        ebitda: <>{copy.t('page.economics.columns.ebitda_value', { ebitda: `$${compact(b.financials.ebitda_usd)}`, low: pct(b.financials.ebitda_margin_low), high: pct(b.financials.ebitda_margin_high) })}{mark('ebitda', col('ebitda'))}</>,
        channel: labelOf(copy, 'distribution_channel', b.distribution_channel || 'unknown'),
        ownership: b.ownership ? `${labelOf(copy, 'ownership_type', b.ownership.type)}${b.ownership.parent ? ` (${b.ownership.parent})` : ''}` : labelOf(copy, 'ownership_type', 'unlisted'),
        basis: labelOf(copy, 'estimate_basis', b.estimate.basis),
      },
    };
  });
  return (
    <div className="flex flex-col gap-3">
      <DataTable caption={caption} sortHint={copy.t('tables.sorting.hint')} columns={columns} rows={rows} scroll={false} />
      <Pager copy={copy} shown={Math.min(limit, list.length)} total={list.length} onMore={() => setLimit(limit + 100)} onAll={() => setLimit(Infinity)} />
    </div>
  );
}

export function ControlsTable({ rows, meta, copy, rateYears }: { rows: MedalRow[]; meta: Meta; copy: Copy; rateYears: { latest: number; data: number } }) {
  const [level, setLevel] = useState<'state' | 'district'>('district');
  const ind = meta.indicators ?? { state: {}, district: {} };
  const places = useMemo(() => {
    if (level === 'district') {
      const rates = medalRates(rows, (r) => r.fed_district, ind.district);
      const names = new Map(rows.filter((r) => r.fed_district).map((r) => [String(r.fed_district), r.fed_district_name as string]));
      return [...rates.values()].map((x) => ({ key: x.key, name: `${x.key} ${names.get(x.key) ?? ''}`.trim(), x, series: ind.district[x.key] ?? {} }));
    }
    const rates = medalRates(rows, (r) => r.state, ind.state);
    const states = new Map((meta.states as Meta[]).map((s) => [s.state as string, s.name as string]));
    return [...rates.values()].map((x) => ({ key: x.key, name: states.get(x.key) ?? x.key, x, series: ind.state[x.key] ?? {} }));
  }, [rows, level, ind.district, ind.state, meta.states]);
  const list = sortByLabel(places, (p) => p.name).sort((a, b) => b.x.per_million - a.x.per_million);
  const fields = level === 'district' ? CONTROL_FIELDS.filter((f) => f.key === 'gdp_per_capita_real') : CONTROL_FIELDS;
  const indicator = (key: string) => (key === 'gdp_per_capita_real' && level === 'district' ? copy.t('labels.indicator.gdp_per_capita_real_latest', { year: rateYears.data }) : copy.t(`labels.indicator.${key}`));
  const columns: Column[] = [
    { key: 'name', label: level === 'district' ? copy.t('tables.place_columns.district') : copy.t('tables.place_columns.state'), sortable: true },
    { key: 'medals', label: copy.t('tables.place_columns.medals'), numeric: true, sortable: true },
    { key: 'pm', label: copy.t('tables.place_columns.per_million'), numeric: true, sortable: true },
    { key: 'pg', label: copy.t(level === 'district' ? 'tables.place_columns.per_100b_gdp_estimate' : 'tables.place_columns.per_100b_gdp'), numeric: true, sortable: true },
    ...fields.map((f) => ({ key: f.key, label: indicator(f.key), numeric: true, sortable: true })),
  ];
  const table: Row[] = list.map((p) => {
    const values = Object.fromEntries(fields.map((f) => [f.key, latestValue(p.series[f.key])]));
    return {
      key: p.key,
      sort: { name: p.name, medals: p.x.medals, pm: p.x.per_million, pg: p.x.per_100b_gdp, ...values },
      cells: {
        name: p.name,
        medals: fmtN(p.x.medals),
        pm: p.x.per_million.toFixed(2),
        pg: p.x.per_100b_gdp.toFixed(2),
        ...Object.fromEntries(fields.map((f) => [f.key, values[f.key] === null ? '' : (values[f.key] as number).toLocaleString('en-US', { maximumFractionDigits: f.digits, minimumFractionDigits: f.digits })])),
      },
    };
  });
  const options = [{ value: 'district', label: copy.t('page.geography.controls_districts') }, { value: 'state', label: copy.t('page.geography.controls_states') }];
  const caption = copy.t('page.geography.controls_title');
  return (
    <div className="flex flex-col gap-3">
      <div className="max-w-xs">
        <Select id="controls-level" label={copy.t('page.geography.controls_rows')} options={options} value={level} onValueChange={(v) => setLevel(v === 'state' ? 'state' : 'district')} />
      </div>
      <DataTable caption={caption} sortHint={copy.t('tables.sorting.hint')} columns={columns} rows={table} scroll={false} initialSort={{ key: 'pm', dir: 'descending' }} />
      <p className="type-body-small max-w-measure text-on-surface-variant">{copy.t('page.geography.controls_note')}</p>
    </div>
  );
}
