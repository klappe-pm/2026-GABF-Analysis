// Shared code for the design system scripts. The design system is stock Material 3 (@material/web),
// themed at run time from plain settings in .design/design-system/:
//   settings.md                     global settings (seed color, fonts, corner shape, medal colors)
//   layout.md                       section, navigation, and component order
//   components/<name>/spec.md       each component's settings, an image, and what can change
// The schema and the theme code live in web/design/ (TypeScript, used by the site); these scripts
// bundle them with esbuild so the checks run the same code the browser runs.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { buildSync } from 'esbuild';
import { parse as parseYaml } from 'yaml';
import { ROOT } from '../lib/paths.mjs';

// GABF_DESIGN_DIR points the design system at another folder, so a test edits a copy and never the real
// settings.md or a real spec (node --test runs test files side by side, and others read those files).
export const DS = process.env.GABF_DESIGN_DIR ? resolve(process.env.GABF_DESIGN_DIR) : resolve(ROOT, '.design/design-system');
export const SETTINGS = resolve(DS, 'settings.md');
export const LAYOUT = resolve(DS, 'layout.md');
export const COMPONENTS_DIR = resolve(DS, 'components');
export const WEB = resolve(ROOT, 'web');
// The copies the static export serves, so a page can read the settings when it loads.
export const PUBLIC_SETTINGS = resolve(WEB, 'public/design-settings');

// A path as the repository names it; a file in the design folder keeps its .design/design-system/ name wherever DS is.
export const rel = (p) => (p === DS || p.startsWith(DS + sep) ? `.design/design-system/${relative(DS, p)}`.replace(/\/$/, '') : relative(ROOT, p)).split('\\').join('/');

let designModule = null;
// The schema and theme modules from web/design, bundled for Node.
export async function design() {
  if (designModule) return designModule;
  const out = buildSync({
    stdin: { contents: "export * from './schema.ts'; export * from './theme.ts';", resolveDir: resolve(WEB, 'design'), loader: 'ts' },
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    logLevel: 'silent',
  });
  designModule = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
  return designModule;
}

export function splitFrontmatter(text) {
  const m = text.replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: text, head: '' };
  const data = parseYaml(m[1]);
  return { data: data && typeof data === 'object' && !Array.isArray(data) ? data : {}, body: m[2], head: text.slice(0, text.length - m[2].length) };
}

export const readDoc = (file) => splitFrontmatter(readFileSync(file, 'utf8'));

export function loadSpecs() {
  if (!existsSync(COMPONENTS_DIR)) return [];
  return readdirSync(COMPONENTS_DIR).filter((d) => statSync(resolve(COMPONENTS_DIR, d)).isDirectory()).sort().map((dir) => {
    const file = resolve(COMPONENTS_DIR, dir, 'spec.md');
    const exists = existsSync(file);
    const text = exists ? readFileSync(file, 'utf8') : '';
    return { dir, file, spec: rel(file), text, exists, ...splitFrontmatter(text) };
  });
}

export function listFiles(dir, exts, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (['node_modules', '.next', 'out', 'public'].includes(entry) || entry.startsWith('out-')) continue;
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) listFiles(full, exts, out);
    else if (exts.some((e) => entry.endsWith(e))) out.push(full);
  }
  return out;
}

// Faces that are not part of the system. Public Sans and Archivo Narrow are the only two.
export const BANNED_FAMILIES = ['Inter', 'system-ui', 'Roboto', 'Helvetica Neue', 'Arial', 'Fraunces', 'Playfair Display', 'Lora', 'Space Grotesk', 'IBM Plex', 'DM Sans', 'Montserrat', 'Poppins', 'Open Sans'];

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// Colors come from the generated scheme: no color literal in page or component code.
export function rawColorProblems(source) {
  const problems = [];
  const s = stripComments(source);
  for (const m of s.matchAll(/["'`(:\s]#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?=["'`);\s,])/g)) problems.push(`raw hex color #${m[1]}`);
  for (const m of s.matchAll(/\b(rgba?|hsla?|oklch|oklab|lab|lch)\(/g)) problems.push(`raw color function ${m[1]}()`);
  return problems;
}

export function fontProblems(source) {
  const s = stripComments(source);
  return BANNED_FAMILIES.filter((fam) => new RegExp(`(^|[^\\w-])${fam.replace(/ /g, '\\s')}([^\\w-]|$)`).test(s)).map((fam) => `font family ${fam} is not part of the system`);
}

// Archivo Narrow has no tabular figures, so a class string that asks for both is a defect.
export function narrowFigureProblems(source) {
  const problems = [];
  for (const m of source.matchAll(/(["'`])((?:\\.|(?!\1)[^\\])*)\1/g)) {
    const words = m[2].split(/\s+/);
    if (words.includes('font-label') && words.includes('tabular-nums')) problems.push('font-label with tabular-nums: figures are set in Public Sans');
  }
  return problems;
}

// The site has one light theme.
export function darkThemeProblems(source) {
  const s = stripComments(source);
  const problems = [];
  if (/prefers-color-scheme\s*:\s*dark/i.test(s)) problems.push('a dark color scheme rule');
  if (/color-scheme\s*:\s*[^;]*dark/i.test(s)) problems.push('a dark color-scheme declaration');
  if (/\bisDark\s*[:=]\s*true\b|data-theme\s*=\s*["']dark/.test(s)) problems.push('a dark theme switch');
  return problems;
}

// Nothing credits an assistant, model, or tool.
export function attributionProblems(text) {
  return /\b(claude|anthropic|chatgpt|openai|copilot|ai[ -]generated|generated by (an )?ai)\b/i.test(text) ? ['credits an assistant, model, or tool'] : [];
}

export const statusProblem = (statuses, data) => {
  if (!Object.hasOwn(data, 'status')) return `frontmatter is missing status (${statuses.join(', ')})`;
  return statuses.includes(data.status) ? null : `status "${data.status}" must be one of ${statuses.join(', ')}`;
};
