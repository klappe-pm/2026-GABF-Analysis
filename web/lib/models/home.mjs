// The numbers of the home page, as pure functions of medal rows so the same code serves the page built at
// build time (the latest year) and the page redrawn in the browser for the year and filters of a link such
// as /#year=2024.

const RANK = { Gold: 0, Silver: 1, Bronze: 2 };

// One line per category: its field, entries per medal, and who won each medal.
export function categoryLines(rows) {
  const by = new Map();
  for (const r of rows) {
    const c = by.get(r.category_slug) ?? { slug: r.category_slug, name: r.category_name, number: Number(r.category_number) || 0, entries: r.entries ?? null, medals: 0, gold: [], silver: [], bronze: [] };
    c.medals += 1;
    if (!c.entries && r.entries) c.entries = r.entries;
    c[String(r.medal).toLowerCase()]?.push({ name: r.brewery_name, slug: r.brewery_slug });
    by.set(r.category_slug, c);
  }
  return [...by.values()]
    .map((c) => ({ ...c, odds: c.entries && c.medals ? Number((c.entries / c.medals).toFixed(1)) : null }))
    .sort((a, b) => a.number - b.number || a.name.localeCompare(b.name));
}

// The scoresheet of a view: medals, categories, and entries judged (the published year total when the view
// is the whole year, else the sum of the category entry counts, else nothing).
export function scoresheet(rows, summaryEntries = null) {
  const lines = categoryLines(rows);
  const sum = lines.reduce((s, c) => s + (c.entries ?? 0), 0);
  return { medals: rows.length, categories: lines.length, entries: summaryEntries || sum || null };
}

export const RANK_OF = RANK;

// Words of a query must all appear in an entry's text.
export function searchIndexMatches(index, query, limit = 8) {
  const words = String(query).toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const hits = index.filter((e) => words.every((w) => e.text.includes(w)));
  const q = words.join(' ');
  return hits.sort((a, b) => Number(b.label.toLowerCase().startsWith(q)) - Number(a.label.toLowerCase().startsWith(q)) || a.kind.localeCompare(b.kind) || a.label.localeCompare(b.label)).slice(0, limit);
}
