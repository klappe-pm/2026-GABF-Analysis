// Turn an awards ceremony transcript (YouTube auto captions as VTT or SRT, or plain
// text) into draft medal rows. Announcers follow a stable script: the category number
// and name with its entry count, then bronze, silver, and gold in that order, each as
// "beer name from brewery, city, state". Captions are noisy (no punctuation, misheard
// names), so every row carries a confidence and must be reviewed against the official
// list before it is promoted.

import { collapseWhitespace, normalizePunctuation, normalizeState, US_STATES } from './text.mjs';
import { breweryKey } from './slug.mjs';

export function stripCaptions(raw) {
  const text = String(raw ?? '').replace(/^﻿/, '');
  const lines = text.split(/\r?\n/);
  const kept = [];
  let last = '';
  for (const line of lines) {
    const t = line.trim();
    if (!t || /^WEBVTT/i.test(t) || /^\d+$/.test(t) || /^\d{2}:\d{2}/.test(t) || /-->/.test(t) || /^(Kind|Language):/i.test(t) || /^NOTE/.test(t)) continue;
    const clean = t.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
    if (!clean || clean === last) continue; // auto captions repeat the previous cue
    kept.push(clean);
    last = clean;
  }
  return collapseWhitespace(normalizePunctuation(kept.join(' ')));
}

const NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20 };

function toNumber(s) {
  const v = String(s).toLowerCase().replace(/,/g, '');
  if (/^\d+$/.test(v)) return Number(v);
  return NUMBER_WORDS[v] ?? null;
}

function tokens(s) {
  return String(s ?? '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((t) => t.length > 2 && !['the', 'and', 'style', 'beer', 'ale'].includes(t));
}

export function similarity(a, b) {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  return inter / Math.max(ta.size, tb.size);
}

export function bestMatch(name, candidates) {
  let best = null;
  for (const c of candidates) {
    const score = similarity(name, c);
    if (!best || score > best.score) best = { name: c, score };
  }
  return best && best.score >= 0.5 ? best : null;
}

// Split "Beer Name from Brewery Name, City, State" (official punctuation) or the
// caption form "beer name from brewery name city state" (no punctuation). Without
// commas the brewery is assumed to end at its last brewery-ish word (brewery, brewing,
// company, co, pub, ales, beer, works) and the city is whatever follows.
const BREWERY_TAIL = /\b(brewery|brewing|brewers|brewhouse|brewpub|pub|company|co|inc|llc|ales|ale|beer|works|cidery|cider|taproom|house|project|collective|lab|labs)\b/gi;

function splitBreweryCity(rest) {
  const text = rest.replace(/[,\s]+$/, '');
  if (text.includes(',')) {
    const idx = text.lastIndexOf(',');
    return { brewery: text.slice(0, idx).trim(), city: text.slice(idx + 1).replace(/^\s*(?:in|of)\s+/i, '').trim() };
  }
  let lastEnd = -1;
  let m;
  BREWERY_TAIL.lastIndex = 0;
  while ((m = BREWERY_TAIL.exec(text)) !== null) lastEnd = m.index + m[0].length;
  BREWERY_TAIL.lastIndex = 0;
  if (lastEnd > 0 && lastEnd < text.length) return { brewery: text.slice(0, lastEnd).trim(), city: text.slice(lastEnd).replace(/^[\s,]*(?:in|of)\s+/i, '').trim() };
  return { brewery: text, city: '' };
}

function parseWinner(body) {
  const text = collapseWhitespace(body).replace(/[.;,\s]+$/, '');
  const m = text.match(/^(.*?)\s+(?:from|by|brewed by|out of)\s+(.+)$/i);
  if (!m) return null;
  const beer = m[1].replace(/^(?:goes to|went to|to|is|for)\s+/i, '').replace(/^(?:the\s+)?medal\s+(?:goes\s+)?(?:to\s+)?/i, '').trim();
  let rest = m[2];
  let state = '';
  const stateNames = Object.values(US_STATES).sort((a, b) => b.length - a.length);
  for (const sn of stateNames) {
    const re = new RegExp(`[,\\s]+${sn.replace(/ /g, '\\s+')}$`, 'i');
    if (re.test(rest)) {
      state = normalizeState(sn);
      rest = rest.replace(re, '');
      break;
    }
  }
  if (!state) {
    const mm = rest.match(/[,\s]+([A-Z]{2})$/);
    if (mm && US_STATES[mm[1]]) {
      state = mm[1];
      rest = rest.slice(0, mm.index);
    }
  }
  const { brewery, city } = splitBreweryCity(rest);
  return { beer_name: beer, brewery_printed: brewery, city, state };
}

export function parseTranscript(raw, { year, knownCategories = [], knownBreweries = [], source = 'ceremony transcript' } = {}) {
  const text = stripCaptions(raw);
  const rows = [];
  const problems = [];
  const catRe = /category\s+(?:number\s+)?(\d{1,3}|[a-z]+)\b[,.:]?\s*(.+?)[,.]?\s*(?:with|had|has|drew|saw)?\s*(\d[\d,]*|[a-z]+)\s+entr(?:y|ies)/gi;
  const headers = [];
  let m;
  while ((m = catRe.exec(text)) !== null) {
    const number = toNumber(m[1]);
    const entries = toNumber(m[3]);
    const rawName = collapseWhitespace(m[2]).replace(/^(?:is|the|for)\s+/i, '');
    if (number === null) continue;
    headers.push({ number, rawName, entries, start: m.index, end: m.index + m[0].length });
  }
  if (headers.length === 0) problems.push({ kind: 'no-categories', detail: 'No "category N ... N entries" announcements found.' });
  const medalRe = /\b(bronze|silver|gold)\b(?:\s+medal)?(?:\s+(?:goes|went|is awarded|awarded|going)\s+to)?[:,]?\s+/gi;
  for (let i = 0; i < headers.length; i += 1) {
    const h = headers[i];
    const blockEnd = i + 1 < headers.length ? headers[i + 1].start : text.length;
    const block = text.slice(h.end, blockEnd);
    const match = bestMatch(h.rawName, knownCategories);
    const categoryName = match ? match.name : h.rawName;
    const hits = [];
    let mm;
    while ((mm = medalRe.exec(block)) !== null) hits.push({ medal: mm[1][0].toUpperCase() + mm[1].slice(1).toLowerCase(), start: mm.index, bodyStart: mm.index + mm[0].length });
    if (hits.length === 0) problems.push({ kind: 'empty-category', detail: `Category ${h.number} ${categoryName}: no medal announcements.` });
    hits.forEach((hit, idx) => {
      const end = idx + 1 < hits.length ? hits[idx + 1].start : block.length;
      const body = block.slice(hit.bodyStart, end).replace(/\b(?:congratulations|congrats|next up|and now|our next category).*$/i, '');
      const parsed = parseWinner(body);
      if (!parsed) {
        problems.push({ kind: 'unparsed-medal', detail: `Category ${h.number} ${hit.medal}: ${collapseWhitespace(body).slice(0, 120)}` });
        return;
      }
      const breweryMatch = bestMatch(parsed.brewery_printed, knownBreweries);
      const brewery = breweryMatch ? breweryMatch.name : parsed.brewery_printed;
      const confidence = (match ? 1 : 0) + (breweryMatch ? 1 : 0) + (parsed.state ? 1 : 0);
      rows.push({
        year: String(year), competition: 'GABF', section: 'main', category_number: String(h.number), category_name: categoryName, entries: h.entries === null ? '' : String(h.entries),
        medal: hit.medal, beer_name: parsed.beer_name, brewery_printed: parsed.brewery_printed, brewery_name: brewery, brewery_location: '', city: parsed.city, state: parsed.state, source,
        notes: `Transcript draft, confidence ${['low', 'low', 'medium', 'high'][confidence]}${match ? '' : '; category name unmatched'}${breweryMatch ? '' : '; brewery unmatched'}. Verify against the official list.`,
        confidence,
      });
    });
  }
  return { rows, categories: headers.map((h) => ({ number: h.number, name: bestMatch(h.rawName, knownCategories)?.name ?? h.rawName, entries: h.entries })), problems };
}

export function breweryNamesFromDataset(ds) {
  return [...new Set([...ds.breweries.map((b) => b.name), ...ds.ownership.map((o) => o.brewery_name)])].filter(Boolean).sort((a, b) => breweryKey(a).localeCompare(breweryKey(b)));
}
