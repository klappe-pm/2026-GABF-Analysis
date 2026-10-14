// Edit one design setting in place, for the style guide's review mode. A setting lives in YAML
// frontmatter: .design/design-system/settings.md for the whole site, or a component's spec.md.
// The write changes only that key's lines (and, in a spec, the matching line of its
// what-you-can-change list); every other byte of the file stays as it was. A value that fails the
// checks (allowed values, approved fonts, WCAG AA contrast in the generated scheme) is refused with a
// plain reason and nothing is written. Each saved change is recorded as an ACCEPTED ticket in the
// tracked docs/feedback/design-system/, with a picture of what changed, for the feedback pipeline to commit.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { ROOT } from '../lib/paths.mjs';
import { componentWords } from '../lib/review-components.mjs';
import { kebab } from '../lib/review-screens.mjs';
import { ACCEPTED, nextId, renderTicket, sanitizeDeep } from '../lib/review-store.mjs';
import { COMPONENTS_DIR, SETTINGS, design, rel, splitFrontmatter } from './lib.mjs';

export const TICKET_PAGE = 'design-system';
// The tracked ticket store (the feedback pipeline's own folder for design system edits).
export const FEEDBACK_DIR = 'docs/feedback';

export function targetFile(target) {
  if (target === 'settings') return SETTINGS;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(String(target))) return null;
  const file = resolve(COMPONENTS_DIR, target, 'spec.md');
  return existsSync(file) ? file : null;
}

// YAML for one value, written the way the settings files already write values.
// Hex colors are quoted (an unquoted # starts a YAML comment); so is anything YAML would read as
// something other than plain text. yes and no stay plain: the yaml library reads them as text.
export function yamlValue(value) {
  if (typeof value === 'number') return String(value);
  const s = String(value);
  const special = /^[\s#'"&*!|>%@`[\]{},?-]/.test(s) || /: | #|\s$/.test(s) || /^(true|false|null|~)$/i.test(s) || /^[+-]?(\d|\.\d)/.test(s);
  return special ? JSON.stringify(s) : s;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Replace (or add) one top level key in a document's frontmatter, keeping every other byte.
export function setFrontmatterKey(text, key, value) {
  const m = text.match(/^(---\r?\n)([\s\S]*?\r?\n)(---(?:\r?\n|$))/);
  if (!m) throw new Error('the file has no frontmatter');
  const nl = m[1].endsWith('\r\n') ? '\r\n' : '\n';
  const block = m[2];
  const lines = block.split(/(?<=\n)/);
  const start = lines.findIndex((l) => new RegExp(`^${escapeRe(key)}\\s*:`).test(l));
  const written = Array.isArray(value)
    ? `${key}:${nl}${value.map((v) => `  - ${yamlValue(v)}${nl}`).join('')}`
    : `${key}: ${yamlValue(value)}${nl}`;
  let next;
  if (start === -1) next = block + written;
  else {
    let end = start + 1;
    // A list or folded value continues on indented lines (or "- " lines) under its key.
    while (end < lines.length && /^(\s+\S|-\s)/.test(lines[end])) end += 1;
    next = [...lines.slice(0, start), written, ...lines.slice(end)].join('');
  }
  return m[1] + next + m[3] + text.slice(m[0].length);
}

// Keep a spec's what-you-can-change line in step with its frontmatter: only that one line changes.
export function setListLine(text, key, shown) {
  const re = new RegExp(`^- ${escapeRe(key)}: .*$`, 'm');
  return re.test(text) ? text.replace(re, `- ${key}: ${shown}`) : text;
}

// The problems with a value, in plain words; an empty list means it can be saved.
export async function checkDesignEdit({ target, key, value }) {
  const d = await design();
  const file = targetFile(target);
  if (!file) return { problems: [`There is no design setting file for ${target}.`] };
  const { data } = splitFrontmatter(readFileSync(file, 'utf8'));
  const kind = target === 'settings' ? d.globalKind(key) : d.COMPONENTS[target]?.[key];
  if (!kind) return { problems: [`${key} is not a setting ${target === 'settings' ? 'of the site' : `of ${target}`}.`] };
  const problems = [];
  const p = d.valueProblem(kind, value);
  if (p) problems.push(`${key} ${p}.`);
  if (!problems.length) {
    // Contrast: the scheme these settings would generate, with the chart series on the page.
    const settings = readFileSync(SETTINGS, 'utf8');
    const g = d.mergeGlobal({}, { ...splitFrontmatter(settings).data, ...(target === 'settings' ? { [key]: value } : {}) });
    const chart = splitFrontmatter(readFileSync(resolve(COMPONENTS_DIR, 'chart-card', 'spec.md'), 'utf8')).data;
    const series = target === 'chart-card' && key === 'Series colors' ? (Array.isArray(value) ? value : String(value).split(',').map((s) => s.trim())) : d.componentSettings('chart-card', chart)['Series colors'] ?? [];
    for (const r of d.contrastReport(d.schemeFor(g), series.map((role) => [role, 'surface']))) {
      if (!r.pass) problems.push(`With this value, ${r.fg} on ${r.bg} would be ${r.ratio} to 1 and needs ${r.min} to 1 (WCAG AA).`);
    }
  }
  return { problems, file, old: data[key], kind };
}

// Check, write, and record one change. Throws with `problems` when the value is refused.
export async function applyDesignEdit({ target, key, value, feedbackDir, sanitize, capture, now = new Date() }) {
  const d = await design();
  const { problems, file, old, kind } = await checkDesignEdit({ target, key, value });
  if (problems.length) {
    const error = new Error(problems[0]);
    error.problems = problems;
    throw error;
  }
  const clean = kind.type === 'list' ? (Array.isArray(value) ? value : String(value).split(',').map((s) => s.trim())) : value;
  if (JSON.stringify(old) === JSON.stringify(clean)) {
    const error = new Error(`${key} is already ${d.showValue(clean)}.`);
    error.problems = [error.message];
    throw error;
  }
  const shown = (v) => (v === undefined ? 'not set' : d.showValue(v));
  const plan = ticketFor({ target, key, file: rel(file), old: old ?? null, next: clean, shown, feedbackDir, now });
  // The ticket goes to a public repository: a value the secret scan would change is refused, not redacted.
  const scan = sanitize ?? tokenShaped;
  if (plan && sanitizeDeep(plan.data, scan).redacted.size + sanitizeDeep(plan.body, scan).redacted.size) {
    const error = new Error('The change carries a value shaped like a secret. Nothing is written.');
    error.problems = [error.message];
    throw error;
  }
  const before = readFileSync(file, 'utf8');
  let after = setFrontmatterKey(before, key, clean);
  if (target !== 'settings') after = setListLine(after, key, d.showValue(clean));
  writeFileSync(file, after);
  let ticket = null;
  if (plan) {
    mkdirSync(plan.imageDir, { recursive: true });
    let captured = false;
    if (capture) {
      try { captured = Boolean(await capture({ target, key, path: plan.imageFile })); } catch { captured = false; }
    }
    if (!captured) { plan.data.images = []; plan.body = plan.body.replace(/\n\n## images\n\n[\s\S]*$/, '\n\n## images\n\n- No image: the browser capture was not available when this was saved.'); }
    writeFileSync(plan.ticketFile, renderTicket(plan.data, plan.body));
    ticket = { id: plan.data.id, file: rel(plan.ticketFile), status: ACCEPTED, image: captured ? rel(plan.imageFile) : null };
  }
  return { target, key, file: rel(file), old: old ?? null, new: clean, ticket };
}

// The ticket the feedback pipeline picks up: docs/feedback/design-system/<id>-<title>.md, its image in
// the folder of the same name. Frontmatter: id, status, title, page, step, components, images,
// setting-edits, created, revised. The pipeline commits it; this never does.
export function ticketFor({ target, key, file, old, next, shown, feedbackDir, now = new Date() }) {
  if (!feedbackDir) return null;
  const pageDir = resolve(feedbackDir, TICKET_PAGE);
  const id = nextId(feedbackDir);
  const title = `Design setting ${key} changed from ${shown(old ?? undefined)} to ${shown(next)}`;
  const base = `${id.toLowerCase()}-${kebab(title).slice(0, 48).replace(/-+$/, '')}`;
  const component = target === 'settings' ? null : target;
  const spec = component ? `.design/design-system/components/${component}/spec.md` : null;
  const stamp = now.toISOString();
  const data = {
    id,
    status: ACCEPTED,
    title,
    page: TICKET_PAGE,
    step: null,
    components: component ? [{ name: component, spec }] : [],
    images: [{ path: `${base}/component.png`, kind: 'component', spot: null, component, url: null }],
    'setting-edits': [{ file, key, old, new: next }],
    created: stamp,
    revised: stamp,
  };
  const toRoot = relative(pageDir, ROOT).split('\\').join('/');
  const body = [
    `${title} in ${file}.`,
    `## setting-edit\n\n${key} in ${file}\n\n- old: ${shown(old ?? undefined)}\n- new: ${shown(next)}`,
    `## components\n\n${component ? `- [${componentWords(component)}](${toRoot}/${spec})` : '- The whole site: global settings in .design/design-system/settings.md'}`,
    `## images\n\n- [${component ? componentWords(component) : key} after the change](${base}/component.png)`,
  ].join('\n\n');
  return { data, body, ticketFile: resolve(pageDir, `${base}.md`), imageDir: resolve(pageDir, base), imageFile: resolve(pageDir, base, 'component.png') };
}

// A local stand in for the engine's secret scan when its checkout is absent: the token shapes the
// owner's rules name (key prefixes, JWTs, PEM blocks, long hex or base64 runs).
const TOKEN_SHAPES = [
  /\b(AKIA|ASIA)[0-9A-Z]{16}\b/, /\bgh[pousr]_[A-Za-z0-9]{20,}\b/, /\bgithub_pat_[A-Za-z0-9_]{20,}\b/, /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/, /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /(key|token|secret|password)[^\n]{0,20}[A-Fa-f0-9]{32,}/i, /(key|token|secret|password)[^\n]{0,20}[A-Za-z0-9+/=]{40,}/i,
];
export function tokenShaped(text) {
  const found = TOKEN_SHAPES.filter((re) => re.test(text)).map((re) => re.source);
  return { text: found.length ? '[REDACTED:token]' : text, redacted: found };
}
