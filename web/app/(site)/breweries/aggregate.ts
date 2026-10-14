// One line per brewery from a set of medal rows: the counts the index ranks by. The server draws the
// default selection with it and the client draws any other, so both rank the same way.
export type MedalLine = { brewery_key: string; brewery_slug?: string; brewery_name?: string; medal: string; year: number; points?: number };
export type Agg = { key: string; medals: number; points: number; g: number; s: number; b: number; first: number; last: number };

const POINTS: Record<string, number> = { Gold: 3, Silver: 2, Bronze: 1 };

export function aggregate(rows: MedalLine[]): Agg[] {
  const map = new Map<string, Agg>();
  for (const r of rows) {
    const a = map.get(r.brewery_key) ?? { key: r.brewery_key, medals: 0, points: 0, g: 0, s: 0, b: 0, first: r.year, last: r.year };
    a.medals += 1;
    a.points += r.points ?? POINTS[r.medal] ?? 0;
    if (r.medal === 'Gold') a.g += 1;
    if (r.medal === 'Silver') a.s += 1;
    if (r.medal === 'Bronze') a.b += 1;
    a.first = Math.min(a.first, r.year);
    a.last = Math.max(a.last, r.year);
    map.set(r.brewery_key, a);
  }
  return [...map.values()];
}
