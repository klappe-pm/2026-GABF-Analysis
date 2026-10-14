// The feedback store and the tickets derived from it.
//
// docs/design/design-feedback.jsonl is the record. It is append only and hash chained by the
// agent-graph engine (design-feedback.mjs), whose check and list commands keep working on it. That
// chain hashes only a few fields, so every record written here also carries a seal: a hash of the
// whole record and the previous record's hash. An edit to any field, metadata included, breaks it.
//
// Nothing is edited or deleted. A clarification, a recategorisation, a split, a status change, or a
// resolution is a new record that names the note it is about. Tickets under docs/work-items/ are
// generated from the store, so the store stays the only source of truth.
//
// Pure functions here take the engine module as an argument, so tests can run without it.

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const FEEDBACK_PATH = 'docs/design/design-feedback.jsonl';
export const CATEGORIES_PATH = 'docs/design/feedback-categories.json';
export const STATUSES = ['open', 'in-progress', 'done', 'declined'];

function djb2(material) {
  let h = 5381;
  for (let i = 0; i < material.length; i++) h = ((h << 5) + h + material.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  return JSON.stringify(value ?? null);
}
export function sealOf(prev, record) {
  const { prev: _p, hash: _h, seal: _s, ...body } = record;
  return djb2(`${prev}|${stable(body)}`);
}

export function sealIssues(records) {
  const issues = [];
  let prev = 'genesis';
  records.forEach((r, i) => {
    if (!r.seal) issues.push(`feedback line ${i + 1}: no seal. Records are written through the review server or npm run tickets, which seal the whole record.`);
    else if (r.seal !== sealOf(prev, r)) issues.push(`feedback line ${i + 1}: seal does not match. A field of this record was changed after it was written.`);
    prev = r.hash;
  });
  return issues;
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

export const ticketId = (noteId) => `WI-${String(noteId).replace(/\D/g, '').padStart(3, '0')}`;
export const noteIdOf = (ref) => (/^WI-\d+$/i.test(ref) ? `fb-${ref.replace(/\D/g, '').padStart(3, '0')}` : ref);

export function loadCategories(root) {
  return JSON.parse(readFileSync(resolve(root, CATEGORIES_PATH), 'utf8')).categories;
}
export function cleanCategories(list, allowed) {
  const known = new Set(allowed);
  const picked = [...new Set((Array.isArray(list) ? list : []).map(String))];
  return { categories: picked.filter((c) => known.has(c)), unknown: picked.filter((c) => !known.has(c)) };
}

// Append one record through the engine's chain, sealed over its whole body.
export function appendSealed(fb, root, record) {
  const existing = fb.readFeedback(root);
  const prev = existing.length ? existing[existing.length - 1].hash : 'genesis';
  const clean = sanitizeDeep(record, fb.sanitize);
  const body = { ...clean.value, ...(clean.redacted.size ? { redacted: [...clean.redacted] } : {}) };
  return fb.append({ ...body, seal: sealOf(prev, body) }, root);
}

export function addNote(fb, root, input, context = {}) {
  const records = fb.readFeedback(root);
  const id = fb.nextId(records);
  const text = String(input.text ?? '').trim();
  if (!text) throw new Error('feedback needs text');
  const { categories, unknown } = cleanCategories(input.categories, loadCategories(root));
  const record = {
    kind: 'note',
    id,
    at: new Date().toISOString(),
    screen: context.screen ?? input.screen ?? null,
    surface: context.surface ?? input.surface ?? null,
    path: context.path ?? input.path ?? null,
    text,
    ticket: ticketId(id),
    mode: input.mode === 'element' ? 'element' : 'page',
    categories,
    ...(unknown.length ? { categories_unknown: unknown } : {}),
    ...(input.split_from ? { split_from: input.split_from } : {}),
    ...(input.setup_test ? { setup_test: true } : {}),
    page: input.page ?? null,
    filters: input.filters ?? null,
    viewport: input.viewport ?? null,
    device: input.device ?? null,
    theme: input.theme ?? null,
    build: input.build ?? null,
    target: input.mode === 'element' ? input.target ?? null : null,
    code: input.code ?? [],
    manifest: context.manifest ?? null,
  };
  return appendSealed(fb, root, record);
}

function requireNote(records, id) {
  const note = records.find((r) => r.kind === 'note' && r.id === id);
  if (!note) throw new Error(`no feedback note ${id}`);
  return note;
}

export function refine(fb, root, id, { note = '', categories = null, title = null, by = null, setupTest = false }) {
  const records = fb.readFeedback(root);
  requireNote(records, id);
  const cats = categories ? cleanCategories(categories, loadCategories(root)) : null;
  if (cats && cats.unknown.length) throw new Error(`unknown categories: ${cats.unknown.join(', ')}. Edit ${CATEGORIES_PATH} to add one.`);
  return appendSealed(fb, root, { kind: 'refinement', at: new Date().toISOString(), refines: id, note, ...(cats ? { categories: cats.categories } : {}), ...(title ? { title } : {}), ...(setupTest ? { setup_test: true } : {}), ...(by ? { by } : {}) });
}

export function setStatus(fb, root, id, status, { note = '', change = null, by = null } = {}) {
  if (!STATUSES.includes(status)) throw new Error(`status must be one of ${STATUSES.join(', ')}`);
  const records = fb.readFeedback(root);
  requireNote(records, id);
  // done and declined close the note for the engine too, so its list and check agree.
  if (status === 'done' || status === 'declined') {
    return appendSealed(fb, root, { kind: 'resolution', at: new Date().toISOString(), resolves: id, status, change, note, ...(by ? { by } : {}) });
  }
  return appendSealed(fb, root, { kind: 'status', at: new Date().toISOString(), about: id, status, note, ...(by ? { by } : {}) });
}

export function split(fb, root, id, { text, categories = [] }) {
  const records = fb.readFeedback(root);
  const source = requireNote(records, id);
  const created = addNote(fb, root, { ...source, text, categories, split_from: id }, { screen: source.screen, surface: source.surface, path: source.path, manifest: source.manifest });
  appendSealed(fb, root, { kind: 'refinement', at: new Date().toISOString(), refines: id, note: `Split: part of this note continues as ${created.id} (${created.ticket}).`, split_into: created.id });
  return created;
}

// ---------- tickets ----------
const firstSentence = (text) => {
  const one = String(text).replace(/\s+/g, ' ').trim();
  const end = one.search(/[.!?](\s|$)/);
  const s = end > 0 ? one.slice(0, end) : one;
  return s.length > 80 ? `${s.slice(0, 77).trimEnd()}...` : s;
};

export function deriveTickets(records) {
  const tickets = new Map();
  for (const r of records) {
    if (r.kind === 'note') {
      tickets.set(r.id, { id: r.ticket ?? ticketId(r.id), note: r, title: firstSentence(r.text), categories: r.categories ?? [], status: 'open', history: [], change: null, setupTest: Boolean(r.setup_test), line: records.indexOf(r) + 1 });
      continue;
    }
    const ref = r.refines ?? r.about ?? r.resolves;
    const t = tickets.get(ref);
    if (!t) continue;
    t.history.push({ ...r, line: records.indexOf(r) + 1 });
    if (r.kind === 'refinement') {
      if (r.categories) t.categories = r.categories;
      if (r.title) t.title = r.title;
      if (r.setup_test) t.setupTest = true;
    } else if (r.kind === 'status') t.status = r.status;
    else if (r.kind === 'resolution') { t.status = r.status ?? 'done'; t.change = r.change ?? t.change; }
  }
  return [...tickets.values()];
}

const fence = (text) => `\`\`\`text\n${String(text ?? '').replace(/```/g, "'''")}\n\`\`\``;
const json = (v) => JSON.stringify(v);

// Frontmatter follows the agent-graph work item shape: the common keys in order, then the rest
// alphabetically, one JSON value per line. Everything a reviewer typed sits in a text fence.
export function ticketMarkdown(t) {
  const n = t.note;
  const day = n.at.slice(0, 10);
  const last = t.history.length ? t.history[t.history.length - 1].at.slice(0, 10) : day;
  const code = (n.code ?? []).map((c) => c.location);
  const fm = [
    ['domain', 'gabf-analysis'], ['category', 'work-items'], ['sub-category', 'design-feedback'], ['topics', ['feedback']], ['types', ['ticket']],
    ['date-created', day], ['date-revised', last], ['status', t.status], ['aliases', []], ['tags', t.categories.map((c) => c.toLowerCase().replace(/\s+/g, '-'))],
    ['categories', t.categories], ['change', t.change], ['code-locations', code], ['done', t.status === 'done'], ['element', n.target ? n.target.selector : null],
    ['feedback', n.id], ['id', t.id], ['mode', n.mode ?? 'page'], ['route', n.page?.route ?? null], ['screen', n.screen ?? null], ['setup-test', t.setupTest], ['surface', n.surface ?? null], ['title', t.title],
  ];
  const lines = ['---', ...fm.map(([k, v]) => `${k}: ${json(v)}`), '---', '', `# ${t.id.toLowerCase()}`, ''];
  lines.push(`Generated from \`${FEEDBACK_PATH}\` line ${t.line} by \`npm run tickets -- generate\`. Do not edit this file; change the ticket with \`npm run tickets\`, which appends to the store.`, '');
  lines.push('## note', '', fence(n.text), '');
  lines.push('## where', '');
  lines.push(`- Page: \`${n.page?.route ?? 'unknown'}\`${n.page?.hash ? ` with hash \`${n.page.hash}\`` : ''}${n.page?.condition ? ` (served as ${n.page.condition})` : ''}`);
  lines.push(`- Screen: ${n.screen ?? 'not matched to a manifest screen'}${n.surface ? ` on surface ${n.surface}` : ''}`);
  lines.push(`- Viewport: ${n.viewport ? `${n.viewport.width} by ${n.viewport.height}` : 'unknown'}, ${n.device ?? 'unknown'} class, ${n.theme ?? 'unknown'} theme`);
  lines.push(`- Build: ${n.build?.commit ? `\`${n.build.commit.slice(0, 12)}\` on \`${n.build.branch}\`${n.build.dirty ? ' with uncommitted changes' : ''}` : 'unknown'}`);
  const filters = n.filters?.hash && Object.keys(n.filters.hash).length ? n.filters.hash : n.filters?.stored;
  lines.push(`- Filters: ${filters && Object.keys(filters).length ? `\`${json(filters)}\`` : 'none'}`);
  if (n.target) {
    lines.push(`- Element: \`${n.target.selector}\``);
    const b = n.target.box?.document;
    if (b) lines.push(`- Box in the document: x ${b.x}, y ${b.y}, ${b.width} by ${b.height}; click at x ${n.target.point?.document?.x}, y ${n.target.point?.document?.y}`);
    lines.push(`- Screenshot: ${n.target.screenshot ?? 'not captured in the browser; capture the box above from the review build'}`);
  }
  lines.push('');
  if (n.target?.text) lines.push('Visible text of the element:', '', fence(n.target.text), '');
  lines.push('## code-to-change', '');
  for (const c of n.code ?? []) lines.push(`- \`${c.location}\` (${c.via})`);
  if (!(n.code ?? []).length) lines.push('- No code location was recorded.');
  lines.push('');
  if (n.manifest?.nodes?.length) lines.push('## design-nodes', '', ...n.manifest.nodes.map((id) => `- \`${id}\``), '');
  lines.push('## history', '');
  lines.push(`- ${n.at}: filed as ${n.id}${n.split_from ? `, split from ${n.split_from}` : ''}${n.categories?.length ? `, categories ${n.categories.join(', ')}` : ''}${n.setup_test ? ', setup test' : ''} (store line ${t.line})`);
  for (const h of t.history) {
    const what = h.kind === 'refinement' ? `refined${h.setup_test ? ', marked as a setup test' : ''}${h.title ? ', title set' : ''}${h.categories ? `, categories ${h.categories.join(', ') || 'cleared'}` : ''}` : h.kind === 'status' ? `status ${h.status}` : `${h.status ?? 'done'}${h.change ? ` in \`${h.change}\`` : ''}`;
    lines.push(`- ${h.at}: ${what}${h.by ? ` by ${h.by}` : ''} (store line ${h.line})`);
    if (h.note) lines.push('', fence(h.note), '');
  }
  return proseSafe(`${lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`);
}

// A reviewer's words stay verbatim inside text fences. Outside them (a title in the index, a
// selector, a filter value) a dash glyph would fail the repository's prose check, so it becomes a
// comma in the generated view; the store keeps the original. The glyphs are built from code points
// so this source carries none.
const DASH_GLYPHS = new RegExp(`\\s*[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]\\s*`, 'g');
export function proseSafe(markdown) {
  let inFence = false;
  return markdown.split('\n').map((line) => {
    if (/^\s*```/.test(line)) { inFence = !inFence; return line; }
    return inFence ? line : line.replace(DASH_GLYPHS, ', ');
  }).join('\n');
}

export function indexMarkdown(tickets) {
  const rows = tickets.map((t) => `| [${t.id}](${t.id}.md) | ${t.status} | ${t.title.replace(/\|/g, '&#124;')} | ${t.categories.join(', ') || 'none'} | \`${t.note.page?.route ?? ''}\` |`);
  return proseSafe(`# README.MD

Tickets generated from \`${FEEDBACK_PATH}\`, one per feedback note. The store is the source of truth: never edit a ticket file, append to the store with \`npm run tickets\` and the files are regenerated.

| Ticket | Status | Title | Categories | Page |
| --- | --- | --- | --- | --- |
${rows.join('\n')}
`.replace(/\n{3,}/g, '\n\n'));
}

export function renderTicketFiles(records) {
  const tickets = deriveTickets(records);
  const files = new Map([['README.md', indexMarkdown(tickets)]]);
  for (const t of tickets) files.set(`${t.id}.md`, ticketMarkdown(t));
  return files;
}

export const TICKETS_DIR = 'docs/work-items';
export function writeTicketFiles(root, records) {
  const dir = resolve(root, TICKETS_DIR);
  mkdirSync(dir, { recursive: true });
  const files = renderTicketFiles(records);
  for (const f of readdirSync(dir)) if (!files.has(f)) rmSync(resolve(dir, f));
  for (const [name, body] of files) {
    const path = resolve(dir, name);
    if (!existsSync(path) || readFileSync(path, 'utf8') !== body) writeFileSync(path, body);
  }
  return files;
}
