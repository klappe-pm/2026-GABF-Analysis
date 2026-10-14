// Population and GDP adjusted medal rates, shared by the build (Node) and the dashboards (browser).
// A rate sums each medal's own year denominator: medals per million residents is the sum over
// medal rows of 1,000,000 divided by that geography's population in the medal's year, and medals
// per $100 billion of real GDP is the sum of 100,000 divided by real GDP in millions of chained
// 2017 dollars. A year not yet published uses the nearest published year (the reference tables
// already carry 2025 values for 2026 and say so).

// series: { [year]: value }; returns the value for year or the nearest year present.
export function valueFor(series, year) {
  if (!series) return null;
  if (series[year] !== undefined && series[year] !== null) return Number(series[year]);
  const years = Object.keys(series).map(Number).filter((y) => series[y] !== null && series[y] !== undefined);
  if (!years.length) return null;
  years.sort((a, b) => Math.abs(a - year) - Math.abs(b - year) || a - b);
  return Number(series[years[0]]);
}

// rows: medal rows with `year`; keyOf(row) picks the geography; indicators: { [key]: { population, gdp_real } }.
export function medalRates(rows, keyOf, indicators) {
  const out = new Map();
  for (const r of rows) {
    const k = keyOf(r);
    if (k === null || k === undefined || k === '') continue;
    const cur = out.get(String(k)) ?? { key: String(k), medals: 0, per_million: 0, per_100b_gdp: 0, missing_population: 0, missing_gdp: 0 };
    cur.medals += 1;
    const ind = indicators?.[String(k)];
    const pop = valueFor(ind?.population, r.year);
    const gdp = valueFor(ind?.gdp_real, r.year);
    if (pop) cur.per_million += 1e6 / pop; else cur.missing_population += 1;
    if (gdp) cur.per_100b_gdp += 1e5 / gdp; else cur.missing_gdp += 1;
    out.set(String(k), cur);
  }
  return out;
}

export const CONTROL_FIELDS = [
  { key: 'gdp_per_capita_real', label: 'Real GDP per Capita (Chained 2017 USD)', digits: 0 },
  { key: 'median_household_income', label: 'Median Household Income (2024 USD)', digits: 0 },
  { key: 'median_age', label: 'Median Age', digits: 1 },
  { key: 'share_21_plus', label: 'Share 21 and Over (%)', digits: 1 },
  { key: 'share_bachelors_or_higher', label: "Bachelor's or higher (%)", digits: 1 },
  { key: 'share_hs_or_higher', label: 'High School or Higher (%)', digits: 1 },
  { key: 'poverty_rate', label: 'Poverty Rate (%)', digits: 1 },
  { key: 'share_nh_white', label: 'White, Not Hispanic (%)', digits: 1 },
  { key: 'share_nh_black', label: 'Black, Not Hispanic (%)', digits: 1 },
  { key: 'share_hispanic', label: 'Hispanic or Latino (%)', digits: 1 },
  { key: 'share_nh_asian', label: 'Asian, Not Hispanic (%)', digits: 1 },
  { key: 'urban_share', label: 'Urban Share 2020 (%)', digits: 1 },
  { key: 'literacy_level1_or_below', label: 'Literacy at or Below Level 1 (%, Modeled)', digits: 0 },
  { key: 'life_expectancy', label: 'Life Expectancy 2022', digits: 1 },
];

// Latest value of a control (controls are single year cross sections; GDP per capita uses the
// latest year in the series).
export function latestValue(series) {
  if (!series) return null;
  const years = Object.keys(series).map(Number).filter((y) => series[y] !== null && series[y] !== undefined);
  return years.length ? Number(series[Math.max(...years)]) : null;
}
