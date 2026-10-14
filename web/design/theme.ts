// Turns the global settings into Material's CSS custom properties: the light color scheme generated from
// the seed color, the corner scale, the typefaces, and the type scale. Runs at build time (the baked
// fallback in web/app/layout.tsx), in the browser (when the settings files load), and in the design
// system check (contrast). Light only: the site has one light theme.
import {
  argbFromHex, DynamicScheme, Hct, hexFromArgb, MaterialDynamicColors,
  SchemeContent, SchemeExpressive, SchemeFidelity, SchemeNeutral, SchemeTonalSpot, SchemeVibrant, TonalPalette,
} from '@material/material-color-utilities';
import { COLOR_ROLES, type ColorRole, type Settings, TYPE_ROLES, type TypeRole, typeClass, typeSizeKey } from './schema';

const STYLES: Record<string, new (source: Hct, isDark: boolean, contrastLevel: number) => DynamicScheme> = {
  'tonal spot': SchemeTonalSpot,
  neutral: SchemeNeutral,
  vibrant: SchemeVibrant,
  expressive: SchemeExpressive,
  fidelity: SchemeFidelity,
  content: SchemeContent,
};
const CONTRAST: Record<string, number> = { standard: 0, medium: 0.5, high: 1 };

const camel = (role: string) => role.replace(/ (\w)/g, (_, c: string) => c.toUpperCase());
const kebab = (role: string) => role.replace(/ /g, '-');

export type Scheme = Record<ColorRole, string>;

// The light scheme for a seed: every Material color role as a hex value.
// The seed sets the primary, secondary, and tertiary palettes; Material takes primary at tone 40 of the
// seed's hue, so the primary color is a darker relative of the seed, not the seed itself. With
// "Surface tint: none" the neutral palettes carry no chroma, so surfaces are white and true grays and the
// seed's hue shows only in the accent roles. "Primary color" pins the primary role to that exact hex:
// the primary palette keeps that color's own hue and colorfulness, so the containers and on colors
// stay its relatives, and the primary role itself is set to the hex.
export function schemeFor(g: Settings): Scheme {
  const Style = STYLES[String(g['Color style'])] ?? SchemeTonalSpot;
  const source = Hct.fromInt(argbFromHex(String(g['Seed color'])));
  const contrastLevel = CONTRAST[String(g.Contrast)] ?? 0;
  const base = new Style(source, false, contrastLevel);
  const pinned = /^#[0-9a-fA-F]{6}$/.test(String(g['Primary color'] ?? '')) ? String(g['Primary color']) : null;
  const primaryPalette = pinned ? TonalPalette.fromInt(argbFromHex(pinned)) : base.primaryPalette;
  const neutral = g['Surface tint'] !== 'seed';
  const scheme = !neutral && !pinned ? base : new DynamicScheme({
    sourceColorHct: source,
    variant: base.variant,
    contrastLevel,
    isDark: false,
    primaryPalette,
    secondaryPalette: base.secondaryPalette,
    tertiaryPalette: base.tertiaryPalette,
    errorPalette: base.errorPalette,
    neutralPalette: neutral ? TonalPalette.fromHueAndChroma(source.hue, 0) : base.neutralPalette,
    neutralVariantPalette: neutral ? TonalPalette.fromHueAndChroma(source.hue, 0) : base.neutralVariantPalette,
  });
  const colors = MaterialDynamicColors as unknown as Record<string, { getArgb(s: DynamicScheme): number }>;
  const out = Object.fromEntries(COLOR_ROLES.map((role) => [role, hexFromArgb(colors[camel(role)].getArgb(scheme))])) as Scheme;
  if (pinned) out.primary = pinned.toLowerCase();
  // "Page background: white" puts every page on pure white; the container roles keep their grays,
  // so cards, the app bar, and the navigation still stand apart from the page.
  if (g['Page background'] !== 'scheme') for (const role of ['background', 'surface', 'surface bright'] as const) out[role] = '#ffffff';
  return out;
}

// Material's corner scale, in pixels, at the standard ("medium") setting.
const CORNERS = { 'extra-small': 4, small: 8, medium: 12, large: 16, 'extra-large': 28 } as const;
const CORNER_FACTOR: Record<string, number> = { square: 0, small: 0.5, medium: 1, large: 1.5 };

export function corners(g: Settings): Record<string, string> {
  const f = CORNER_FACTOR[String(g['Corner shape'])] ?? 1;
  const out: Record<string, string> = { none: '0px' };
  for (const [k, v] of Object.entries(CORNERS)) out[k] = `${Math.round(v * f)}px`;
  out.full = f === 0 ? '0px' : '9999px';
  return out;
}

// Material's type scale: size and line height in pixels, weight, tracking in pixels.
export const TYPE_SCALE: Record<TypeRole, { size: number; line: number; weight: number; tracking: number }> = {
  'display large': { size: 57, line: 64, weight: 400, tracking: -0.25 },
  'display medium': { size: 45, line: 52, weight: 400, tracking: 0 },
  'display small': { size: 36, line: 44, weight: 400, tracking: 0 },
  'headline large': { size: 32, line: 40, weight: 400, tracking: 0 },
  'headline medium': { size: 28, line: 36, weight: 400, tracking: 0 },
  'headline small': { size: 24, line: 32, weight: 400, tracking: 0 },
  'title large': { size: 22, line: 28, weight: 400, tracking: 0 },
  'title medium': { size: 16, line: 24, weight: 500, tracking: 0.15 },
  'title small': { size: 14, line: 20, weight: 500, tracking: 0.1 },
  'body large': { size: 16, line: 24, weight: 400, tracking: 0.5 },
  'body medium': { size: 14, line: 20, weight: 400, tracking: 0.25 },
  'body small': { size: 12, line: 16, weight: 400, tracking: 0.4 },
  'label large': { size: 14, line: 20, weight: 500, tracking: 0.1 },
  'label medium': { size: 12, line: 16, weight: 500, tracking: 0.5 },
  'label small': { size: 11, line: 16, weight: 500, tracking: 0.5 },
};

// The faces loaded by next/font in web/app/layout.tsx, by their plain names.
export const FONT_STACKS: Record<string, string> = {
  'Public Sans': 'var(--font-public-sans), sans-serif',
  'Archivo Narrow': 'var(--font-archivo-narrow), sans-serif',
};

export type TypeRow = { role: TypeRole; family: string; size: number; line: number; weight: number; tracking: number };

export function typeScale(g: Settings): TypeRow[] {
  return TYPE_ROLES.map((role) => {
    const base = TYPE_SCALE[role];
    const size = typeof g[typeSizeKey(role)] === 'number' ? (g[typeSizeKey(role)] as number) : base.size;
    const line = size === base.size ? base.line : Math.round((size * base.line) / base.size);
    const family = String(role.startsWith('label') ? g['Label font'] : role.startsWith('body') ? g['Body font'] : g['Heading font']);
    return { role, family, size, line, weight: base.weight, tracking: base.tracking };
  });
}

// Every custom property the settings produce.
export function themeVars(g: Settings): Record<string, string> {
  const vars: Record<string, string> = {};
  const scheme = schemeFor(g);
  for (const role of COLOR_ROLES) vars[`--md-sys-color-${kebab(role)}`] = scheme[role];
  for (const [k, v] of Object.entries(corners(g))) vars[`--md-sys-shape-corner-${k}`] = v;
  vars['--md-ref-typeface-brand'] = FONT_STACKS[String(g['Heading font'])] ?? FONT_STACKS['Public Sans'];
  vars['--md-ref-typeface-plain'] = FONT_STACKS[String(g['Body font'])] ?? FONT_STACKS['Public Sans'];
  vars['--app-typeface-label'] = FONT_STACKS[String(g['Label font'])] ?? FONT_STACKS['Public Sans'];
  for (const row of typeScale(g)) {
    const p = `--md-sys-typescale-${kebab(row.role)}`;
    vars[`${p}-font`] = FONT_STACKS[row.family] ?? FONT_STACKS['Public Sans'];
    vars[`${p}-size`] = `${row.size / 16}rem`;
    vars[`${p}-line-height`] = `${row.line / 16}rem`;
    vars[`${p}-weight`] = String(row.weight);
    vars[`${p}-tracking`] = `${row.tracking / 16}rem`;
  }
  vars['--app-color-gold'] = String(g['Gold medal color']);
  vars['--app-color-silver'] = String(g['Silver medal color']);
  vars['--app-color-bronze'] = String(g['Bronze medal color']);
  // Adaptive layout: the page width (none fills the window), and Material's margins per window size class.
  vars['--app-page-max'] = !g['Page width'] || g['Page width'] === 'full' ? 'none' : String(g['Page width']);
  vars['--app-margin-compact'] = `${Number(g['Compact margin'] ?? 16)}px`;
  vars['--app-margin-wide'] = `${Number(g['Wide margin'] ?? 24)}px`;
  return vars;
}

// One class per type role, reading the role's custom properties.
export function typeClassCss(): string {
  return TYPE_ROLES.map((role) => {
    const p = `--md-sys-typescale-${kebab(role)}`;
    return `.${typeClass(role)}{font-family:var(${p}-font);font-size:var(${p}-size);line-height:var(${p}-line-height);font-weight:var(${p}-weight);letter-spacing:var(${p}-tracking)}`;
  }).join('\n');
}

export function rootCss(g: Settings): string {
  const decls = Object.entries(themeVars(g)).map(([k, v]) => `${k}:${v};`).join('');
  // The type classes sit in Tailwind's components layer, so a utility such as font-plain still wins.
  return `@layer theme, base, components, utilities;\n:root{color-scheme:light;${decls}}\n@layer components{\n${typeClassCss()}\n}`;
}

// ---------- contrast ----------

function channel(v: number) {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function luminance(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}
export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100;
}

// Text on its container needs 4.5 to 1; outlines, focus, and chart marks need 3 to 1 (WCAG 2.2 AA).
export const TEXT_PAIRS: [ColorRole, ColorRole][] = [
  ['on background', 'background'],
  ['on surface', 'surface'],
  ['on surface', 'surface container lowest'],
  ['on surface', 'surface container low'],
  ['on surface', 'surface container'],
  ['on surface', 'surface container high'],
  ['on surface', 'surface container highest'],
  ['on surface variant', 'surface'],
  ['on surface variant', 'surface container highest'],
  ['primary', 'surface'],
  ['on primary', 'primary'],
  ['on primary container', 'primary container'],
  ['on secondary', 'secondary'],
  ['on secondary container', 'secondary container'],
  ['on tertiary', 'tertiary'],
  ['on tertiary container', 'tertiary container'],
  ['error', 'surface'],
  ['on error', 'error'],
  ['on error container', 'error container'],
  ['inverse on surface', 'inverse surface'],
];
export const NON_TEXT_PAIRS: [ColorRole, ColorRole][] = [
  ['outline', 'surface'],
  ['primary', 'surface container'],
  ['secondary', 'surface'],
];

export type ContrastRow = { fg: string; bg: string; fgHex: string; bgHex: string; ratio: number; min: number; pass: boolean };

export function contrastReport(scheme: Scheme, extraNonText: [ColorRole, ColorRole][] = []): ContrastRow[] {
  const row = (fg: ColorRole, bg: ColorRole, min: number): ContrastRow => {
    const ratio = contrast(scheme[fg], scheme[bg]);
    return { fg, bg, fgHex: scheme[fg], bgHex: scheme[bg], ratio, min, pass: ratio >= min };
  };
  const seen = new Set<string>();
  const out: ContrastRow[] = [];
  for (const [fg, bg] of TEXT_PAIRS) { out.push(row(fg, bg, 4.5)); seen.add(`${fg}|${bg}`); }
  for (const [fg, bg] of [...NON_TEXT_PAIRS, ...extraNonText]) if (!seen.has(`${fg}|${bg}`)) { out.push(row(fg, bg, 3)); seen.add(`${fg}|${bg}`); }
  return out;
}
