// Real records for the style guide samples, chosen from the published profiles and result files at build time.
import { beer, breweryRecords, fmt, styleRange, yearCoverage, type Beer, type StyleRange } from './data';
import { listRepo } from './repo';

export type SampleBeer = { beer: Beer; range: StyleRange };

// Two published 2026 winners with a published ABV and a defined style range: one inside the range, one outside it.
export function sampleBeers(): { inside: SampleBeer; outside: SampleBeer | null } {
  const inside: SampleBeer[] = [];
  const outside: SampleBeer[] = [];
  for (const file of listRepo('docs', '2026', 'winner').filter((f) => f.endsWith('.md'))) {
    const b = beer(file);
    if (b.abv === null || b.ibu === null) continue;
    const range = styleRange(b.category);
    if (!range || ![range.abvMin, range.abvMax, range.ibuMin, range.ibuMax].every(Number.isFinite)) continue;
    const isOut = b.abv < range.abvMin || b.abv > range.abvMax || b.ibu < range.ibuMin || b.ibu > range.ibuMax;
    (isOut ? outside : inside).push({ beer: b, range });
    if (inside.length > 0 && outside.length > 0) break;
  }
  return { inside: inside[0], outside: outside[0] ?? null };
}

export function leadBreweries(n: number) {
  return breweryRecords().slice(0, n);
}

export function completeYearRange(): { years: number[]; text: string; first: number; last: number } {
  const years = yearCoverage().filter((y) => y.status === 'complete').map((y) => y.year);
  return { years, text: `${years[0]} to ${years[years.length - 1]}`, first: years[0], last: years[years.length - 1] };
}

export const abvText = (n: number) => fmt.abv(n);
