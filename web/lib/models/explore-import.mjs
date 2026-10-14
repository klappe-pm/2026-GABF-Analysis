// Reading a CSV of awards in the browser. Nothing here touches the network: the Explore page reads the chosen
// file with the File API, checks it with these functions, and adds the rows to the page. A failure is a code and
// its values; the page turns it into a sentence from the copy documents.

export const MAX_ROWS = 20000;
export const MAX_BYTES = 8 * 1024 * 1024;
export const REQUIRED = ['year', 'medal', 'beer', 'brewery', 'city', 'state', 'category'];
const MEDALS = ['Gold', 'Silver', 'Bronze'];

// RFC 4180 style: quoted values may hold commas, doubled quotes, and line breaks.
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i += 1; } else if (c === '"') quoted = false; else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i += 1;
      row.push(field); field = '';
      if (row.some((v) => v.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (quoted) return { error: { code: 'unclosed_quote' } };
  row.push(field);
  if (row.some((v) => v.trim() !== '')) rows.push(row);
  return { rows };
}

const norm = (h) => h.trim().toLowerCase().replace(/\s+/g, '_');

// Awards from CSV text: { awards, skipped } or { error }. A medal is Gold, Silver, or Bronze in any case; a year
// is four digits from 1982 to 2100; a row identical to an earlier one is skipped.
export function readAwards(text, size = text.length) {
  if (size > MAX_BYTES) return { error: { code: 'too_large' } };
  const parsed = parseCsv(text);
  if (parsed.error) return parsed;
  const [head, ...body] = parsed.rows;
  if (!head || !body.length) return { error: { code: 'no_rows' } };
  if (body.length > MAX_ROWS) return { error: { code: 'too_many_rows' } };
  const cols = head.map(norm);
  if (new Set(cols).size !== cols.length) return { error: { code: 'duplicate_columns' } };
  for (const need of REQUIRED) if (!cols.includes(need)) return { error: { code: 'missing_column', column: need } };
  const at = Object.fromEntries(cols.map((c, i) => [c, i]));
  const seen = new Set();
  const awards = [];
  let skipped = 0;
  for (let n = 0; n < body.length; n += 1) {
    const r = body[n];
    const line = n + 2;
    if (r.length !== head.length) return { error: { code: 'field_count', row: line, count: r.length, expected: head.length } };
    const v = (c) => r[at[c]].trim();
    if (!v('beer') || !v('brewery') || !v('category')) return { error: { code: 'blank_required', row: line } };
    const medal = MEDALS.find((m) => m.toLowerCase() === v('medal').toLowerCase());
    if (!medal) return { error: { code: 'bad_medal', row: line } };
    const year = Number(v('year'));
    if (!/^\d{4}$/.test(v('year')) || year < 1982 || year > 2100) return { error: { code: 'bad_year', row: line } };
    const key = [year, medal, v('beer'), v('brewery'), v('city'), v('state'), v('category')].join('|').toLowerCase();
    if (seen.has(key)) { skipped += 1; continue; }
    seen.add(key);
    awards.push({ year, medal, beer: v('beer'), brewery: v('brewery'), city: v('city'), state: v('state'), category: v('category') });
  }
  return { awards, skipped };
}
