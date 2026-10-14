// Parser for the USDA NASS National Hop Report text releases (ESMIS). The variety tables list, per
// state, the area harvested, the yield per acre and the production of each named variety for three
// crop years. Newer reports (2024 and 2025) print each measure as its own table; the 2023 report
// prints area and yield side by side and production on its own.
//
// Value codes in the releases: (D) withheld to avoid disclosing individual operations, (NA) not
// available, (X) not applicable, and a lone "-" for zero.

export const NASS_REPORTS = [
  { id: 'hopsan25', releaseYear: 2025, years: [2023, 2024, 2025], url: 'https://esmis.nal.usda.gov/sites/default/release-files/795696/hopsan25.txt' },
  { id: 'hopsan24', releaseYear: 2024, years: [2022, 2023, 2024], url: 'https://usda.library.cornell.edu/sites/default/release-files/s7526c41m/cj82n3552/3r076q47v/hopsan24.txt' },
  { id: 'hopsan23', releaseYear: 2023, years: [2021, 2022, 2023], url: 'https://usda.library.cornell.edu/sites/default/release-files/s7526c41m/4b29ct10c/n5840f59r/hopsan23.txt' },
];

// Each crop year is taken from the newest report that covers it, because NASS revises prior years.
export const YEAR_SOURCE = { 2025: 'hopsan25', 2024: 'hopsan25', 2023: 'hopsan25', 2022: 'hopsan24', 2021: 'hopsan23' };

const STATES = new Set(['Idaho', 'Oregon', 'Washington', 'United States']);

// Reduce a NASS variety label to a stable key: "Mosaic R, HBC 369" becomes "Mosaic".
export function nassKey(raw) {
  const label = raw.replace(/\.{2,}.*$/, '').replace(/\s+1\/\s*$/, '').trim();
  const out = [];
  for (const token of label.split(/\s+/)) {
    if (token === 'R' || token === 'TM' || token === 'R,' || token === 'TM,') break;
    // Some years print the experimental code without a mark ("Talus HBC 692"); the code is not part of the name.
    if (out.length && /^(HBC|YCR|ADHA|YQH|VGXP|OR|HS\d+)$/.test(token)) break;
    if (token.endsWith(',')) { out.push(token.slice(0, -1)); break; }
    out.push(token);
  }
  const key = out.join(' ');
  return KEY_TYPOS.get(key) ?? key;
}

// The 2023 report prints "Elami" for Elani on one Washington line.
const KEY_TYPOS = new Map([['Elami', 'Elani']]);

function parseValue(token) {
  if (token === '(D)' || token === '(NA)' || token === '(X)') return { value: null, code: token.slice(1, -1) };
  if (token === '-') return { value: 0, code: '' };
  return { value: Number(token.replace(/,/g, '')), code: '' };
}

// Returns rows { state, label, key, year, measure, value, code } for the by-variety tables.
export function parseNassVarietyTables(text, years) {
  const rows = [];
  let inVariety = false;
  let measures = [];
  let state = '';
  for (const line of text.split(/\r?\n/)) {
    if (/by Variety/.test(line)) { inVariety = true; continue; }
    if (!inVariety) continue;
    if (/Area harvested/.test(line) && /Yield per acre/.test(line)) { measures = ['area', 'yield']; continue; }
    if (/^\s*State\s*:.*Area harvested/.test(line)) { measures = ['area']; continue; }
    if (/^\s*State\s*:.*Yield per acre/.test(line)) { measures = ['yield']; continue; }
    if (/^\s*State\s*:.*Production/.test(line)) { measures = ['production']; continue; }
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const label = line.slice(0, colon).trim();
    const rest = line.slice(colon + 1).trim();
    if (!label) continue;
    const tokens = rest.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
      const name = label.replace(/\.+$/, '').trim();
      if (STATES.has(name)) state = name;
      continue;
    }
    if (!measures.length) continue;
    const expected = measures.length * years.length;
    if (tokens.length !== expected || !tokens.every((t) => /^(\(D\)|\(NA\)|\(X\)|-|[\d,]+(\.\d+)?)$/.test(t))) continue;
    const name = label.replace(/\.+$/, '').trim();
    const rowState = name.startsWith('United States') ? 'United States' : state;
    const key = name.startsWith('United States') ? 'Total' : nassKey(label);
    tokens.forEach((token, idx) => {
      const measure = measures[Math.floor(idx / years.length)];
      const year = years[idx % years.length];
      rows.push({ state: rowState, label: name, key, year, measure, ...parseValue(token) });
    });
  }
  return rows;
}
