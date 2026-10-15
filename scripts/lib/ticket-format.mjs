// The feedback ticket format, as far as this repository writes tickets itself: the design system's
// setting editor (scripts/design-system/edit.mjs) files an ACCEPTED ticket for each saved setting. The
// review server, the ticket store and the pipeline that read and run tickets are product-feedback's
// (product-feedback.config.json); this file holds only what the editor needs to write a ticket they
// accept. The format is product-feedback's contract: `product-feedback design check` validates every
// ticket in docs/feedback/, so a ticket written here that drifts from it fails that check.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { parse, stringify } from 'yaml';

export const ACCEPTED = 'ACCEPTED';
export const MANIFEST_PATH = 'docs/design/design-nodes.json';

export const kebab = (text) => String(text).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// The plain words for a component name, as a ticket body shows it.
export const componentWords = (name) => {
  const s = String(name).replace(/[-_]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export const loadManifest = (root) => JSON.parse(readFileSync(resolve(root, MANIFEST_PATH), 'utf8'));

// The page's plain name: the label its surface's sketch shows in the control plane's bar, in
// lowercase kebab case ("Overview dashboard" is overview-dashboard).
export function pageNameOf(root, manifest, surfaceName) {
  const surface = manifest.surfaces[surfaceName];
  if (!surface) return kebab(surfaceName);
  const file = resolve(root, 'docs/design/sketches', surface.sketch);
  if (existsSync(file)) {
    const label = /<span class="dcp-crumbs">([^<]+)<\/span>/.exec(readFileSync(file, 'utf8'));
    if (label) return kebab(label[1]);
  }
  return kebab(surfaceName);
}

// Every string in a record is scanned before it is persisted.
export function sanitizeDeep(value, sanitize, found = new Set()) {
  if (typeof value === 'string') {
    const clean = sanitize(value);
    clean.redacted.forEach((l) => found.add(l));
    return { value: clean.text, redacted: found };
  }
  if (Array.isArray(value)) return { value: value.map((v) => sanitizeDeep(v, sanitize, found).value), redacted: found };
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = sanitizeDeep(v, sanitize, found).value;
    return { value: out, redacted: found };
  }
  return { value, redacted: found };
}

const FENCE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function parseTicket(text) {
  const m = FENCE.exec(text);
  if (!m) return null;
  return { data: parse(m[1]) ?? {}, body: text.slice(m[0].length).replace(/^\r?\n/, '') };
}

const KEY_ORDER = ['id', 'status', 'title', 'page', 'job', 'job-title', 'step', 'state', 'state-path', 'route', 'hash', 'served', 'spots', 'components', 'content-keys', 'content-edits', 'categories', 'device', 'viewport', 'build', 'legacy-id', 'redacted', 'created', 'revised'];
const ordered = (data) => {
  const out = {};
  for (const k of KEY_ORDER) if (data[k] !== undefined) out[k] = data[k];
  for (const k of Object.keys(data).sort()) if (!(k in out)) out[k] = data[k];
  return out;
};

export function renderTicket(data, body) {
  return `---\n${stringify(ordered(data), { lineWidth: 0 }).trimEnd()}\n---\n\n${body.trim()}\n`;
}

function listIds(dir) {
  const ids = [];
  if (!existsSync(dir)) return ids;
  for (const page of readdirSync(dir, { withFileTypes: true })) {
    if (!page.isDirectory() || page.name.startsWith('.')) continue;
    for (const name of readdirSync(resolve(dir, page.name))) {
      if (!name.endsWith('.md')) continue;
      const id = parseTicket(readFileSync(resolve(dir, page.name, name), 'utf8'))?.data?.id;
      if (id) ids.push(String(id));
    }
  }
  return ids;
}

// The next free id in a store shared with the review server's tickets, so ids never collide.
export function nextId(dir) {
  const max = listIds(dir).reduce((m, id) => Math.max(m, Number(id.replace(/\D/g, '')) || 0), 0);
  return `WI-${String(max + 1).padStart(3, '0')}`;
}

export const relativeTo = (from, to) => relative(from, to).split('\\').join('/');
