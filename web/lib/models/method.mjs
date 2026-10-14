// Build time data of the Method page: the year coverage table and the values that fill the page copy's
// {{tokens}}. Every figure is read from the dataset or from data/reference/estimation-parameters.json,
// so a new year or a changed assumption changes the page on the next build and nothing is typed here.
import { site } from '../site-model.mjs';

const usd = (n) => `$${Number(n).toLocaleString('en-US')}`;
const percentRange = ([low, high]) => `${Math.round(low * 100)} to ${Math.round(high * 100)} percent`;
// A source line as a reader sees it: the file name in parentheses that the data keeps beside it is dropped.
const plain = (text) => String(text ?? '').replace(/\s*\([^)]*\.(?:pdf|csv|html?|txt|json|xlsx?)\)/gi, '').trim();
const span = (years) => (years.length ? (years.length === 1 ? String(years[0]) : `${years[0]} to ${years[years.length - 1]}`) : '');

// The latest year a population figure was published for: a year whose source line says the value is
// carried forward ("not yet published") is not a published year.
function latestPublishedYear(indicators) {
  let best = 0;
  for (const series of Object.values(indicators ?? {})) {
    for (const [year, row] of Object.entries(series.population ?? {})) {
      if (!/not yet published/i.test(row.source ?? '') && Number(year) > best) best = Number(year);
    }
  }
  return best || null;
}

export function methodModel() {
  const { ds } = site();
  const years = [...ds.years].sort((a, b) => a - b);
  const complete = years.filter((y) => ds.coverage[y] === 'complete');
  const loaded = years.filter((y) => ds.coverage[y] !== 'pending');
  const p = ds.params;
  const byChannel = p.ebitda_margin_range_by_channel;

  const coverage = years.map((year) => {
    const rows = ds.results.filter((r) => r.year === year);
    const sources = [...new Set(rows.map((r) => plain(r.source)).filter(Boolean))];
    return { year, status: ds.coverage[year], medals: rows.length, sources };
  });

  return {
    coverage,
    values: {
      first_year: years[0],
      last_year: years[years.length - 1],
      complete_range: span(complete),
      latest_year: loaded[loaded.length - 1] ?? years[years.length - 1],
      data_year: latestPublishedYear(ds.stateIndicators),
      direct_revenue_per_barrel: usd(p.revenue_per_barrel_by_brewery_type.taproom),
      distributed_revenue_per_barrel: usd(p.revenue_per_barrel_by_brewery_type.regional),
      taproom_margin_range: percentRange(byChannel.taproom),
      self_margin_range: percentRange(byChannel['self-distribution']),
      distributor_margin_range: percentRange(byChannel.distributor),
    },
  };
}
