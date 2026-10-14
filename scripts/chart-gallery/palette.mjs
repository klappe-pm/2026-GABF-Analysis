// Colors for the chart gallery, all read from site/assets/brand.json (generated from the design
// settings by scripts/brand/build.mjs), with the WCAG contrast of each pairing computed and enforced
// when the page is built. Text needs 4.5 to 1 against its fill; a mark needs 3 to 1 against the page.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from '../lib/paths.mjs';

const BRAND = JSON.parse(readFileSync(resolve(ROOT, 'site/assets/brand.json'), 'utf8'));
const S = BRAND.scheme;

const PAGE = S.background;
// Text on a dark fill: Material's on primary, which is white.
const ON_DARK = S['on primary'];
export const INK = S['on surface'];
export const INK_SECONDARY = S['on surface variant'];
export const OUTLINE = S.outline;
export const GRID = S['outline variant'];

function lum(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
export function contrast(a, b) {
  const x = lum(a);
  const y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
// The text color that reads better on a fill.
export const textOn = (fill) => (contrast(fill, INK) >= contrast(fill, ON_DARK) ? INK : ON_DARK);

const [s1, s2, s3, s4] = BRAND.series;
export const MEDAL = { Gold: BRAND.medal.gold, Silver: BRAND.medal.silver, Bronze: BRAND.medal.bronze };
export const REGION = { Midwest: s1, Northeast: s2, South: s3, West: s4 };
export const SERIES = BRAND.series;
// Style families: the first four series colors. Charts that show more families label every mark,
// and a stacked chart folds the rest into its "All other families" band in the outline gray.
export const FAMILY = [s1, s2, s3, s4];

const seq = BRAND.sequential;
const bins = (edges, fills) => edges.map((min, i) => ({ min, max: i + 1 < edges.length ? edges[i + 1] - 1 : Infinity, fill: fills[i], text: textOn(fills[i]) }));

// Medal counts per state: zero, then six steps of the brand's sequential scale.
export const SEQ_STATE = bins([0, 1, 10, 25, 50, 100, 250], seq);
// Medals per brewery in one year.
export const SEQ_SMALL = bins([0, 1, 2, 3, 4], [seq[0], seq[2], seq[4], seq[5], seq[6]]);
// Entries per medal.
export const SEQ_ODDS = bins([0, 15, 30, 45, 70, 100], [seq[0], seq[1], seq[2], seq[4], seq[5], seq[6]]);

export function checkContrast() {
  const problems = [];
  const text = (name, fill, fg) => { if (contrast(fill, fg) < 4.5) problems.push(`${name}: text ${fg} on ${fill} is ${contrast(fill, fg).toFixed(2)}`); };
  const mark = (name, fill) => { if (contrast(fill, PAGE) < 3) problems.push(`${name}: mark ${fill} on the page is ${contrast(fill, PAGE).toFixed(2)}`); };
  for (const [k, v] of Object.entries(MEDAL)) { mark(k, v); text(k, v, textOn(v)); }
  for (const [k, v] of Object.entries(REGION)) { mark(k, v); text(k, v, textOn(v)); }
  for (const v of SERIES) mark('series', v);
  for (const v of FAMILY) { mark('family', v); text('family', v, textOn(v)); }
  for (const set of [SEQ_STATE, SEQ_SMALL, SEQ_ODDS]) for (const b of set) text(`bin ${b.min}`, b.fill, b.text);
  text('ink on the page', PAGE, INK);
  text('secondary on the page', PAGE, INK_SECONDARY);
  return problems;
}

export function paletteForPage() {
  const textMap = {};
  for (const v of [...Object.values(MEDAL), ...Object.values(REGION), ...SERIES, ...FAMILY]) textMap[v] = textOn(v);
  return { page: PAGE, onDark: ON_DARK, ink: INK, inkSecondary: INK_SECONDARY, outline: OUTLINE, grid: GRID, noData: S['surface container'], medal: MEDAL, region: REGION, series: SERIES, family: FAMILY, other: OUTLINE, textOn: textMap, seqState: SEQ_STATE.map(strip), seqSmall: SEQ_SMALL.map(strip), seqOdds: SEQ_ODDS.map(strip) };
}
// JSON cannot carry Infinity.
const strip = (b) => ({ ...b, max: Number.isFinite(b.max) ? b.max : null });
