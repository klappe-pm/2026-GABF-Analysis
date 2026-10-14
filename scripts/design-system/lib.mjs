// Shared code for the design system control plane.
// The source of truth is .design/design-system/: tokens in W3C Design Tokens (DTCG) JSON,
// foundation specs, and one spec per component. Everything this module writes is a build
// product derived from that folder and is never edited by hand.

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { ROOT } from '../lib/paths.mjs';
import { parseContent } from '../lib/content-md.mjs';

export const DS = resolve(ROOT, '.design/design-system');
export const TOKENS_DIR = resolve(DS, 'tokens');
export const COMPONENTS_DIR = resolve(DS, 'components');
export const FOUNDATIONS_DIR = resolve(DS, 'foundations');
export const MANIFEST = resolve(DS, 'control-plane/system.json');
export const WEB = resolve(ROOT, 'web');
export const CSS_OUT = resolve(WEB, 'design/tokens.css');
export const FEEDBACK_OUT = resolve(ROOT, 'docs/design/design-system-tokens.json');
export const CHANGELOG = resolve(ROOT, '.docs/design/design-system/changes.jsonl');
export const THEMES = ['light', 'dark'];

export const rel = (p) => relative(ROOT, p).split('\\').join('/');

// ---------- tokens ----------

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

// Flatten a DTCG group into { path: { path, type, value, description, extensions } }, inheriting $type.
export function flatten(node, prefix = [], inheritedType, out = {}) {
  const type = node.$type ?? inheritedType;
  if (Object.hasOwn(node, '$value')) {
    const path = prefix.join('.');
    out[path] = { path, type, value: node.$value, description: node.$description ?? '', extensions: node.$extensions ?? {} };
    return out;
  }
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith('$') || !child || typeof child !== 'object') continue;
    flatten(child, [...prefix, key], type, out);
  }
  return out;
}

// Load every token file. Theme files hold the semantic layer, one file per theme with identical paths.
export function loadTokens() {
  const files = readdirSync(TOKENS_DIR).filter((f) => f.endsWith('.tokens.json')).sort();
  const base = {};
  const themes = {};
  for (const file of files) {
    const theme = file.match(/^theme\.([a-z]+)\.tokens\.json$/)?.[1];
    const flat = flatten(readJson(resolve(TOKENS_DIR, file)));
    for (const t of Object.values(flat)) t.file = `tokens/${file}`;
    if (theme) themes[theme] = flat;
    else Object.assign(base, flat);
  }
  return { base, themes };
}

const ALIAS = /^\{([^}]+)\}$/;

// Resolve a token value inside one theme (base tokens plus that theme's semantic tokens).
export function resolveValue(value, scope, seen = []) {
  if (typeof value === 'string') {
    const m = value.match(ALIAS);
    if (!m) return value;
    const target = scope[m[1]];
    if (!target) throw new Error(`unresolved alias {${m[1]}}`);
    if (seen.includes(m[1])) throw new Error(`alias cycle at {${m[1]}}`);
    return resolveValue(target.value, scope, [...seen, m[1]]);
  }
  if (Array.isArray(value)) return value.map((v) => resolveValue(v, scope, seen));
  if (value && typeof value === 'object') {
    // DTCG 2025 color object: prefer its hex fallback.
    if (value.colorSpace && value.hex) return value.hex;
    if (Object.hasOwn(value, 'value') && Object.hasOwn(value, 'unit')) return `${value.value}${value.unit}`;
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveValue(v, scope, seen)]));
  }
  return value;
}

export function scopeFor(tokens, theme) {
  return { ...tokens.base, ...(tokens.themes[theme] ?? {}) };
}

// ---------- naming: CSS variables and Tailwind theme names ----------

const kebab = (path) => path.split('.').join('-');

// Every token gets a CSS custom property; some also map into the Tailwind theme.
export function namesFor(token) {
  const p = token.path;
  const parts = p.split('.');
  const out = { cssVar: `--gabf-${kebab(p.replace(/^semantic\./, ''))}` };
  if (parts[0] === 'semantic' && parts[1] === 'color') {
    out.tailwind = `--color-${parts.slice(2).join('-')}`;
    out.utilities = ['bg', 'text', 'border', 'outline', 'fill', 'stroke', 'decoration', 'accent', 'caret', 'divide', 'placeholder'].map((u) => `${u}-${parts.slice(2).join('-')}`);
  } else if (parts[0] === 'font' && parts[1] === 'family') {
    out.tailwind = `--font-${parts[2]}`;
    out.utilities = [`font-${parts[2]}`];
  } else if (parts[0] === 'font' && parts[1] === 'weight') {
    out.tailwind = `--font-weight-${parts[2]}`;
    out.utilities = [`font-${parts[2]}`];
  } else if (parts[0] === 'font' && parts[1] === 'line-height') {
    out.tailwind = `--leading-${parts[2]}`;
    out.utilities = [`leading-${parts[2]}`];
  } else if (parts[0] === 'font' && parts[1] === 'tracking') {
    out.tailwind = `--tracking-${parts[2]}`;
    out.utilities = [`tracking-${parts[2]}`];
  } else if (parts[0] === 'type') {
    out.tailwind = `--text-${parts[1]}`;
    out.utilities = [`text-${parts[1]}`];
  } else if (parts[0] === 'space') {
    out.tailwind = `--spacing-${parts[1]}`;
    out.utilities = [`p-${parts[1]}`, `m-${parts[1]}`, `gap-${parts[1]}`, `w-${parts[1]}`, `h-${parts[1]}`];
  } else if (parts[0] === 'size') {
    out.tailwind = `--container-${parts[1]}`;
    out.utilities = [`max-w-${parts[1]}`];
  } else if (parts[0] === 'breakpoint') {
    out.tailwind = `--breakpoint-${parts[1]}`;
    out.utilities = [`${parts[1]}:`];
  } else if (parts[0] === 'rule') {
    out.utilities = parts[1] === 'hairline' ? ['border', 'border-t', 'border-b', 'border-l', 'border-r'] : ['border-2', 'border-t-2', 'border-b-2'];
  } else if (parts[0] === 'layer' || parts[0] === 'duration') {
    out.utilities = [`${parts[0] === 'layer' ? 'z' : 'duration'}-(${out.cssVar})`];
  }
  return out;
}

// ---------- contrast ----------

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100;
}

// Every declared requirement ($extensions["gabf.contrast"]) evaluated in its theme.
export function contrastReport(tokens) {
  const rows = [];
  for (const theme of THEMES) {
    const scope = scopeFor(tokens, theme);
    for (const token of Object.values(tokens.themes[theme] ?? {})) {
      for (const req of token.extensions['gabf.contrast'] ?? []) {
        const against = req.against.match(ALIAS)?.[1] ?? req.against;
        const fg = resolveValue(token.value, scope);
        const bg = resolveValue(`{${against}}`, scope);
        const ratio = contrast(fg, bg);
        rows.push({ theme, token: token.path, against, fg, bg, ratio, min: req.min, pass: ratio >= req.min });
      }
    }
  }
  return rows;
}

// ---------- build products ----------

const cssValue = (token, value) => {
  if (token.type === 'fontFamily') {
    const list = (Array.isArray(value) ? value : [value]).map((f) => (/\s/.test(f) ? `"${f}"` : f));
    const v = token.extensions['gabf.cssVar'];
    return [v ? `var(${v})` : null, ...list].filter(Boolean).join(', ');
  }
  return String(value);
};

// The CSS custom property value for a token: aliases stay as var() references so themes cascade.
function cssDeclValue(token, scope) {
  const m = typeof token.value === 'string' && token.value.match(ALIAS);
  if (m) return `var(${namesFor(scope[m[1]]).cssVar})`;
  return cssValue(token, resolveValue(token.value, scope));
}

export function buildCss(tokens) {
  const lines = ['/* Generated by scripts/design-system/build.mjs from .design/design-system/tokens. Do not edit; change the tokens and rebuild. */', ''];
  const base = Object.values(tokens.base).filter((t) => t.type !== 'typography');
  const lightScope = scopeFor(tokens, 'light');
  const block = (selector, theme, indent = '') => {
    const scope = scopeFor(tokens, theme);
    lines.push(`${indent}${selector} {`);
    lines.push(`${indent}  color-scheme: ${theme};`);
    for (const t of Object.values(tokens.themes[theme])) lines.push(`${indent}  ${namesFor(t).cssVar}: ${cssDeclValue(t, scope)};`);
    lines.push(`${indent}}`);
  };
  lines.push(':root {');
  for (const t of base) lines.push(`  ${namesFor(t).cssVar}: ${cssDeclValue(t, lightScope)};`);
  lines.push('}', '');
  block(':root, [data-theme="light"]', 'light');
  lines.push('', '@media (prefers-color-scheme: dark) {');
  block(':root:not([data-theme="light"])', 'dark', '  ');
  lines.push('}', '');
  block('[data-theme="dark"]', 'dark');
  lines.push('');
  // Tailwind: drop every default and expose only the tokens.
  lines.push('@theme {', '  --*: initial;', '}', '', '@theme inline {');
  for (const t of Object.values(tokens.themes.light)) lines.push(`  ${namesFor(t).tailwind}: var(${namesFor(t).cssVar});`);
  for (const t of base) {
    const n = namesFor(t);
    if (!n.tailwind || t.path.startsWith('type.')) continue;
    lines.push(`  ${n.tailwind}: ${cssValue(t, resolveValue(t.value, lightScope))};`);
  }
  for (const t of Object.values(tokens.base).filter((x) => x.type === 'typography')) {
    const v = resolveValue(t.value, lightScope);
    const n = namesFor(t).tailwind;
    lines.push(`  ${n}: ${v.fontSize};`, `  ${n}--line-height: ${v.lineHeight};`, `  ${n}--letter-spacing: ${v.letterSpacing};`, `  ${n}--font-weight: ${v.fontWeight};`);
  }
  lines.push('}', '');
  return lines.join('\n');
}

// A flat, resolved list of token nodes for the screen feedback control plane in docs/design/.
export function tokenNodes(tokens) {
  const nodes = [];
  for (const t of Object.values(tokens.base)) {
    const n = namesFor(t);
    nodes.push({ id: t.path, kind: 'token', type: t.type, file: t.file, cssVar: n.cssVar, tailwind: n.tailwind ?? null, utilities: n.utilities ?? [], description: t.description, value: resolveValue(t.value, scopeFor(tokens, 'light')) });
  }
  for (const t of Object.values(tokens.themes.light)) {
    const n = namesFor(t);
    const values = Object.fromEntries(THEMES.map((th) => [th, resolveValue(tokens.themes[th][t.path].value, scopeFor(tokens, th))]));
    const aliases = Object.fromEntries(THEMES.map((th) => [th, tokens.themes[th][t.path].value]));
    nodes.push({ id: t.path, kind: 'token', type: t.type, file: 'tokens/theme.<theme>.tokens.json', cssVar: n.cssVar, tailwind: n.tailwind ?? null, utilities: n.utilities ?? [], description: t.description, values, aliases });
  }
  return nodes;
}

// ---------- specs ----------

export const REQUIRED_FRONTMATTER = ['name', 'title', 'version', 'tokens', 'content', 'code', 'related'];
export const REQUIRED_SECTIONS = ['Purpose and when to use', 'Anatomy', 'Variants', 'States', 'Behavior and interaction', 'Accessibility', 'Content guidelines', 'Responsive behavior', 'Do and do not'];

export function splitFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: text };
  return { data: parseYaml(m[1]) ?? {}, body: m[2] };
}

export function sections(body) {
  const out = {};
  let current = null;
  for (const line of body.split('\n')) {
    const h = line.match(/^## (.+)$/);
    if (h) { current = h[1].trim(); out[current] = []; continue; }
    if (current) out[current].push(line);
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.join('\n').trim()]));
}

export function loadSpecs() {
  if (!existsSync(COMPONENTS_DIR)) return [];
  return readdirSync(COMPONENTS_DIR).filter((d) => statSync(resolve(COMPONENTS_DIR, d)).isDirectory()).sort().map((dir) => {
    const file = resolve(COMPONENTS_DIR, dir, 'spec.md');
    const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
    const { data, body } = splitFrontmatter(text);
    return { dir, file, spec: rel(file), data, text, sections: sections(body), exists: Boolean(text) };
  });
}

export function loadFoundations() {
  if (!existsSync(FOUNDATIONS_DIR)) return [];
  return readdirSync(FOUNDATIONS_DIR).filter((f) => f.endsWith('.md')).sort().map((f) => {
    const file = resolve(FOUNDATIONS_DIR, f);
    const { data, body } = splitFrontmatter(readFileSync(file, 'utf8'));
    return { name: f.replace(/\.md$/, ''), file, spec: rel(file), data, sections: sections(body) };
  });
}

// ---------- content keys ----------

export function loadContent() {
  const docs = {};
  const dir = resolve(ROOT, '.docs/content-management-system');
  for (const group of ['global', 'pages']) {
    for (const f of readdirSync(resolve(dir, group)).filter((x) => x.endsWith('.md'))) {
      docs[`${group}.${f.replace(/\.md$/, '')}`] = parseContent(readFileSync(resolve(dir, group, f), 'utf8'));
    }
  }
  return docs;
}

export function lookupContent(docs, key) {
  const docKey = Object.keys(docs).find((k) => key.startsWith(`${k}.`));
  if (!docKey) return undefined;
  let node = docs[docKey];
  let parts = key.slice(docKey.length + 1).split('.');
  while (parts.length) {
    const n = [...Array(parts.length).keys()].map((i) => parts.length - i).find((len) => node && typeof node === 'object' && Object.hasOwn(node, parts.slice(0, len).join('.')));
    if (!n) return undefined;
    node = node[parts.slice(0, n).join('.')];
    parts = parts.slice(n);
  }
  return node;
}

// ---------- component source scanning ----------

export const BANNED_FAMILIES = ['Inter', 'system-ui', 'Fraunces', 'Playfair Display', 'Cormorant', 'Lora', 'Crimson', 'Newsreader', 'Syne', 'Space Grotesk', 'Space Mono', 'IBM Plex', 'DM Sans', 'DM Serif', 'Outfit', 'Plus Jakarta Sans', 'Instrument Sans', 'Roboto', 'Helvetica Neue', 'Montserrat', 'Poppins'];

export function listFiles(dir, exts, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (['node_modules', '.next', 'out'].includes(entry)) continue;
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) listFiles(full, exts, out);
    else if (exts.some((e) => entry.endsWith(e))) out.push(full);
  }
  return out;
}

// Candidate class names: whitespace separated words inside string literals.
export function classCandidates(source) {
  const out = [];
  source = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const m of source.matchAll(/(["'`])((?:\\.|(?!\1)[^\\])*)\1/g)) {
    for (const word of m[2].replace(/\$\{[^}]*\}/g, ' ').split(/\s+/)) {
      if (/^[!-]?[a-z][a-z0-9:/().\-[\]#%_]*$/.test(word)) out.push(word);
    }
  }
  return out;
}

const COLOR_PREFIX = /^(bg|text|border-[trblxy]|border|outline|fill|stroke|decoration|accent|caret|divide|placeholder)-(.+)$/;
const SPACE_PREFIX = /^-?(p|px|py|pt|pr|pb|pl|ps|pe|m|mx|my|mt|mr|mb|ml|ms|me|gap-x|gap-y|gap|space-x|space-y|top|right|bottom|left|inset|inset-x|inset-y|start|end|w|h|min-w|min-h|max-h|size|scroll-mt|indent|basis|translate-x|translate-y)-(.+)$/;
const TEXT_KEYWORDS = new Set(['left', 'center', 'right', 'start', 'end', 'justify', 'wrap', 'nowrap', 'balance', 'pretty', 'ellipsis', 'clip']);
const SPACE_KEYWORDS = new Set(['full', 'auto', 'fit', 'min', 'max', 'screen', 'dvh', 'svh', 'lvh', 'px-0']);
const BORDER_KEYWORDS = new Set(['solid', 'dashed', 'double', 'none', 'collapse', 'separate', 'spacing-0', '0', 'x-0', 'y-0', 't-0', 'b-0', 'l-0', 'r-0', 'transparent', 'current', 'dotted']);
const BREAKPOINTS = ['sm', 'md', 'lg', 'xl'];

// Classify one class name. Returns { token } for a token reference, { error } for a violation, or {}.
export function classify(cls, index) {
  let name = cls.replace(/^!/, '');
  const variants = [];
  // Strip variants: everything up to the last colon that is outside brackets and parentheses.
  let depth = 0;
  let cut = -1;
  for (let i = 0; i < name.length; i += 1) {
    const c = name[i];
    if (c === '[' || c === '(') depth += 1;
    else if (c === ']' || c === ')') depth -= 1;
    else if (c === ':' && depth === 0) cut = i;
  }
  if (cut >= 0) { variants.push(...name.slice(0, cut).split(':')); name = name.slice(cut + 1); }
  const tokens = variants.filter((v) => BREAKPOINTS.includes(v)).map((v) => `breakpoint.${v}`);
  const result = (r) => ({ ...r, tokens: [...tokens, ...(r.token ? [r.token] : [])] });
  if (/\[/.test(name)) return result({ error: `arbitrary value "${cls}"` });
  if (/^-?(rounded|shadow|inset-shadow|drop-shadow|text-shadow|ring|inset-ring)(-|$)/.test(name)) return result({ error: `"${cls}": corners stay square and nothing casts a shadow` });
  if (/^(bg-linear|bg-radial|bg-conic|bg-gradient|from-|via-|to-|backdrop-|blur)/.test(name)) return result({ error: `"${cls}": no gradients, blur, or glass` });
  const varRef = name.match(/^[a-z-]+-\((--[a-z0-9-]+)\)$/);
  if (varRef) {
    const t = index.byCssVar[varRef[1]];
    return t ? result({ token: t }) : result({ error: `"${cls}" references ${varRef[1]}, which is not a token` });
  }
  if (/^(z|duration|delay)-\d/.test(name)) return result({ error: `"${cls}": use the layer or duration token` });
  const color = name.match(COLOR_PREFIX);
  if (color) {
    const [, util, suffix] = color;
    if (index.colors.has(suffix)) return result({ token: `semantic.color.${suffix}` });
    if (util === 'text') {
      if (index.types.has(suffix)) return result({ token: `type.${suffix}` });
      if (TEXT_KEYWORDS.has(suffix)) return result({});
    }
    if (util.startsWith('border') || util === 'outline') {
      if (suffix === '2' || /^[trblxy]-2$/.test(suffix)) return result({ token: 'rule.heavy' });
      if (BORDER_KEYWORDS.has(suffix) || /^[trblxy]$/.test(suffix)) return result(/^[trblxy]$/.test(suffix) ? { token: 'rule.hairline' } : {});
    }
    if (util === 'outline' && ['none', 'hidden'].includes(suffix)) return result({});
    if (util === 'decoration' && ['solid', 'dotted', 'underline', '1', '2'].includes(suffix)) return result({});
    if (util === 'divide' && ['x', 'y'].includes(suffix)) return result({ token: 'rule.hairline' });
    if ((util === 'fill' || util === 'stroke') && suffix === 'current') return result({});
    if (util === 'fill' && suffix === 'none') return result({});
    if (util === 'bg' && ['transparent', 'none'].includes(suffix)) return result({});
    if (util === 'stroke' && /^\d$/.test(suffix)) return result({});
    return result({ error: `"${cls}": "${suffix}" is not a token` });
  }
  if (['border', 'border-t', 'border-b', 'border-l', 'border-r', 'border-x', 'border-y', 'divide-x', 'divide-y'].includes(name)) return result({ token: 'rule.hairline' });
  const space = name.match(SPACE_PREFIX);
  if (space) {
    const suffix = space[2];
    if (index.spaces.has(suffix)) return result({ token: `space.${suffix}` });
    if (SPACE_KEYWORDS.has(suffix) || /^\d+\/\d+$/.test(suffix)) return result({});
    return result({ error: `"${cls}": "${suffix}" is not a space token` });
  }
  const maxw = name.match(/^max-w-(.+)$/);
  if (maxw) return index.sizes.has(maxw[1]) ? result({ token: `size.${maxw[1]}` }) : ['none', 'full'].includes(maxw[1]) ? result({}) : result({ error: `"${cls}": not a size token` });
  const font = name.match(/^font-(.+)$/);
  if (font) {
    if (index.families.has(font[1])) return result({ token: `font.family.${font[1]}` });
    if (index.weights.has(font[1])) return result({ token: `font.weight.${font[1]}` });
    return result({ error: `"${cls}": not a font token` });
  }
  const lead = name.match(/^leading-(.+)$/);
  if (lead) return index.leadings.has(lead[1]) ? result({ token: `font.line-height.${lead[1]}` }) : result({ error: `"${cls}": not a line height token` });
  const track = name.match(/^tracking-(.+)$/);
  if (track) return index.trackings.has(track[1]) ? result({ token: `font.tracking.${track[1]}` }) : result({ error: `"${cls}": not a tracking token` });
  return result({});
}

export function tokenIndex(tokens) {
  const keys = (prefix) => new Set(Object.keys(tokens.base).filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length)));
  const byCssVar = {};
  for (const t of [...Object.values(tokens.base), ...Object.values(tokens.themes.light)]) byCssVar[namesFor(t).cssVar] = t.path;
  return {
    colors: new Set(Object.keys(tokens.themes.light).map((k) => k.replace('semantic.color.', ''))),
    types: keys('type.'),
    spaces: keys('space.'),
    sizes: keys('size.'),
    families: keys('font.family.'),
    weights: keys('font.weight.'),
    leadings: keys('font.line-height.'),
    trackings: keys('font.tracking.'),
    byCssVar,
  };
}

// Raw values a component must not carry: color literals, lengths, and font names.
export function rawValueProblems(source) {
  const problems = [];
  const stripped = source.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of stripped.matchAll(/["'`(:\s]#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?=["'`);\s,])/g)) problems.push(`raw hex color #${m[1]}`);
  for (const m of stripped.matchAll(/\b(rgba?|hsla?|oklch|oklab|lab|lch|color-mix)\(/g)) problems.push(`raw color function ${m[1]}()`);
  for (const m of stripped.matchAll(/(?<![\w-])(\d*\.?\d+)(px|rem|em)\b/g)) problems.push(`raw length ${m[0]}`);
  for (const fam of BANNED_FAMILIES) if (new RegExp(`(^|[^\\w-])${fam.replace(/ /g, '\\s')}([^\\w-]|$)`).test(stripped)) problems.push(`font family ${fam} is not part of the system`);
  // Radius and shadow may only ever be switched off (for example in a chart library option).
  for (const m of stripped.matchAll(/(borderRadius|border-radius)\s*[:=]\s*['"]?([^,;'"}\n]+)/g)) if (!/^(0|0px|\[0(,\s*0)*\])$/.test(m[2].trim())) problems.push(`border radius ${m[2].trim()}`);
  for (const m of stripped.matchAll(/(boxShadow|box-shadow|textShadow|text-shadow|shadowBlur|shadowColor)\s*[:=]\s*['"]?([^,;'"}\n]+)/g)) if (!/^(none|0|transparent)$/.test(m[2].trim())) problems.push(`shadow ${m[1]} ${m[2].trim()}`);
  if (/filter\s*:\s*['"]?drop-shadow|(linear|radial|conic)-gradient\(|backdrop-filter|backdropFilter/.test(stripped)) problems.push('shadow, gradient, or blur in a component');
  return problems;
}

// Stylesheet rules: square corners, no shadows, no gradients, no glass.
export function cssProblems(css) {
  const problems = [];
  for (const m of css.matchAll(/border(?:-[a-z-]+)?-radius\s*:\s*([^;}]+)/g)) if (!/^(0|0px|var\(--gabf-radius-none\))\s*(!important)?$/.test(m[1].trim())) problems.push(`border radius ${m[1].trim()}`);
  for (const m of css.matchAll(/(box-shadow|text-shadow)\s*:\s*([^;}]+)/g)) if (m[2].trim() !== 'none') problems.push(`${m[1]} ${m[2].trim()}`);
  if (/(linear|radial|conic)-gradient\(/.test(css)) problems.push('gradient');
  if (/backdrop-filter|filter\s*:\s*(blur|drop-shadow)/.test(css)) problems.push('blur or glass');
  return problems;
}

// ---------- pages ----------

// Which app routes render which component files (by import).
export function pageEdges() {
  const pages = listFiles(resolve(WEB, 'app'), ['.tsx', '.ts']);
  const edges = {};
  const scan = (file, seen = new Set()) => {
    if (seen.has(file)) return seen;
    seen.add(file);
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/from\s+['"](@\/components\/[^'"]+|\.\.?\/[^'"]+)['"]/g)) {
      const spec = m[1].startsWith('@/') ? resolve(WEB, m[1].slice(2)) : resolve(file, '..', m[1]);
      for (const ext of ['.tsx', '.ts', '/index.tsx']) if (existsSync(spec + ext)) { scan(spec + ext, seen); break; }
    }
    return seen;
  };
  for (const page of pages.filter((p) => /\/(page|layout)\.tsx$/.test(p))) {
    const route = rel(page).replace(/^web\/app/, '').replace(/\/(page|layout)\.tsx$/, '') || '/';
    for (const f of scan(page)) if (f.includes('/web/components/')) (edges[rel(f)] ??= new Set()).add(route);
  }
  return Object.fromEntries(Object.entries(edges).map(([k, v]) => [k, [...v].sort()]));
}

// ---------- manifest ----------

// Component names (button, text-link) appear as plain strings and are not class names.
const componentNames = () => new Set(existsSync(COMPONENTS_DIR) ? readdirSync(COMPONENTS_DIR) : []);

export function usedTokens(file, index) {
  const used = new Set();
  const errors = [];
  const names = componentNames();
  for (const cls of classCandidates(readFileSync(file, 'utf8'))) {
    if (names.has(cls)) continue;
    const r = classify(cls, index);
    for (const t of r.tokens) used.add(t);
    if (r.error) errors.push(r.error);
  }
  return { used: [...used].sort(), errors };
}

export function buildManifest(tokens, specs) {
  const pages = pageEdges();
  return {
    $description: 'Generated by scripts/design-system/build.mjs. Every token with its CSS variable and Tailwind name, and every component with its spec, code, tokens, content keys, and the pages that render it.',
    tokens: tokenNodes(tokens).map(({ id, type, cssVar, tailwind, values, value }) => ({ id, type, cssVar, tailwind, ...(values ? { values } : { value }) })),
    components: specs.map((s) => ({
      name: s.data.name ?? s.dir,
      title: s.data.title ?? s.dir,
      spec: s.spec,
      code: s.data.code ?? null,
      tokens: [...(s.data.tokens ?? [])].sort(),
      content: [...(s.data.content ?? [])].sort(),
      related: [...(s.data.related ?? [])].sort(),
      pages: s.data.code ? pages[s.data.code] ?? [] : [],
    })),
  };
}

export function feedbackDocument(tokens, specs, manifest) {
  return {
    $description: 'Published by scripts/design-system/build.mjs from .design/design-system for the screen feedback control plane. Each node is a token or a component that feedback can name.',
    source: '.design/design-system',
    themes: THEMES,
    nodes: [
      ...tokenNodes(tokens),
      ...manifest.components.map((c) => ({ id: `component.${c.name}`, kind: 'component', title: c.title, spec: c.spec, code: c.code, tokens: c.tokens, content: c.content, pages: c.pages })),
    ],
    contrast: contrastReport(tokens),
  };
}

export const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`;

// ---------- change log ----------

export const sha = (text) => createHash('sha256').update(text).digest('hex');

export function snapshot(tokens, specs) {
  const values = {};
  for (const theme of THEMES) {
    const scope = scopeFor(tokens, theme);
    for (const t of Object.values(scope)) values[`${theme}:${t.path}`] = JSON.stringify(t.value);
  }
  const status = Object.fromEntries(specs.map((s) => [s.data.name ?? s.dir, `${s.data.version ?? ''}@${sha(s.text ?? '').slice(0, 12)}`]));
  return { values, status };
}

export function readLog() {
  if (!existsSync(CHANGELOG)) return [];
  return readFileSync(CHANGELOG, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

// Recompute every link: each entry's hash covers its body and the previous hash.
export function verifyChain(entries) {
  let prev = null;
  for (const [i, e] of entries.entries()) {
    const { hash, ...body } = e;
    if (body.prev !== prev) return `entry ${i + 1} does not link to the previous entry`;
    if (sha(JSON.stringify(body)) !== hash) return `entry ${i + 1} hash does not match its content`;
    prev = hash;
  }
  return null;
}

export function diffSnapshots(before, after) {
  const changes = [];
  if (!before) return [{ kind: 'baseline', detail: `${Object.keys(after.values).length} token values, ${Object.keys(after.status).length} component specs` }];
  for (const k of new Set([...Object.keys(before.values), ...Object.keys(after.values)])) {
    if (before.values[k] !== after.values[k]) changes.push({ kind: 'token', id: k, from: before.values[k] ?? null, to: after.values[k] ?? null });
  }
  for (const k of new Set([...Object.keys(before.status), ...Object.keys(after.status)])) {
    if (before.status[k] !== after.status[k]) changes.push({ kind: 'spec', id: k, from: before.status[k] ?? null, to: after.status[k] ?? null });
  }
  return changes;
}

// Archivo Narrow has no tabular figures (measured: "1111" is narrower than "0000", with or without
// tabular-nums), so a class string that asks for both is a defect. Figures are set in Public Sans.
export function narrowFigureProblems(source) {
  const problems = [];
  for (const m of source.matchAll(/(["'`])((?:\\.|(?!\1)[^\\])*)\1/g)) {
    const words = m[2].split(/\s+/);
    if (words.includes('font-narrow') && words.includes('tabular-nums')) problems.push('font-narrow with tabular-nums: figures are set in Public Sans, the narrow face has no tabular figures');
  }
  return problems;
}
