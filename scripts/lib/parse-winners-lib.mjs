// Parser for the Brewers Association's official GABF winners list text.
//
// The official PDF, once extracted to text, reads as a sequence of category blocks:
//
//   Category 1: American Wheat Beer - 50 Entries
//   Gold: Beer Name, Brewery Name, City, ST
//   Silver: Beer Name, Brewery Name - Location, City, ST
//   Bronze: Beer Name, Brewery Name (Location), City, ST
//
// followed by Brewery and Brewer of the Year lines and, in some years, Pro-Am and
// Collaboration sections. PDF text extraction loses line structure unpredictably,
// so the parser works on the joined text and anchors on the tokens that are stable
// across years: "Category N:", "N Entries", and the three medal words.

import { collapseWhitespace, normalizePunctuation, normalizeState, US_STATES } from './text.mjs';
import { splitLocationSuffix } from './slug.mjs';

export const RESULT_COLUMNS = [
  'year', 'competition', 'section', 'category_number', 'category_name', 'entries', 'medal',
  'beer_name', 'brewery_printed', 'brewery_name', 'brewery_location', 'city', 'state', 'source', 'notes',
];

const MEDALS = ['Gold', 'Silver', 'Bronze', 'Honorable Mention'];
const BREWERY_WORD = /\b(brew|brewing|brewery|brewers|brewhouse|brewpub|beer|ale|ales|cider|cidery|lager|hop|tap|taproom|works|company|co\.?|inc\.?|llc|distill|fermenter|fermentation|beverage|meadery|kombucha)\b/i;

function categoryHeaderRegex() {
  // "Category 12A: Juicy or Hazy India Pale Ale - 402 Entries" (letters appear in some years)
  return /Category\s+(\d+[A-Za-z]?)\s*[:.]\s*(.+?)\s*[-–—:]\s*(\d{1,4})\s+Entr(?:y|ies)/gi;
}

function sectionHeader(text, startIdx) {
  const before = text.slice(Math.max(0, startIdx - 400), startIdx);
  if (/pro-?am/i.test(before)) return 'pro-am';
  if (/collaboration/i.test(before)) return 'collaboration';
  return 'main';
}

// Split "Beer Name, Brewery Name, City, ST" from the right. Beer and brewery names
// can both contain commas, so the split between them is chosen by looking for the
// brewery-ish token in the candidate brewery segment.
export function splitMedalLine(body) {
  const text = collapseWhitespace(normalizePunctuation(body)).replace(/[.;,\s]+$/, '');
  const parts = text.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 3) return null;
  const stateRaw = parts[parts.length - 1];
  const state = normalizeState(stateRaw);
  if (!US_STATES[state]) return null;
  const city = parts[parts.length - 2];
  const head = parts.slice(0, parts.length - 2);
  if (head.length === 0) return null;
  // Default: the last segment is the brewery. Corporate tails ("Brewery, Inc.") are
  // folded back into the brewery, then the split moves left only while the brewery
  // candidate still lacks any brewery-ish word.
  let splitAt = head.length - 1;
  while (splitAt > 1 && /^(inc|llc|ltd|co|corp|company)\.?$/i.test(head[splitAt])) splitAt -= 1;
  if (!BREWERY_WORD.test(head.slice(splitAt).join(', '))) {
    for (let i = splitAt - 1; i >= 1; i -= 1) {
      if (BREWERY_WORD.test(head.slice(i).join(', '))) {
        splitAt = i;
        break;
      }
    }
  }
  const beer = head.slice(0, splitAt).join(', ').trim();
  const breweryPrinted = head.slice(splitAt).join(', ').trim();
  if (!beer || !breweryPrinted) return null;
  const { name, location } = splitLocationSuffix(breweryPrinted);
  return { beer_name: beer, brewery_printed: breweryPrinted, brewery_name: name, brewery_location: location, city, state };
}

function parseMedalsInBlock(block) {
  const out = [];
  const re = new RegExp(`(${MEDALS.join('|')})\\s*[:：]\\s*`, 'g');
  const hits = [];
  let m;
  while ((m = re.exec(block)) !== null) hits.push({ medal: m[1], start: m.index, bodyStart: m.index + m[0].length });
  for (let i = 0; i < hits.length; i += 1) {
    const end = i + 1 < hits.length ? hits[i + 1].start : block.length;
    const body = block.slice(hits[i].bodyStart, end);
    out.push({ medal: hits[i].medal, body: collapseWhitespace(body) });
  }
  return out;
}

export function parseWinnersText(rawText, { year, source = '', competition = 'GABF' } = {}) {
  const text = collapseWhitespace(normalizePunctuation(rawText));
  const rows = [];
  const problems = [];
  const categories = [];
  const headerRe = categoryHeaderRegex();
  const headers = [];
  let h;
  while ((h = headerRe.exec(text)) !== null) {
    headers.push({ number: h[1], name: collapseWhitespace(h[2]), entries: Number(h[3]), start: h.index, bodyStart: h.index + h[0].length });
  }
  if (headers.length === 0) problems.push({ kind: 'no-categories', detail: 'No "Category N: Name - N Entries" headers found.' });
  for (let i = 0; i < headers.length; i += 1) {
    const hdr = headers[i];
    const end = i + 1 < headers.length ? headers[i + 1].start : text.length;
    let block = text.slice(hdr.bodyStart, end);
    // Trim trailing Brewery of the Year material that follows the final category.
    const boty = block.search(/Brew(?:ery|er|pub|ing)[^.]{0,40}of the Year/i);
    if (boty > 0) block = block.slice(0, boty);
    const section = sectionHeader(text, hdr.start);
    categories.push({ year, competition, section, category_number: hdr.number, category_name: hdr.name, entries: hdr.entries });
    const medals = parseMedalsInBlock(block);
    if (medals.length === 0) problems.push({ kind: 'empty-category', detail: `Category ${hdr.number} ${hdr.name} has no medal lines.` });
    for (const medal of medals) {
      const split = splitMedalLine(medal.body);
      if (!split) {
        problems.push({ kind: 'unparsed-medal', detail: `Category ${hdr.number} ${medal.medal}: ${medal.body}` });
        continue;
      }
      rows.push({
        year: String(year),
        competition,
        section,
        category_number: hdr.number,
        category_name: hdr.name,
        entries: String(hdr.entries),
        medal: medal.medal,
        ...split,
        source,
        notes: '',
      });
    }
  }
  const awards = parseBreweryOfTheYear(text, { year, competition, source });
  return { rows, categories, awards, problems };
}

// "Brewery and Brewer of the Year, 1 - 250 Barrels: Brewery Name, City, ST" and the
// older "Very Small Brewing Company and Very Small Brewing Company Brewer of the Year".
export function parseBreweryOfTheYear(text, { year, competition = 'GABF', source = '' } = {}) {
  const awards = [];
  const re = /((?:Very Small|Small|Mid-Size|Large|Very Large)?\s*(?:Brewing Company|Brewpub|Brewery|Brewery Group|Brew Pub)[^:]{0,80}?of the Year(?:[^:]{0,80}?)?)\s*[:：]\s*([^:]+?)(?=(?:Very Small|Small|Mid-Size|Large|Very Large|Brewing Company|Brewpub|Brewery|Brewery Group|Category\s+\d|Pro-Am|$))/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const title = collapseWhitespace(m[1]);
    const body = collapseWhitespace(m[2]).replace(/[.;,\s]+$/, '');
    const parts = body.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length < 2) continue;
    const state = normalizeState(parts[parts.length - 1]);
    if (!US_STATES[state]) continue;
    const city = parts[parts.length - 2];
    const breweryPrinted = parts.slice(0, parts.length - 2).join(', ');
    const bracket = (title.match(/(\d[\d,]*)\s*[-–—]\s*(\d[\d,]*)\s*barrels?|(?:over|>)\s*(\d[\d,]*)\s*barrels?|(\d[\d,]*)\+\s*barrels?/i) ?? [])[0] ?? '';
    const { name, location } = splitLocationSuffix(breweryPrinted);
    awards.push({ year: String(year), competition, award: title, bracket, brewery_printed: breweryPrinted, brewery_name: name, brewery_location: location, city, state, source });
  }
  return awards;
}
