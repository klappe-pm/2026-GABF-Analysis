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
  return /Category\s*:?\s*(\d+[A-Za-z]?)\s*[:.]\s*(.+?)\s*[-–—:]\s*(\d{1,4})\s+Entr(?:y|ies)/gi;
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
  // A page footer or the next section's heading can trail the state ("CO 2021 WINNERS LIST ..."); keep only the leading state token.
  const lastToken = parts[parts.length - 1].split(' ')[0];
  if (US_STATES[normalizeState(lastToken)] && !US_STATES[normalizeState(parts[parts.length - 1])]) parts[parts.length - 1] = lastToken;
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
  // Strip the running page footer the 2026 PDF repeats ("0 02 TELL6NR IERS 2 GreatAmericanBeerFestival.com"), which otherwise glues onto the last medal of a page.
  const text = collapseWhitespace(normalizePunctuation(rawText)).replace(/(?:\d+[\s\0]+){1,2}TELL6NR[\s\0]+IERS[\s\0]+\d+\s+GreatAmericanBeerFestival\.com/gi, ' ').replace(/\0/g, ' ');
  const rows = [];
  const problems = [];
  const categories = [];
  const headerRe = categoryHeaderRegex();
  const headers = [];
  let h;
  while ((h = headerRe.exec(text)) !== null) {
    headers.push({ number: h[1], name: collapseWhitespace(h[2]), entries: Number(h[3]), start: h.index, bodyStart: h.index + h[0].length });
  }
  // 2022 and 2023 introduce Pro-Am and Collaboration with an unnumbered header ("Category : Pro-Am Competition - 50 Entries"); give them the 500 and 501 numbers later years use.
  const unnumbered = /(?:Category\s*:?\s*)?\b(Pro-?Am|Collab(?:oration)?)\s+Competition\s*[^\w\s]\s*(\d{1,4})\s+Entr(?:y|ies)/gi;
  let u;
  while ((u = unnumbered.exec(text)) !== null) {
    const isProAm = /pro/i.test(u[1]);
    headers.push({ number: isProAm ? '500' : '501', name: isProAm ? 'Pro-Am Comp' : 'Collab Comp', entries: Number(u[2]), start: u.index, bodyStart: u.index + u[0].length });
  }
  headers.sort((a, b) => a.start - b.start);
  if (headers.length === 0) problems.push({ kind: 'no-categories', detail: 'No "Category N: Name - N Entries" headers found.' });
  for (let i = 0; i < headers.length; i += 1) {
    const hdr = headers[i];
    const end = i + 1 < headers.length ? headers[i + 1].start : text.length;
    let block = text.slice(hdr.bodyStart, end);
    // Trim trailing Brewery of the Year material that follows the final category.
    const awardsHeading = block.search(/(?:\d{4}\s+)?Brewery of the year awards/i);
    const boty = awardsHeading >= 0 ? awardsHeading : block.search(/Brew(?:ery|er|pub|ing)[^.]{0,40}of the Year/i);
    if (boty > 0) block = block.slice(0, boty).replace(/\s*[>\d][^A-Za-z]*Barrels\s*$/i, '');
    const section = /pro-?am/i.test(hdr.name) ? 'pro-am' : /collab/i.test(hdr.name) ? 'collaboration' : sectionHeader(text, hdr.start);
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
  const awards = parseBreweryOfTheYear(text, { year, competition, source, rows });
  const awardTitles = (text.match(/Brewery and Brewer of the Year|Cidermaker of the Year/g) ?? []).length;
  if (awardTitles && awards.length !== awardTitles) problems.push({ kind: 'award-count', detail: `${awardTitles} Brewery of the Year headings but ${awards.length} awards parsed.` });
  return { rows, categories, awards, problems };
}

// "Brewery and Brewer of the Year, 1 - 250 Barrels: Brewery Name, City, ST" and the
// older "Very Small Brewing Company and Very Small Brewing Company Brewer of the Year".
export function parseBreweryOfTheYear(text, { year, competition = 'GABF', source = '', rows = [] } = {}) {
  const awards = [];
  // 2026 layout: "0-250 Barrels Brewery and Brewer of the Year Name | City, ST Brewer Name" and "Cidermaker of the Year Name | City, ST Maker Names".
  const pipeRe = /((?:>\s*)?[\d,]+(?:\s*[^\sA-Za-z\d,|]\s*[\d,]+|\+)?\s*Barrels\s+)?((?:Brewery and Brewer|Cidermaker) of the Year)\s+([^|]+?)\s*\|\s*([^,|]+?),\s*([A-Z]{2})\b/g;
  let p;
  while ((p = pipeRe.exec(text)) !== null) {
    const bracket = collapseWhitespace((p[1] ?? '').replace(/\s*Barrels\s*$/i, ''));
    const breweryPrinted = collapseWhitespace(p[3]);
    const { name, location } = splitLocationSuffix(breweryPrinted);
    const title = bracket ? `${p[2]}, ${bracket} Barrels` : p[2];
    awards.push({ year: String(year), competition, award: title, bracket, brewery_printed: breweryPrinted, brewery_name: name, brewery_location: location, city: collapseWhitespace(p[4]), state: p[5], source });
  }
  if (awards.length) return awards;
  // 2021 to 2025 layout: "0-250 Barrels Brewery and Brewer of the Year [Sponsored by X] Name, City, ST Brewer Names". A sponsor name can sit in front of the brewery, so the brewery is resolved against that year's medal rows (a Brewery of the Year winner always medaled).
  const known = [...new Map(rows.map((r) => [`${r.brewery_printed}, ${r.city}, ${r.state}`, r])).entries()];
  const titleRe = /(Brewery and Brewer of the Year|Cidermaker of the Year)/g;
  let t;
  const colonLayout = /Brew(?:ing Company|pub|ery|er)[^:|]{0,60}of the Year[^:|]{0,40}[:：]/.test(text);
  while (!colonLayout && (t = titleRe.exec(text)) !== null) {
    const before = text.slice(Math.max(0, t.index - 40), t.index);
    const bracketMatch = before.match(/((?:>\s*)?[\d,]+(?:\s*[^\sA-Za-z\d,|]\s*[\d,]+|\+)?)\s*Barrels\s*$/) ?? before.match(/(Brewery Group)\s*$/);
    const bracket = bracketMatch ? collapseWhitespace(bracketMatch[1]) : '';
    const windowStart = t.index + t[0].length;
    const nextTitle = text.slice(windowStart).search(/Brewery and Brewer of the Year|Cidermaker of the Year/);
    const window = text.slice(windowStart, nextTitle >= 0 ? windowStart + nextTitle : windowStart + 200).slice(0, 200);
    let best = null;
    for (const [key, row] of known) {
      const at = Math.max(window.indexOf(key), window.indexOf(key.replace(/, ([A-Z]{2})$/, ' $1')));
      if (at < 0) continue;
      if (!best || at < best.at || (at === best.at && key.length > best.key.length)) best = { at, key, row };
    }
    if (!best) {
      // The winner did not medal in a category, so it is not in the rows: take the text up to "City, ST", splitting name from city at the last brewery-ish word.
      const unsponsored = window.replace(/^\s*Sponsored by (?:Prairie Malt|Brewers Supply Group|Fermentis|ABS Commercial|Country Malt Group|Briess Malt & Ingredients Co\.|Live Oak Bank|Hurst Boilers|Hass|RahrBSG|MicroStar Logistics|Beer Law Center|American Cider Association)\s+/i, '');
      // "Name - City, ST" (2022) or "Name City, ST" (later years).
      const dashed = unsponsored.match(/^(.+?)\s+[^\w\s,]\s+([A-Za-z.' ]+?),?\s+([A-Z]{2})\b/);
      const stateAt = unsponsored.search(/,\s*[A-Z]{2}\b/);
      const stateCode = stateAt >= 0 ? unsponsored.slice(stateAt).match(/,\s*([A-Z]{2})\b/)[1] : '';
      const split = dashed ? [null, dashed[1], dashed[2]] : stateAt >= 0 ? unsponsored.slice(0, stateAt).trim().match(/^(.*(?:Brew\w*|Co\.|Cider\w*|Company|Inc\.?|LLC|Taproom|Pub|House|Works)\.?),?\s+(\S.*)$/) : null;
      const stateFinal = dashed ? dashed[3] : stateCode;
      if (!split || !US_STATES[stateFinal] || /Sponsored by/i.test(split[1])) continue;
      const { name, location } = splitLocationSuffix(split[1]);
      awards.push({ year: String(year), competition, award: bracket && /^[\d>]/.test(bracket) ? `${t[1]}, ${bracket} Barrels` : bracket ? `${bracket} ${t[1]}` : t[1], bracket, brewery_printed: split[1], brewery_name: name, brewery_location: location, city: split[2], state: stateFinal, source });
      continue;
    }
    const title = bracket &&/^[\d>]/.test(bracket) ? `${t[1]}, ${bracket} Barrels` : bracket ? `${bracket} ${t[1]}` : t[1];
    awards.push({ year: String(year), competition, award: title, bracket, brewery_printed: best.row.brewery_printed, brewery_name: best.row.brewery_name, brewery_location: best.row.brewery_location, city: best.row.city, state: best.row.state, source });
  }
  if (awards.length) return awards;
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
