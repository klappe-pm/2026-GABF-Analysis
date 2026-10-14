// The written findings of the analysis pages. Each finding is a copy document in
// .docs/content-management-system/analysis/ whose {{token}} placeholders are computed here from the dataset, over the
// complete official years (the filter's default). A token the data cannot give is null: the paragraph that needs it
// is returned as a gap naming the missing figures, never as a guess.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { applyFilters } from '../filter-model.mjs';
import { REPO, site } from '../site-model.mjs';
import { reportMeta, reportRows } from './analysis.mjs';
import { aggregateBreweries, oddsItems, stateRollup } from './analysis-calc.mjs';

export const FINDINGS = [
  { name: 'concentration-of-medals', reports: ['top-breweries'] },
  { name: 'first-time-medalists', reports: [] },
  { name: 'medal-odds-by-category', reports: ['top-categories'] },
  { name: 'per-capita-and-per-gdp-leaders', reports: ['by-state'] },
  { name: 'style-trends', reports: ['trends'] },
];

const percent = (n, total) => (total ? `${Math.round((100 * n) / total)} percent` : null);
const one = (n) => (Number.isFinite(n) ? (Math.round(n * 10) / 10).toFixed(1) : null);
const range = (years) => (years.length ? (years[0] === years.at(-1) ? String(years[0]) : `${years[0]} to ${years.at(-1)}`) : null);
const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

function tokenValues() {
  const rows = applyFilters(reportRows(['entries', 'category_medals', 'points']), {});
  const years = [...new Set(rows.map((r) => r.year))].sort((a, b) => a - b);
  const yearRange = range(years);
  const latest = years.at(-1) ?? null;
  const first = years[0] ?? null;

  // Concentration of medals
  const breweries = aggregateBreweries(rows).sort((a, b) => b.medals - a.medals || a.name.localeCompare(b.name));
  const decile = Math.max(1, Math.ceil(breweries.length / 10));
  const topDecile = breweries.slice(0, decile).reduce((n, b) => n + b.medals, 0);
  const concentration = {
    year_range: yearRange,
    brewery_count: breweries.length ? breweries.length.toLocaleString('en-US') : null,
    medal_count: rows.length ? rows.length.toLocaleString('en-US') : null,
    top_decile_share: percent(topDecile, rows.length),
    single_medal_share: percent(breweries.filter((b) => b.medals === 1).length, breweries.length),
    top_brewery: breweries[0]?.name ?? null,
    top_brewery_medals: breweries[0]?.medals ?? null,
  };

  // First time medalists, for the latest listed winners year
  const { ds } = site();
  const year = Math.max(...ds.years);
  const status = [...ds.firstTime.status.values()];
  const yearRows = ds.results.filter((r) => r.year === year);
  const firstKeys = new Set([...ds.firstTime.status].filter(([, s]) => s === 'new').map(([k]) => k));
  const firstRows = yearRows.filter((r) => firstKeys.has(r.brewery_key));
  const completeYears = ds.years.filter((y) => ds.coverage[y] === 'complete');
  const firstTime = {
    year,
    first_time_medalist_count: status.filter((s) => s === 'new').length,
    first_time_medal_count: firstRows.length,
    year_medal_count: yearRows.length || null,
    first_time_share: percent(firstRows.length, yearRows.length),
    first_time_gold_count: firstRows.filter((r) => r.medal === 'Gold').length,
    complete_record_count: status.filter((s) => s === 'new-complete').length,
    complete_range: range(completeYears),
    names_to_check_count: ds.firstTime.ambiguous.length,
  };

  // Medal odds by category
  const { list, missing } = oddsItems(rows);
  const odds = {
    odds_min: list.length ? one(list.at(-1).value) : null,
    odds_min_category: list.at(-1)?.label ?? null,
    odds_max: list.length ? one(list[0].value) : null,
    odds_max_category: list[0]?.label ?? null,
    odds_median: list.length ? one(median(list.map((c) => c.value))) : null,
    year_range: yearRange,
    missing_entry_count: missing.toLocaleString('en-US'),
  };

  // Per capita and per GDP leaders
  const meta = reportMeta();
  const states = latest ? stateRollup(rows, meta.states, meta.indicators, latest) : [];
  const lead = (key) => [...states].sort((a, b) => b[key] - a[key])[0] ?? null;
  const total = lead('medals');
  const perMillion = lead('per_million');
  const perGdp = lead('per_100b');
  const hasRates = meta.dataYear !== null;
  const place = {
    year_range: yearRange,
    top_state_total: total?.name ?? null,
    top_state_per_million: hasRates && perMillion?.per_million ? perMillion.name : null,
    top_state_per_million_value: hasRates && perMillion?.per_million ? `${one(perMillion.per_million)} medals` : null,
    top_state_per_gdp: hasRates && perGdp?.per_100b ? perGdp.name : null,
    top_state_per_gdp_value: hasRates && perGdp?.per_100b ? `${one(perGdp.per_100b)} medals` : null,
    latest_year: latest,
    data_year: meta.dataYear,
  };

  // Style trends across the complete years
  const share = (family, y) => {
    const inYear = rows.filter((r) => r.year === y);
    return inYear.length ? (100 * inYear.filter((r) => r.style_family === family).length) / inYear.length : null;
  };
  const families = [...new Set(rows.map((r) => r.style_family).filter(Boolean))];
  const end = families.map((f) => ({ f, end: share(f, latest), start: share(f, first) })).filter((x) => x.end !== null && x.start !== null);
  const topFamily = [...end].sort((a, b) => b.end - a.end)[0] ?? null;
  const change = (x) => x.end - x.start;
  const gain = [...end].sort((a, b) => change(b) - change(a))[0] ?? null;
  const loss = [...end].sort((a, b) => change(a) - change(b))[0] ?? null;
  const trends = {
    first_complete_year: first,
    latest_year: latest,
    top_family: topFamily?.f ?? null,
    top_family_share_start: topFamily ? `${Math.round(topFamily.start)} percent` : null,
    top_family_share_end: topFamily ? `${Math.round(topFamily.end)} percent` : null,
    biggest_gain_family: gain && change(gain) > 0 ? gain.f : null,
    biggest_gain_points: gain && change(gain) > 0 ? one(change(gain)) : null,
    biggest_loss_family: loss && change(loss) < 0 ? loss.f : null,
    biggest_loss_points: loss && change(loss) < 0 ? one(-change(loss)) : null,
  };

  return {
    'concentration-of-medals': concentration,
    'first-time-medalists': firstTime,
    'medal-odds-by-category': odds,
    'per-capita-and-per-gdp-leaders': { ...place },
    'style-trends': trends,
  };
}

const humanize = (token) => token.replace(/_/g, ' ');

// A finding: its title, summary, and blocks. A block is a heading or a paragraph whose tokens are filled; a paragraph
// with a token the data cannot give is a gap listing the missing figures.
function render(name, values) {
  const text = readFileSync(resolve(REPO, '.docs', 'content-management-system', 'analysis', `${name}.md`), 'utf8');
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  const front = m?.[1] ?? '';
  const field = (k) => (front.match(new RegExp(`^${k}: "?(.*?)"?$`, 'm')) ?? [])[1] ?? '';
  const blocks = [];
  for (const raw of (m?.[2] ?? text).split('\n\n').map((p) => p.trim()).filter(Boolean)) {
    const h = raw.match(/^(#{1,3}) (.*)$/);
    if (h) {
      if (h[1].length > 1) blocks.push({ type: 'heading', text: h[2] });
      continue;
    }
    const missing = [...new Set([...raw.matchAll(/\{\{(\w+)\}\}/g)].map((x) => x[1]))].filter((k) => values[k] === null || values[k] === undefined);
    if (missing.length) blocks.push({ type: 'gap', missing: missing.map(humanize) });
    else blocks.push({ type: 'text', text: raw.replace(/\{\{(\w+)\}\}/g, (_, k) => String(values[k])) });
  }
  return { name, title: field('title'), summary: field('summary'), blocks };
}

export function findings(names = FINDINGS.map((f) => f.name)) {
  const values = tokenValues();
  return names.map((n) => render(n, values[n]));
}

export const findingsForReport = (slug) => findings(FINDINGS.filter((f) => f.reports.includes(slug)).map((f) => f.name));
