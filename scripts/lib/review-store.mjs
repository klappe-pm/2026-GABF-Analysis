// The feedback store: one Markdown file per ticket under docs/feedback/<page-name>/, readable in
// Obsidian and tracked in git with its captured images in a folder named after the ticket file.
// The pipeline's queue, log and work folders live under .docs/feedback/ and are never committed.
// A missing store reads as an empty one.
//
// A ticket's frontmatter holds its id, its status, the job, journey step and state the reviewer
// was on, the route, the highlighted spots, the design system components and content keys it
// concerns, its categories, and when it was created and last revised. The note is the body.
// Every ticket is ACCEPTED the moment it is registered, and an edit keeps it ACCEPTED and moves
// only its revised time.
//
// Every string is scanned for secret shaped values before it is written. The scan is the engine's
// (design-feedback.mjs sanitize), passed in so the tests run without the agent-graph checkout.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { parse, stringify } from 'yaml';
import { kebab } from './review-screens.mjs';
import { componentWords, obsidianUri } from './review-components.mjs';
import { ROOT } from './paths.mjs';

export const FEEDBACK_DIR = 'docs/feedback';
export const LOCAL_FEEDBACK_DIR = '.docs/feedback';
export const CATEGORIES_PATH = 'docs/design/feedback-categories.json';
export const ACCEPTED = 'ACCEPTED';
export const STATUSES = [ACCEPTED, 'DONE', 'DECLINED'];

export const feedbackDirOf = (root, env = process.env) => resolve(env.GABF_FEEDBACK_DIR || resolve(root, FEEDBACK_DIR));

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });
export const alphabetized = (list) => [...list].sort((a, b) => collator.compare(a, b) || (a < b ? -1 : 1));

export function loadCategories(root) {
  return alphabetized(JSON.parse(readFileSync(resolve(root, CATEGORIES_PATH), 'utf8')).categories);
}
export function cleanCategories(list, allowed) {
  const known = new Set(allowed);
  const picked = [...new Set((Array.isArray(list) ? list : []).map(String))];
  return { categories: alphabetized(picked.filter((c) => known.has(c))), unknown: picked.filter((c) => !known.has(c)) };
}

// Every string in a record is scanned before it is persisted, not only the note: an element's
// visible text or a URL can carry a value shaped like a secret as easily as the note can.
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

// ---------- reading ----------

const FENCE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function parseTicket(text) {
  const m = FENCE.exec(text);
  if (!m) return null;
  return { data: parse(m[1]) ?? {}, body: text.slice(m[0].length).replace(/^\r?\n/, '') };
}

const KEY_ORDER = ['id', 'status', 'title', 'page', 'job', 'job-title', 'step', 'state', 'state-path', 'route', 'hash', 'served', 'spots', 'components', 'content-keys', 'content-edits', 'setting-edits', 'categories', 'images', 'capture', 'issue', 'issue-url', 'pr', 'pr-url', 'device', 'viewport', 'build', 'legacy-id', 'redacted', 'created', 'revised'];
const ordered = (data) => {
  const out = {};
  for (const k of KEY_ORDER) if (data[k] !== undefined) out[k] = data[k];
  for (const k of Object.keys(data).sort()) if (!(k in out)) out[k] = data[k];
  return out;
};

export function renderTicket(data, body) {
  return `---\n${stringify(ordered(data), { lineWidth: 0 }).trimEnd()}\n---\n\n${body.trim()}\n`;
}

// Every ticket on disk: { id, page, file (absolute), rel (under the store), data, body }.
export function listTickets(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const page of readdirSync(dir, { withFileTypes: true })) {
    if (!page.isDirectory() || page.name.startsWith('.')) continue;
    for (const name of readdirSync(resolve(dir, page.name)).sort()) {
      if (!name.endsWith('.md')) continue;
      const file = resolve(dir, page.name, name);
      const parsed = parseTicket(readFileSync(file, 'utf8'));
      if (parsed?.data?.id) out.push({ id: parsed.data.id, page: page.name, file, rel: relative(dir, file), ...parsed });
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
}

export const findTicket = (dir, id) => listTickets(dir).find((t) => t.id.toLowerCase() === String(id).toLowerCase()) ?? null;

export function nextId(dir) {
  const max = listTickets(dir).reduce((m, t) => Math.max(m, Number(String(t.id).replace(/\D/g, '')) || 0), 0);
  return `WI-${String(max + 1).padStart(3, '0')}`;
}

// ---------- writing ----------

const firstSentence = (text) => {
  const one = String(text).replace(/\s+/g, ' ').trim();
  const end = one.search(/[.!?](\s|$)/);
  const s = end > 0 ? one.slice(0, end) : one;
  return s.length > 80 ? `${s.slice(0, 77).trimEnd()}...` : s;
};

const fileName = (id, title) => `${id.toLowerCase()}${kebab(title).slice(0, 48).replace(/-+$/, '') ? `-${kebab(title).slice(0, 48).replace(/-+$/, '')}` : ''}.md`;

const spotOf = (s, i) => ({
  n: Number(s.n) || i + 1,
  selector: String(s.selector ?? ''),
  rect: { x: Math.round(s.rect?.x ?? 0), y: Math.round(s.rect?.y ?? 0), width: Math.round(s.rect?.width ?? 0), height: Math.round(s.rect?.height ?? 0) },
  text: String(s.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 240),
});
const componentOf = (c) => (typeof c === 'string' ? { name: c, spec: null } : { name: String(c.name), spec: c.spec ?? null, ...(c.instance ? { instance: String(c.instance) } : {}) });

// The components section of a ticket body: each component with a spec file is a relative Markdown
// link from the ticket to that file, so the link works from the ticket in Obsidian; one without a
// file is plain words that say so.
export function componentsBody(components, ticketDir, root) {
  if (!components?.length) return '';
  const items = components.map((c) => {
    const words = componentWords(c.name);
    if (!c.spec) return `- ${words}, no design system file yet`;
    const link = relative(ticketDir, resolve(root, c.spec)).split(sep).join('/');
    return `- [${words}](${link}), [Open in Obsidian](${obsidianUri(root, c.spec)})`;
  });
  return `## components\n\n${items.join('\n')}`;
}

// The captured images of a ticket: each is shown and also a link that opens the file, by a path
// relative to the ticket so it works from the ticket in Obsidian and on GitHub.
export const imageLabel = (img) => (img.kind === 'page' ? 'Page' : img.kind === 'component' ? `Component${img.component ? `, ${componentWords(img.component)}` : ''}` : `Spot ${img.spot}${img.component ? `, ${componentWords(img.component)}` : ''}`);
export function imagesBody(images) {
  if (!images?.length) return '';
  return `## captured-images\n\n${images.map((i) => `- [${imageLabel(i)}](${i.path})`).join('\n')}`;
}
export const imageOf = (i) => ({ path: String(i.path), kind: ['page', 'spot', 'component'].includes(i.kind) ? i.kind : 'page', spot: i.spot ?? null, component: i.component ?? null, url: i.url ?? null });

// A ticket body with its components section replaced, kept right after the note.
function withComponentsSection(body, section) {
  const parts = body.split(/\n(?=## )/);
  const kept = parts.filter((p) => !/^## components\s*(\n|$)/.test(p));
  const note = kept.length && !kept[0].startsWith('## ') ? kept.shift() : '';
  return [note, section, ...kept].filter(Boolean).join('\n\n');
}

function contentBody(edits) {
  if (!edits?.length) return '';
  return edits.map((e) => `## content-edit\n\n${e.key} in ${e.file}\n\n- old: ${e.old}\n- new: ${e.new}${e.instances?.length ? `\n- also updated: ${e.instances.map((i) => `${i.file}:${i.line}`).join(', ')}` : ''}`).join('\n\n');
}

function settingBody(edits) {
  if (!edits?.length) return '';
  return edits.map((e) => `## setting-edit\n\n${e.key} in ${e.file}\n\n- old: ${e.old}\n- new: ${e.new}`).join('\n\n');
}

function write(dir, page, name, data, body, sanitize) {
  const clean = sanitizeDeep({ data, body }, sanitize);
  const fm = { ...clean.value.data, ...(clean.redacted.size ? { redacted: [...clean.redacted] } : {}) };
  mkdirSync(resolve(dir, page), { recursive: true });
  const file = resolve(dir, page, name);
  writeFileSync(file, renderTicket(fm, clean.value.body));
  return { file, redacted: [...clean.redacted] };
}

// Register a ticket. `input` is what the panel sends plus what the server resolved from the
// manifest for the screen (job, step, state, route, page).
export function addTicket(dir, input, { sanitize, categories = [], now = new Date(), root = ROOT }) {
  const text = String(input.text ?? '').trim();
  const edits = Array.isArray(input.contentEdits) ? input.contentEdits : [];
  const settings = Array.isArray(input.settingEdits) ? input.settingEdits : [];
  if (!text && !edits.length && !settings.length) throw new Error('feedback needs a note');
  if (!input.page) throw new Error('feedback needs a page: choose a journey step first');
  const picked = cleanCategories(input.categories, categories);
  const id = input.id ?? nextId(dir);
  const title = firstSentence(text || (edits.length ? `Copy change to ${edits[0].key}` : `Setting change to ${settings[0].key}`));
  const stamp = now.toISOString();
  const data = {
    id,
    status: ACCEPTED,
    title,
    page: input.page,
    job: input.job ?? null,
    'job-title': input.jobTitle ?? null,
    step: input.step ?? null,
    state: input.state ?? null,
    'state-path': input.statePath ?? null,
    route: input.route ?? null,
    hash: input.hash ?? '',
    served: input.served ?? 'site',
    spots: (input.spots ?? []).map(spotOf),
    components: (input.components ?? []).map(componentOf),
    'content-keys': [...new Set(input.contentKeys ?? [])],
    ...(edits.length ? { 'content-edits': edits } : {}),
    ...(settings.length ? { 'setting-edits': settings } : {}),
    categories: picked.categories,
    images: (input.images ?? []).map(imageOf),
    ...(input.capture ? { capture: input.capture } : {}),
    issue: input.issue ?? null,
    device: input.device ?? null,
    viewport: input.viewport ? `${input.viewport.width} by ${input.viewport.height}` : null,
    build: input.build?.commit ? String(input.build.commit).slice(0, 12) : null,
    ...(input.legacyId ? { 'legacy-id': input.legacyId } : {}),
    created: input.created ?? stamp,
    revised: input.revised ?? stamp,
  };
  const body = [text, componentsBody(data.components, resolve(dir, input.page), root), contentBody(edits), settingBody(settings), imagesBody(data.images), input.extraBody ?? ''].filter(Boolean).join('\n\n');
  const written = write(dir, input.page, fileName(id, title), data, body, sanitize);
  return { id, title, page: input.page, status: ACCEPTED, file: written.file, redacted: written.redacted, categoriesUnknown: picked.unknown };
}

// Edit a ticket. The status is not an input here: an edit keeps whatever the ticket is, and
// registered tickets are ACCEPTED. Only revised moves.
export function editTicket(dir, id, patch, { sanitize, categories = [], now = new Date(), root = ROOT }) {
  const t = findTicket(dir, id);
  if (!t) throw new Error(`no ticket ${id}`);
  const data = { ...t.data };
  let body = t.body;
  if (patch.text !== undefined) {
    const text = String(patch.text).trim();
    if (!text) throw new Error('a note cannot be empty');
    const rest = t.body.indexOf('\n## ');
    body = `${text}${rest === -1 ? '' : `\n${t.body.slice(rest)}`}`;
    if (patch.title === undefined) data.title = firstSentence(text);
  }
  if (patch.title !== undefined) data.title = String(patch.title);
  if (patch.categories !== undefined) {
    const picked = cleanCategories(patch.categories, categories);
    if (picked.unknown.length) throw new Error(`unknown categories: ${picked.unknown.join(', ')}. Edit ${CATEGORIES_PATH} to add one.`);
    data.categories = picked.categories;
  }
  if (patch.components !== undefined) {
    data.components = patch.components.map(componentOf);
    body = withComponentsSection(body, componentsBody(data.components, resolve(dir, t.page), root));
  }
  if (patch.contentKeys !== undefined) data['content-keys'] = [...new Set(patch.contentKeys)];
  data.revised = now.toISOString();
  const written = write(dir, t.page, t.rel.split('/').pop(), data, body, sanitize);
  return { id: t.id, status: data.status, file: written.file, redacted: written.redacted };
}

// A lifecycle change, not an edit: the ticket is finished or turned down. Recorded in the
// frontmatter with the commit that did it.
export function setStatus(dir, id, status, { note = '', change = null, now = new Date(), sanitize, extra = {} }) {
  if (!STATUSES.includes(status)) throw new Error(`status must be one of ${STATUSES.join(', ')}`);
  const t = findTicket(dir, id);
  if (!t) throw new Error(`no ticket ${id}`);
  const data = { ...t.data, ...extra, status, revised: now.toISOString() };
  if (status !== ACCEPTED) data.resolution = { status, change, note, at: now.toISOString() };
  else delete data.resolution;
  const written = write(dir, t.page, t.rel.split('/').pop(), data, t.body, sanitize);
  return { id: t.id, status, file: written.file };
}

// Pipeline bookkeeping: merge fields into the frontmatter and, when asked, replace the body's
// captured images section. The note and the revised time are left alone.
export function patchTicket(dir, id, fields, { sanitize, body = null }) {
  const t = findTicket(dir, id);
  if (!t) throw new Error(`no ticket ${id}`);
  const data = { ...t.data, ...fields };
  if (fields.images) data.images = fields.images.map(imageOf);
  let text = body ?? t.body;
  if (fields.images && body === null) {
    const parts = text.split(/\n(?=## )/).filter((p) => !/^## captured-images\s*(\n|$)/.test(p));
    text = [...parts, imagesBody(data.images)].filter(Boolean).join('\n\n');
  }
  const written = write(dir, t.page, t.rel.split('/').pop(), data, text, sanitize);
  return { id: t.id, file: written.file, redacted: written.redacted };
}

// ---------- the retired local store ----------

// Tickets written before the store moved to docs/feedback/ sit in .docs/feedback/<page>/. They move
// unchanged: the note and every frontmatter line stay byte for byte, and only the two new fields
// (images: [] and issue: null) are added before the closing fence. A ticket already at the new
// path is skipped; an image folder moves with its ticket. The pipeline's own folders are left.
export function migrateLegacyStore(legacyDir, dir) {
  const moved = [];
  if (!existsSync(legacyDir)) return moved;
  for (const page of readdirSync(legacyDir, { withFileTypes: true })) {
    if (!page.isDirectory() || page.name.startsWith('.')) continue;
    for (const name of readdirSync(resolve(legacyDir, page.name)).sort()) {
      const from = resolve(legacyDir, page.name, name);
      const to = resolve(dir, page.name, name);
      if (name.endsWith('.md')) {
        if (existsSync(to)) continue;
        const text = readFileSync(from, 'utf8');
        const m = FENCE.exec(text);
        if (!m) continue;
        const adds = [/^images:/m.test(m[1]) ? null : 'images: []', /^issue:/m.test(m[1]) ? null : 'issue: null'].filter(Boolean);
        const head = m[0];
        const closing = head.lastIndexOf('---');
        const eol = head.includes('\r\n') ? '\r\n' : '\n';
        const migrated = adds.length ? text.slice(0, closing) + adds.join(eol) + eol + text.slice(closing) : text;
        mkdirSync(resolve(dir, page.name), { recursive: true });
        writeFileSync(to, migrated);
        rmSync(from);
        moved.push({ from, to });
      } else if (statSync(from).isDirectory()) {
        if (existsSync(to)) continue;
        mkdirSync(resolve(dir, page.name), { recursive: true });
        cpSync(from, to, { recursive: true });
        rmSync(from, { recursive: true });
      }
    }
  }
  return moved;
}

// ---------- the old store ----------

// Notes from docs/design/design-feedback.jsonl, written once into the new layout. A note keeps its
// ticket id (fb-001 was WI-001), carries its old id as legacy-id so a second run skips it, and
// is ACCEPTED like every registered ticket; what became of it is stated in the body.
export function migrateRecords(dir, records, { sanitize, describe, components = () => [], categories = [] }) {
  const done = new Set(listTickets(dir).map((t) => t.data['legacy-id']).filter(Boolean));
  const closed = new Map(records.filter((r) => r.kind === 'resolution').map((r) => [r.resolves, r]));
  const refined = new Map();
  for (const r of records) if (r.kind === 'refinement') refined.set(r.refines, [...(refined.get(r.refines) ?? []), r]);
  const written = [];
  for (const n of records.filter((r) => r.kind === 'note')) {
    if (done.has(n.id)) continue;
    const info = n.screen ? describe(n.screen) : null;
    if (!info) continue;
    const spots = n.target ? [{ n: 1, selector: n.target.selector, rect: n.target.box?.document, text: n.target.text }] : [];
    const cats = [...(refined.get(n.id) ?? [])].reverse().find((r) => r.categories)?.categories ?? n.categories ?? [];
    const res = closed.get(n.id);
    const history = [
      ...(refined.get(n.id) ?? []).map((r) => `- ${r.at}: ${r.note}`),
      ...(res ? [`- ${res.at}: ${res.status}${res.change ? ` in ${res.change}` : ''}. ${res.note}`] : []),
    ];
    const id = n.ticket ?? `WI-${String(n.id).replace(/\D/g, '').padStart(3, '0')}`;
    const used = new Set(listTickets(dir).map((t) => t.id));
    if (used.has(id)) continue;
    const input = {
      text: n.text,
      categories: cats,
      page: info.page,
      job: info.job,
      jobTitle: info.jobTitle,
      step: info.step,
      state: info.state,
      statePath: info.statePath,
      route: n.page?.route ?? info.route,
      hash: n.page?.hash ?? info.hash,
      served: n.page?.served ?? info.served,
      spots,
      components: spots.length ? components(n) : [],
      contentKeys: [],
      device: n.device,
      viewport: n.viewport,
      build: n.build,
      legacyId: n.id,
      created: n.at,
      revised: [n.at, ...(refined.get(n.id) ?? []).map((r) => r.at), res?.at].filter(Boolean).sort().pop(),
      extraBody: history.length ? `## history\n\n${history.join('\n')}` : '',
    };
    const out = addTicket(dir, { ...input, id }, { sanitize, categories });
    written.push(out);
  }
  return written;
}

// Problems in the tickets on disk: a file the reader cannot parse, a missing key, a status outside
// the set, a ticket filed under the wrong page, or a repeated id. No store at all is no problem.
// A design system Save ticket has no journey step, spots or copy keys, so only the common keys are required.
const REQUIRED = ['id', 'status', 'page', 'categories', 'created', 'revised'];
export function ticketIssues(dir) {
  const issues = [];
  if (!existsSync(dir)) return issues;
  const seen = new Map();
  for (const page of readdirSync(dir, { withFileTypes: true })) {
    if (!page.isDirectory() || page.name.startsWith('.')) continue;
    for (const name of readdirSync(resolve(dir, page.name)).filter((n) => n.endsWith('.md')).sort()) {
      const rel = `${page.name}/${name}`;
      let parsed = null;
      try { parsed = parseTicket(readFileSync(resolve(dir, page.name, name), 'utf8')); } catch { parsed = null; }
      if (!parsed || !parsed.data.id) { issues.push(`feedback ticket ${rel} has no readable frontmatter with an id`); continue; }
      for (const k of REQUIRED) if (parsed.data[k] === undefined) issues.push(`feedback ticket ${rel} lacks ${k}`);
      if (parsed.data.status && !STATUSES.includes(parsed.data.status)) issues.push(`feedback ticket ${rel} has status ${parsed.data.status}; expected one of ${STATUSES.join(', ')}`);
      if (parsed.data.page && parsed.data.page !== page.name) issues.push(`feedback ticket ${rel} is filed under ${page.name} but names the page ${parsed.data.page}`);
      if (!/^[a-z0-9]+(-[a-z0-9]+)*\.md$/.test(name)) issues.push(`feedback ticket ${rel} is not a lowercase kebab case file name`);
      if (seen.has(parsed.data.id)) issues.push(`feedback ticket id ${parsed.data.id} is used by ${seen.get(parsed.data.id)} and ${rel}`);
      seen.set(parsed.data.id, rel);
    }
  }
  return issues;
}
