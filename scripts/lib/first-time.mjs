// First time medalists: breweries (by normalized brewery key, so renamed or location suffixed
// printings roll up) whose first GABF medal in the loaded results came in a given year.
//   new           no medal in any earlier loaded year
//   new-complete  earlier medals only in partial years (seed rows), so the year is the first in
//                 the complete record
// Years that are not loaded (2020 was not held in person and has no rows) cannot count against a
// brewery, so "first" always means first in the loaded record.

export function firstTimeStatus(results, { year, partialYears = [] }) {
  const partial = new Set(partialYears.map(Number));
  const prior = new Map();
  const inYear = new Set();
  for (const r of results) {
    if (r.competition && r.competition !== 'GABF') continue;
    const y = Number(r.year);
    if (y === Number(year)) inYear.add(r.brewery_key);
    else if (y < Number(year)) {
      if (!prior.has(r.brewery_key)) prior.set(r.brewery_key, new Set());
      prior.get(r.brewery_key).add(y);
    }
  }
  const out = new Map();
  for (const key of inYear) {
    const years = prior.get(key);
    if (!years) out.set(key, 'new');
    else if ([...years].every((y) => partial.has(y))) out.set(key, 'new-complete');
  }
  return out;
}

// Words every brewery name shares carry no identity, so they never make two names look alike.
const GENERIC = new Set(['brewery', 'breweries', 'brewing', 'brewhouse', 'beer', 'beers', 'co', 'company', 'the', 'and', 'pub', 'house', 'taproom', 'works', 'bier', 'ales', 'ale', 'craft']);
const tokens = (key) => String(key).split(/\s+/).filter((t) => t.length > 1 && !GENERIC.has(t));

// Possible identity slips worth a human look: a first time medalist that shares a city and state
// with an earlier medalist under a different key and shares a name token with it, or whose key
// tokens are a subset of an earlier key (or the reverse). Listed, never merged.
export function ambiguousFirstTimers(results, status, year) {
  const earlier = new Map();
  const current = new Map();
  for (const r of results) {
    if (r.competition && r.competition !== 'GABF') continue;
    const y = Number(r.year);
    const target = y < Number(year) ? earlier : y === Number(year) ? current : null;
    if (!target) continue;
    if (!target.has(r.brewery_key)) target.set(r.brewery_key, { key: r.brewery_key, name: r.brewery_name, city: r.city, state: r.state, years: new Set() });
    target.get(r.brewery_key).years.add(y);
  }
  const out = [];
  for (const [key, st] of status) {
    if (st !== 'new') continue;
    const me = current.get(key);
    const mine = tokens(key);
    const candidates = [];
    for (const other of earlier.values()) {
      const theirs = tokens(other.key);
      const shared = mine.filter((t) => theirs.includes(t));
      const sameCity = other.city === me.city && other.state === me.state;
      const subset = (mine.length && mine.every((t) => theirs.includes(t))) || (theirs.length && theirs.every((t) => mine.includes(t)));
      if ((sameCity && shared.length) || subset) candidates.push({ key: other.key, name: other.name, city: other.city, state: other.state, years: [...other.years].sort() });
    }
    if (candidates.length) out.push({ key, name: me.name, city: me.city, state: me.state, candidates });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
