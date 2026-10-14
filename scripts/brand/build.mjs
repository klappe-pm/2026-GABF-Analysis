#!/usr/bin/env node
// The brand, generated from one place. .design/design-system/settings.md sets every brand color (the
// seed, the exact primary, the page background, and the medal metals); the chart card spec names the
// Material roles the chart series take. This script runs the same Material 3 scheme code the design
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
import { COMPONENTS_DIR, SETTINGS, design, readDoc, rel } from '../design-system/lib.mjs';
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
const CHART_SPEC = resolve(COMPONENTS_DIR, 'chart-card/spec.md');

// Tones of the primary palette for sequential scales (maps and heatmaps), lightest first.
const SEQUENTIAL_TONES = [96, 88, 78, 68, 58, 44, 30];
const WHITE = '#ffffff';

const kebab = (role) => role.trim().replace(/\s+/g, '-');

// Blend two hex colors; t is the share of b.
export function mix(a, b, t) {
  const ch = (hex, i) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2].map((i) => Math.round(ch(a, i) * (1 - t) + ch(b, i) * t).toString(16).padStart(2, '0')).join('')}`;
}

// Every brand color and the page layout settings, resolved from the settings. Throws when a color misses its contrast floor, so a
// settings change that breaks AA never reaches a page.
export async function brandModel() {
  const d = await design();
  const { argbFromHex, hexFromArgb, TonalPalette } = await colorUtilities();
  const g = d.mergeGlobal({}, readDoc(SETTINGS).data);
  const scheme = d.schemeFor(g);
  const roles = d.componentSettings('chart-card', readDoc(CHART_SPEC).data)['Series colors'];
  if (!Array.isArray(roles) || roles.length < 5) throw new Error(`${rel(CHART_SPEC)}: Series colors must list five Material roles`);
  const seriesRoles = roles.slice(0, 5);
  const series = seriesRoles.map((r) => scheme[r]);
  const medal = { gold: String(g['Gold medal color']).toLowerCase(), silver: String(g['Silver medal color']).toLowerCase(), bronze: String(g['Bronze medal color']).toLowerCase() };
  const textOn = (fill) => (d.contrast(fill, scheme['on surface']) >= d.contrast(fill, WHITE) ? scheme['on surface'] : WHITE);
  const palette = TonalPalette.fromInt(argbFromHex(scheme.primary));
  const sequential = SEQUENTIAL_TONES.map((t) => hexFromArgb(palette.tone(t)));

  const problems = [];
  const floor = (name, fg, bg, min) => { const r = d.contrast(fg, bg); if (r < min) problems.push(`${name}: ${fg} on ${bg} is ${r} to 1, needs ${min}`); };
  if (g['Primary color'] && scheme.primary !== String(g['Primary color']).toLowerCase()) problems.push(`primary renders as ${scheme.primary}, not the Primary color ${g['Primary color']}`);
  if (g['Page background'] === 'white' && scheme.background !== WHITE) problems.push(`page background is ${scheme.background}, not white`);
  for (const row of d.contrastReport(scheme)) if (!row.pass) problems.push(`${row.fg} on ${row.bg}: ${row.ratio} to 1, needs ${row.min}`);
  series.forEach((c, i) => floor(`series ${i + 1} (${seriesRoles[i]})`, c, scheme.background, 3));
  for (const [k, c] of Object.entries(medal)) { floor(`${k} medal mark`, c, scheme.background, 3); floor(`text on the ${k} medal`, textOn(c), c, 4.5); }
  sequential.forEach((c, i) => floor(`text on sequential step ${i + 1}`, textOn(c), c, 4.5));
  floor('darkest sequential step', sequential.at(-1), scheme.background, 3);
  if (problems.length) throw new Error(`brand colors fail their checks:\n${problems.join('\n')}`);

  const PAGE_MAX = { fill: 'none', wide: '1600px', standard: '1280px' };
  const layout = {
    pageMax: PAGE_MAX[String(g['Page width'] ?? 'fill')] ?? 'none',
    compactMargin: `${Number(g['Compact margin'] ?? 16)}px`,
    wideMargin: `${Number(g['Wide margin'] ?? 24)}px`,
  };

  return {
    source: [rel(SETTINGS), rel(CHART_SPEC)],
    layout,
    scheme,
    medal,
    onMedal: Object.fromEntries(Object.entries(medal).map(([k, c]) => [k, textOn(c)])),
    seriesRoles,
    series,
    sequential,
    onSequential: sequential.map(textOn),
  };
}

const HEADER = 'Generated by scripts/brand/build.mjs from .design/design-system/settings.md and the chart card spec. Do not edit this file: change the settings, then run npm run brand.';

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
