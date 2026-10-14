// Edit one design setting in place, for the style guide's review mode. A setting lives in YAML
// frontmatter: .design/design-system/settings.md for the whole site, or a component's spec.md.
// The write changes only that key's lines (and, in a spec, the matching line of its
// what-you-can-change list); every other byte of the file stays as it was. A value that fails the
// checks (allowed values, approved fonts, WCAG AA contrast in the generated scheme) is refused with a
// plain reason and nothing is written. Each saved change is recorded as an ACCEPTED ticket under
// .docs/feedback/design-system/, the same store the feedback tool uses.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { addTicket } from '../lib/review-store.mjs';
import { COMPONENTS_DIR, SETTINGS, design, rel, splitFrontmatter } from './lib.mjs';

export const TICKET_PAGE = 'design-system';

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
    const chart = splitFrontmatter(readFileSync(resolve(COMPONENTS_DIR, 'chart-frame', 'spec.md'), 'utf8')).data;
    const series = target === 'chart-frame' && key === 'Series colors' ? (Array.isArray(value) ? value : String(value).split(',').map((s) => s.trim())) : d.componentSettings('chart-frame', chart)['Series colors'] ?? [];
    for (const r of d.contrastReport(d.schemeFor(g), series.map((role) => [role, 'surface']))) {
      if (!r.pass) problems.push(`With this value, ${r.fg} on ${r.bg} would be ${r.ratio} to 1 and needs ${r.min} to 1 (WCAG AA).`);
    }
  }
  return { problems, file, old: data[key], kind };
}

// Check, write, and record one change. Throws with `problems` when the value is refused.
export async function applyDesignEdit({ target, key, value, feedbackDir, sanitize, now = new Date() }) {
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
  const before = readFileSync(file, 'utf8');
  let after = setFrontmatterKey(before, key, clean);
  if (target !== 'settings') after = setListLine(after, key, d.showValue(clean));
  writeFileSync(file, after);
  const shown = (v) => (v === undefined ? 'not set' : d.showValue(v));
  let ticket = null;
  if (feedbackDir) {
    ticket = addTicket(feedbackDir, {
      page: TICKET_PAGE,
      text: `Design setting ${key} changed from ${shown(old)} to ${shown(clean)} in ${rel(file)}.`,
      route: '/design-system/',
      served: 'design-system-review',
      components: target === 'settings' ? [] : [{ name: target, spec: rel(file) }],
      extraBody: `## design-edit\n\n${key} in ${rel(file)}\n\n- old: ${shown(old)}\n- new: ${shown(clean)}`,
    }, { sanitize: sanitize ?? ((t) => ({ text: t, redacted: [] })), now });
  }
  return { target, key, file: rel(file), old: old ?? null, new: clean, ticket: ticket ? { id: ticket.id, file: rel(ticket.file), status: ticket.status } : null };
}
