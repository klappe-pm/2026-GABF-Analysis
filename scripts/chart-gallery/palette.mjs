// Colors for the chart gallery, with the WCAG contrast of each pairing computed and enforced
// when the page is built. Text needs 4.5 to 1 against its fill; a mark needs 3 to 1 against white.

const WHITE = '#FFFFFF';
export const INK = '#1C1B1F';
export const INK_SECONDARY = '#49454F';
export const OUTLINE = '#79747E';

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
export const textOn = (fill) => (contrast(fill, INK) >= contrast(fill, WHITE) ? INK : WHITE);

export const MEDAL = { Gold: '#B8860B', Silver: '#8A9199', Bronze: '#A5602B' };
export const REGION = { Midwest: '#00696B', Northeast: '#6750A4', South: '#A8273D', West: '#1F5FA6' };
export const SERIES = ['#6750A4', '#00696B', '#A8273D'];
export const FAMILY = ['#6750A4', '#00696B', '#A8273D', '#1F5FA6', '#7A5200', '#4E6A1F', '#8F2F72', '#005F8F'];

const bins = (edges, fills) => edges.map((min, i) => ({ min, max: i + 1 < edges.length ? edges[i + 1] - 1 : Infinity, fill: fills[i], text: textOn(fills[i]) }));

// Medal counts per state: zero, then six steps of one purple ramp.
export const SEQ_STATE = bins([0, 1, 10, 25, 50, 100, 250], ['#F4EFF4', '#EADDFF', '#D0BCFF', '#B69DF8', '#9A82DB', '#7F67BE', '#4F378B']);
// Medals per brewery in one year.
export const SEQ_SMALL = bins([0, 1, 2, 3, 4], ['#F4EFF4', '#D0BCFF', '#9A82DB', '#7F67BE', '#4F378B']);
// Entries per medal.
export const SEQ_ODDS = bins([0, 15, 30, 45, 70, 100], ['#F4EFF4', '#EADDFF', '#D0BCFF', '#9A82DB', '#7F67BE', '#4F378B']);

export function checkContrast() {
  const problems = [];
  const text = (name, fill, fg) => { if (contrast(fill, fg) < 4.5) problems.push(`${name}: text ${fg} on ${fill} is ${contrast(fill, fg).toFixed(2)}`); };
  const mark = (name, fill) => { if (contrast(fill, WHITE) < 3) problems.push(`${name}: mark ${fill} on white is ${contrast(fill, WHITE).toFixed(2)}`); };
  for (const [k, v] of Object.entries(MEDAL)) { mark(k, v); text(k, v, textOn(v)); }
  for (const [k, v] of Object.entries(REGION)) { mark(k, v); text(k, v, WHITE); }
  for (const v of SERIES) mark('series', v);
  for (const v of FAMILY) { mark('family', v); text('family', v, WHITE); }
  for (const set of [SEQ_STATE, SEQ_SMALL, SEQ_ODDS]) for (const b of set) text(`bin ${b.min}`, b.fill, b.text);
  text('ink on white', WHITE, INK);
  text('secondary on white', WHITE, INK_SECONDARY);
  text('outline on white', WHITE, OUTLINE);
  return problems;
}

export function paletteForPage() {
  const textMap = {};
  for (const v of [...Object.values(MEDAL), ...Object.values(REGION), ...SERIES, ...FAMILY]) textMap[v] = textOn(v);
  return { ink: INK, inkSecondary: INK_SECONDARY, outline: OUTLINE, medal: MEDAL, region: REGION, series: SERIES, family: FAMILY, textOn: textMap, seqState: SEQ_STATE.map(strip), seqSmall: SEQ_SMALL.map(strip), seqOdds: SEQ_ODDS.map(strip) };
}
// JSON cannot carry Infinity.
const strip = (b) => ({ ...b, max: Number.isFinite(b.max) ? b.max : null });
