// Real GABF data, read at build time. Every figure on the style guide comes from here: nothing is typed by hand.
import { existsInRepo, listRepo, parseCsv, readRepo, splitFrontmatter } from './repo';

export type Medal = 'Gold' | 'Silver' | 'Bronze';
export type ResultRow = {
  year: number;
  section: string;
  categoryNumber: number;
  categoryName: string;
  entries: number | null;
  medal: Medal;
  beer: string;
  brewery: string;
  city: string;
  state: string;
  notes: string;
};

const MEDALS: Medal[] = ['Gold', 'Silver', 'Bronze'];

export function resultYears(): number[] {
  return listRepo('data', 'results').map((f) => f.match(/^gabf-(\d{4})\.csv$/)?.[1]).filter(Boolean).map(Number).sort();
}

const cache = new Map<number, ResultRow[]>();
export function results(year: number): ResultRow[] {
  if (cache.has(year)) return cache.get(year)!;
  const rows = parseCsv(readRepo('data', 'results', `gabf-${year}.csv`)).filter((r) => MEDALS.includes(r.medal as Medal)).map((r) => ({
    year: Number(r.year),
    section: r.section,
    categoryNumber: Number(r.category_number),
    categoryName: r.category_name,
    entries: r.entries ? Number(r.entries) : null,
    medal: r.medal as Medal,
    beer: r.beer_name,
    brewery: r.brewery_name,
    city: r.city,
    state: r.state,
    notes: r.notes,
  }));
  cache.set(year, rows);
  return rows;
}

// A year is partial when any of its rows is a placeholder seeded from secondary sources.
export function yearCoverage(): { year: number; status: 'complete' | 'partial' | 'pending' }[] {
  const years = resultYears();
  const out: { year: number; status: 'complete' | 'partial' | 'pending' }[] = [];
  for (let y = years[0]; y <= years[years.length - 1]; y += 1) {
    if (!years.includes(y)) out.push({ year: y, status: 'pending' });
    else out.push({ year: y, status: results(y).some((r) => /partial seed/i.test(r.notes)) ? 'partial' : 'complete' });
  }
  return out;
}

export function yearSummary(year: number) {
  const row = parseCsv(readRepo('data', 'results', 'year-summary.csv')).find((r) => Number(r.year) === year && r.competition === 'GABF');
  if (!row) return null;
  const num = (v: string) => (v ? Number(v) : null);
  return { date: row.ceremony_date, entries: num(row.entries), medals: num(row.medals), categories: num(row.categories), winningBreweries: num(row.winning_breweries), source: row.source };
}

export type CategoryLine = { number: number; name: string; entries: number | null; medals: number; perMedal: number | null; gold: string; silver: string; bronze: string };

// The category index: one line per category with its field and its medalists.
export function categoryIndex(year: number): CategoryLine[] {
  const by = new Map<number, ResultRow[]>();
  for (const r of results(year).filter((x) => x.section === 'main')) by.set(r.categoryNumber, [...(by.get(r.categoryNumber) ?? []), r]);
  return [...by.entries()].sort((a, b) => a[0] - b[0]).map(([number, rows]) => {
    const entries = rows[0].entries;
    const who = (m: Medal) => rows.filter((r) => r.medal === m).map((r) => r.brewery).join('; ');
    return { number, name: rows[0].categoryName, entries, medals: rows.length, perMedal: entries ? entries / rows.length : null, gold: who('Gold'), silver: who('Silver'), bronze: who('Bronze') };
  });
}

export function oddsFinding(year: number) {
  const lines = categoryIndex(year).filter((l) => l.perMedal !== null) as (CategoryLine & { perMedal: number })[];
  const sorted = [...lines].sort((a, b) => a.perMedal - b.perMedal);
  const values = sorted.map((l) => l.perMedal);
  const mid = Math.floor(values.length / 2);
  const median = values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
  const missing = results(year).filter((r) => r.section === 'main' && r.entries === null).length;
  return { min: sorted[0], max: sorted[sorted.length - 1], median, missing };
}

export type Record3 = { gold: number; silver: number; bronze: number };
export const points = (r: Record3) => r.gold * 3 + r.silver * 2 + r.bronze;

// Medal records over the complete years, by brewery.
export function breweryRecords(): { brewery: string; city: string; state: string; record: Record3; byYear: Record<number, Record3> }[] {
  const complete = yearCoverage().filter((y) => y.status === 'complete').map((y) => y.year);
  const map = new Map<string, { brewery: string; city: string; state: string; record: Record3; byYear: Record<number, Record3> }>();
  for (const year of complete) {
    for (const r of results(year)) {
      const e = map.get(r.brewery) ?? { brewery: r.brewery, city: r.city, state: r.state, record: { gold: 0, silver: 0, bronze: 0 }, byYear: {} };
      const key = r.medal.toLowerCase() as keyof Record3;
      e.record[key] += 1;
      e.byYear[year] ??= { gold: 0, silver: 0, bronze: 0 };
      e.byYear[year][key] += 1;
      map.set(r.brewery, e);
    }
  }
  return [...map.values()].sort((a, b) => points(b.record) - points(a.record) || a.brewery.localeCompare(b.brewery));
}

// Medals by state per complete year, for the top states by total medals.
export function stateSeries(topN: number) {
  const complete = yearCoverage().filter((y) => y.status === 'complete').map((y) => y.year);
  const counts = new Map<string, Record<number, number>>();
  for (const year of complete) for (const r of results(year)) {
    const c = counts.get(r.state) ?? {};
    c[year] = (c[year] ?? 0) + 1;
    counts.set(r.state, c);
  }
  const total = (c: Record<number, number>) => Object.values(c).reduce((s, v) => s + v, 0);
  const top = [...counts.entries()].sort((a, b) => total(b[1]) - total(a[1])).slice(0, topN);
  return { years: complete, series: top.map(([state, c]) => ({ state, values: complete.map((y) => c[y] ?? 0) })) };
}

export type StyleRange = { abvMin: number; abvMax: number; ibuMin: number; ibuMax: number; source: string; confidence: string };

export function styleRange(categoryName: string): StyleRange | null {
  const row = parseCsv(readRepo('data', 'reference', 'categories.csv')).find((r) => r.category_name === categoryName);
  if (!row || !row.abv_min) return null;
  return { abvMin: Number(row.abv_min), abvMax: Number(row.abv_max), ibuMin: Number(row.ibu_min), ibuMax: Number(row.ibu_max), source: row.guideline_source, confidence: row.confidence };
}

export type Beer = {
  file: string; beer: string; brewery: string; city: string; state: string; category: string; categoryNumber: number;
  medal: Medal; entries: number | null; abv: number | null; ibu: number | null; hops: string[]; malts: string[]; yeast: string[]; adjuncts: string[]; style: string;
};

export function beer(file: string): Beer {
  const path = ['docs', '2026', 'winner', file];
  if (!existsInRepo(...path)) throw new Error(`beer profile ${file} is missing`);
  const { data } = splitFrontmatter(readRepo(...path));
  const arr = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
  const num = (v: unknown) => (typeof v === 'number' ? v : null);
  return {
    file: path.join('/'), beer: String(data.beer), brewery: String(data.brewery), city: String(data['brewery-city']), state: String(data['brewery-state']),
    category: String(data['category-name']), categoryNumber: Number(data['category-number']), medal: data.medal as Medal, entries: num(data.entries),
    abv: num(data.abv), ibu: num(data.ibu), hops: arr(data.hops), malts: arr(data.malts), yeast: arr(data.yeast), adjuncts: arr(data.adjuncts), style: String(data.style ?? ''),
  };
}

// The first winning beer (in category order) whose published ABV falls outside its style range.
export function firstBeerOutsideRange(): Beer | null {
  for (const file of listRepo('docs', '2026', 'winner').filter((f) => /^\d{3}-.*\.md$/.test(f)).sort()) {
    const b = beer(file);
    const r = styleRange(b.category);
    if (r && b.abv !== null && (b.abv < r.abvMin || b.abv > r.abvMax)) return b;
  }
  return null;
}

// True when a search query matches no 2026 beer, brewery, city, or category name.
export function matchesNothing(query: string): boolean {
  const q = query.toLowerCase();
  return !results(2026).some((r) => [r.beer, r.brewery, r.city, r.categoryName].some((v) => v.toLowerCase().includes(q)));
}

export function production() {
  return parseCsv(readRepo('data', 'reference', 'production.csv'));
}

export function statesInRecord(): string[] {
  return [...new Set(yearCoverage().filter((y) => y.status !== 'pending').flatMap((y) => results(y.year).map((r) => r.state)))].filter(Boolean).sort();
}

// Number formats from the formats copy document.
export const fmt = {
  number: (n: number) => n.toLocaleString('en-US'),
  abv: (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1).replace(/\.0$/, '')}%`,
  one: (n: number) => n.toFixed(1).replace(/\.0$/, ''),
  date: (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }),
  split: (r: Record3) => `${r.gold} / ${r.silver} / ${r.bronze}`,
  years: (ys: (number | string)[]) => (ys.length <= 1 ? ys.join('') : ys.length === 2 ? ys.join(' and ') : `${ys.slice(0, -1).join(', ')}, and ${ys[ys.length - 1]}`),
};
