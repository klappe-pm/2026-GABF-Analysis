#!/usr/bin/env node
// The brand, generated from one place. .design/design-system/settings.md sets every brand color (the
// seed, the exact primary, the page background, the medal metals, the five chart series colors, and the
// page layout). This script runs the same Material 3 scheme code the design
// system uses (web/design/theme.ts, bundled by scripts/design-system/lib.mjs) and writes:
//   site/assets/brand.css        the scheme, medal, series, and sequential colors as custom properties
//   site/assets/brand.json       the same colors for chart code that runs at build time
//   docs/assets/banner-light.svg the README banner on a light page
//   docs/assets/banner-dark.svg  the README banner on a dark page
// Every surface reads these files; none of them sets a color of its own.
//
//   node scripts/brand/build.mjs           write the outputs
//   node scripts/brand/build.mjs --check   list outputs that are out of date and exit 1 if any are

import { mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildSync } from 'esbuild';
import { SETTINGS, design, readDoc, rel } from '../design-system/lib.mjs';
import { ROOT } from '../lib/paths.mjs';

// Material's color library uses extensionless imports that Node cannot load directly, so it is
// bundled here the same way scripts/design-system/lib.mjs bundles the theme code.
async function colorUtilities() {
  const out = buildSync({
    stdin: { contents: "export { argbFromHex, hexFromArgb, TonalPalette } from '@material/material-color-utilities';", resolveDir: ROOT, loader: 'js' },
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    logLevel: 'silent',
  });
  return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
}

export const BRAND_CSS = resolve(ROOT, 'site/assets/brand.css');
export const BRAND_JSON = resolve(ROOT, 'site/assets/brand.json');
export const BANNER_LIGHT = resolve(ROOT, 'docs/assets/banner-light.svg');
export const BANNER_DARK = resolve(ROOT, 'docs/assets/banner-dark.svg');

// Tones of the primary palette for sequential scales (maps and heatmaps), lightest first.
const SEQUENTIAL_TONES = [96, 88, 78, 68, 58, 44, 30];
const WHITE = '#ffffff';

const kebab = (role) => role.trim().replace(/\s+/g, '-');

// Blend two hex colors; t is the share of b.
export function mix(a, b, t) {
  const ch = (hex, i) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2].map((i) => Math.round(ch(a, i) * (1 - t) + ch(b, i) * t).toString(16).padStart(2, '0')).join('')}`;
}

// ---------- telling series apart ----------
// Colors are compared in OKLab (difference times 100), as seen with full color vision and as simulated
// for deuteranopia and protanopia (Machado, Oliveira and Fernandes 2009, severity 1). Charts draw series
// side by side in stacks, bars, and lines, so each pair of neighbours in the series order is checked:
// 15 or more for full color vision, 8 or more under each simulation.
const CVD = {
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
};
const toLinear = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const linearRgb = (hex) => [0, 1, 2].map((i) => toLinear(parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)));
const clamp = (v) => Math.min(1, Math.max(0, v));
function oklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
const simulate = (rgb, mtx) => mtx.map((row) => clamp(row[0] * rgb[0] + row[1] * rgb[1] + row[2] * rgb[2]));
const deltaE = (a, b) => Math.round(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * 1000) / 10;

export function seriesSeparation(series) {
  const rows = [];
  for (let i = 0; i + 1 < series.length; i += 1) {
    const [a, b] = [linearRgb(series[i]), linearRgb(series[i + 1])];
    rows.push({ a: i + 1, b: i + 2, vision: 'full color', delta: deltaE(oklab(a), oklab(b)), min: 15 });
    for (const [name, mtx] of Object.entries(CVD)) rows.push({ a: i + 1, b: i + 2, vision: name, delta: deltaE(oklab(simulate(a, mtx)), oklab(simulate(b, mtx))), min: 8 });
  }
  return rows.map((r) => ({ ...r, pass: r.delta >= r.min }));
}

// Every brand color and the page layout settings, resolved from the settings. Throws when a color misses its contrast floor, so a
// settings change that breaks AA never reaches a page.
export async function brandModel() {
  const d = await design();
  const { argbFromHex, hexFromArgb, TonalPalette } = await colorUtilities();
  const g = d.mergeGlobal({}, readDoc(SETTINGS).data);
  const scheme = d.schemeFor(g);
  const series = [1, 2, 3, 4, 5].map((n) => String(g[`Series ${n} color`] ?? '').toLowerCase());
  const medal = { gold: String(g['Gold medal color']).toLowerCase(), silver: String(g['Silver medal color']).toLowerCase(), bronze: String(g['Bronze medal color']).toLowerCase() };
  const textOn = (fill) => (d.contrast(fill, scheme['on surface']) >= d.contrast(fill, WHITE) ? scheme['on surface'] : WHITE);
  const palette = TonalPalette.fromInt(argbFromHex(scheme.primary));
  const sequential = SEQUENTIAL_TONES.map((t) => hexFromArgb(palette.tone(t)));

  const problems = [];
  const floor = (name, fg, bg, min) => { const r = d.contrast(fg, bg); if (r < min) problems.push(`${name}: ${fg} on ${bg} is ${r} to 1, needs ${min}`); };
  if (g['Primary color'] && scheme.primary !== String(g['Primary color']).toLowerCase()) problems.push(`primary renders as ${scheme.primary}, not the Primary color ${g['Primary color']}`);
  if (g['Page background'] === 'white' && scheme.background !== WHITE) problems.push(`page background is ${scheme.background}, not white`);
  for (const row of d.contrastReport(scheme)) if (!row.pass) problems.push(`${row.fg} on ${row.bg}: ${row.ratio} to 1, needs ${row.min}`);
  series.forEach((c, i) => { if (!/^#[0-9a-f]{6}$/.test(c)) problems.push(`Series ${i + 1} color is missing or not a hex color`); else floor(`series ${i + 1}`, c, scheme.background, 3); });
  for (const c of series) if (Object.values(medal).includes(c)) problems.push(`series color ${c} repeats a medal color`);
  if (problems.length === 0) for (const row of seriesSeparation(series)) if (!row.pass) problems.push(`series ${row.a} and ${row.b} are too alike for ${row.vision} vision: difference ${row.delta}, needs ${row.min}`);
  for (const [k, c] of Object.entries(medal)) { floor(`${k} medal mark`, c, scheme.background, 3); floor(`text on the ${k} medal`, textOn(c), c, 4.5); }
  sequential.forEach((c, i) => floor(`text on sequential step ${i + 1}`, textOn(c), c, 4.5));
  floor('darkest sequential step', sequential.at(-1), scheme.background, 3);
  if (problems.length) throw new Error(`brand colors fail their checks:\n${problems.join('\n')}`);

  const layout = {
    pageMax: d.pageMax(g['Page width']),
    compactMargin: `${Number(g['Compact margin'] ?? 16)}px`,
    wideMargin: `${Number(g['Wide margin'] ?? 24)}px`,
  };

  return {
    source: rel(SETTINGS),
    layout,
    scheme,
    medal,
    onMedal: Object.fromEntries(Object.entries(medal).map(([k, c]) => [k, textOn(c)])),
    series,
    seriesContrast: series.map((c) => d.contrast(c, scheme.background)),
    seriesSeparation: seriesSeparation(series),
    sequential,
    onSequential: sequential.map(textOn),
  };
}

const HEADER = 'Generated by scripts/brand/build.mjs from .design/design-system/settings.md. Do not edit this file: change the settings, then run npm run brand.';

export function brandCss(m) {
  const lines = [`/* ${HEADER} */`, ':root {'];
  for (const [role, hex] of Object.entries(m.scheme)) lines.push(`  --md-sys-color-${kebab(role)}: ${hex};`);
  for (const [k, hex] of Object.entries(m.medal)) lines.push(`  --app-color-${k}: ${hex};`);
  for (const [k, hex] of Object.entries(m.onMedal)) lines.push(`  --brand-on-${k}: ${hex};`);
  m.series.forEach((hex, i) => lines.push(`  --brand-series-${i + 1}: ${hex};`));
  m.sequential.forEach((hex, i) => lines.push(`  --brand-seq-${i + 1}: ${hex};`));
  m.onSequential.forEach((hex, i) => lines.push(`  --brand-on-seq-${i + 1}: ${hex};`));
  lines.push(`  --brand-page-max: ${m.layout.pageMax};`);
  lines.push(`  --brand-margin-compact: ${m.layout.compactMargin};`);
  lines.push(`  --brand-margin-wide: ${m.layout.wideMargin};`);
  lines.push('}');
  return `${lines.join('\n')}\n`;
}

export const brandJson = (m) => `${JSON.stringify({ note: HEADER, ...m }, null, 2)}\n`;

// The README banner: a medal podium and the wordmark, in brand colors only. GitHub shows it as an
// image, where custom properties do not resolve, so the colors are written out here.
export function bannerSvg(m, variant) {
  const s = m.scheme;
  const dark = variant === 'dark';
  const c = dark
    ? { page: s['inverse surface'], frame: s['on surface variant'], step: s['on surface variant'], line: s.outline, number: s['outline variant'], word: s['inverse on surface'], accent: s['inverse primary'], sub: s['outline variant'] }
    : { page: s.background, frame: s['outline variant'], step: s['surface container high'], line: s['outline variant'], number: s['on surface variant'], word: s['on surface'], accent: s.primary, sub: s['on surface variant'] };
  const coin = (cx, cy, fill) => `    <circle cx="${cx}" cy="${cy}" r="28" fill="${fill}" stroke="${mix(fill, '#000000', dark ? 0.45 : 0.3)}" stroke-width="1.5"/>
    <circle cx="${cx}" cy="${cy}" r="20" fill="none" stroke="${mix(fill, WHITE, 0.7)}" stroke-opacity="0.6" stroke-width="1.5"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640" role="img" aria-labelledby="title desc">
  <title id="title">GABF Analysis</title>
  <desc id="desc">Wordmark for GABF Analysis: Great American Beer Festival Results, 2018 to 2026, with gold, silver, and bronze medals on a podium.</desc>
  <rect x="1" y="1" width="638" height="638" fill="${c.page}" stroke="${c.frame}" stroke-width="2"/>
  <g font-family="'Public Sans', sans-serif">
    <line x1="200" y1="270" x2="440" y2="270" stroke="${c.line}" stroke-width="1.5"/>
    <rect x="216" y="226" width="64" height="44" fill="${c.step}"/>
    <rect x="288" y="206" width="64" height="64" fill="${c.step}"/>
    <rect x="360" y="242" width="64" height="28" fill="${c.step}"/>
    <g text-anchor="middle" font-size="15" font-weight="500" fill="${c.number}">
      <text x="248" y="254">2</text>
      <text x="320" y="244">1</text>
      <text x="392" y="262">3</text>
    </g>
${coin(248, 190, m.medal.silver)}
${coin(320, 170, m.medal.gold)}
${coin(392, 206, m.medal.bronze)}
    <g text-anchor="middle">
      <text x="320" y="370" font-size="64" letter-spacing="-1" fill="${c.word}"><tspan font-weight="700">GABF</tspan><tspan font-weight="300" dx="14" fill="${c.accent}">Analysis</tspan></text>
      <text x="320" y="414" font-family="'Archivo Narrow', 'Public Sans', sans-serif" font-size="23" letter-spacing="0.4" fill="${c.sub}">Great American Beer Festival Results</text>
      <rect x="268" y="440" width="32" height="3" fill="${m.medal.gold}"/>
      <rect x="304" y="440" width="32" height="3" fill="${m.medal.silver}"/>
      <rect x="340" y="440" width="32" height="3" fill="${m.medal.bronze}"/>
      <text x="320" y="482" font-size="19" letter-spacing="1.5" fill="${c.sub}">2018 to 2026</text>
    </g>
  </g>
</svg>
`;
}

export async function brandOutputs() {
  const m = await brandModel();
  return new Map([
    [BRAND_CSS, brandCss(m)],
    [BRAND_JSON, brandJson(m)],
    [BANNER_LIGHT, bannerSvg(m, 'light')],
    [BANNER_DARK, bannerSvg(m, 'dark')],
  ]);
}

// Outputs whose committed text differs from what the settings produce.
export async function staleOutputs() {
  const stale = [];
  for (const [file, text] of await brandOutputs()) if (!existsSync(file) || readFileSync(file, 'utf8') !== text) stale.push(rel(file));
  return stale;
}

async function main() {
  if (process.argv.includes('--check')) {
    const stale = await staleOutputs();
    if (stale.length) {
      console.error(`brand outputs are out of date with .design/design-system/settings.md (run npm run brand):\n${stale.join('\n')}`);
      process.exit(1);
    }
    console.log('brand outputs match the settings');
    return;
  }
  for (const [file, text] of await brandOutputs()) {
    mkdirSync(dirname(file), { recursive: true });
    if (existsSync(file) && readFileSync(file, 'utf8') === text) continue;
    writeFileSync(file, text);
    console.log(`wrote ${rel(file)}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => { console.error(err.message); process.exit(1); });
}
