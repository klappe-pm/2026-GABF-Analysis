// The GitHub issue for a feedback ticket. The issue form in .github/ISSUE_TEMPLATE/design-feedback.yml
// and this renderer carry the same sections in the same order, so an issue made from a ticket reads
// exactly like one a person files through the form (GitHub renders a form answer as a "###" heading
// with the answer under it, and "_No response_" for an empty one). Titles and sections use plain
// words: no data slugs, no dash used as punctuation.

import { relative, resolve, sep } from 'node:path';
import { componentWords } from './review-components.mjs';
import { imageLabel, showSetting } from './review-store.mjs';

export const REPO = 'klappe-pm/GABF-Analysis';
export const NO_RESPONSE = '_No response_';

// The form labels, in order. The issue form's field labels must equal this list.
export const SECTIONS = ['Summary', 'Page', 'Journey step and state', 'Route', 'Spots', 'Components', 'Captured images', 'Content edits', 'Setting edits', 'Categories', 'Acceptance criteria and notes'];

// ---------- labels ----------

export const STATUS_LABELS = { progress: 'status: in progress', done: 'status: done', attention: 'status: needs attention' };
export const KIND_LABELS = { content: 'kind: content', setting: 'kind: setting', design: 'kind: design' };
export const FEEDBACK_LABEL = 'feedback';

const COLORS = { feedback: '0e8a16', category: 'c5def5', page: 'bfd4f2', kind: 'fbca04', 'status: in progress': '1d76db', 'status: done': '0e8a16', 'status: needs attention': 'd93f0b' };

export function labelSpec(name) {
  const key = COLORS[name] ? name : name.startsWith('page: ') ? 'page' : name.startsWith('kind: ') ? 'kind' : 'category';
  let description = 'Feedback category';
  if (name === FEEDBACK_LABEL) description = 'A design feedback ticket from the review panel';
  else if (name.startsWith('page: ')) description = 'The page the feedback is about';
  else if (name.startsWith('kind: ')) description = 'What sort of change the feedback asks for';
  else if (name.startsWith('status: ')) description = 'Where the feedback is in the process';
  return { name, color: COLORS[key], description };
}

// ---------- plain words ----------

// Built from code points so this source carries no dash glyph itself.
const EN = String.fromCharCode(0x2013);
const EM = String.fromCharCode(0x2014);
const DASH_GLYPHS = new RegExp(`\\s*[${EN}${EM}]\\s*`, 'g');

// Dashes used as punctuation become commas, and a data slug becomes spaced words.
export function plain(text) {
  return String(text ?? '')
    .replace(DASH_GLYPHS, ', ')
    .replace(/\s-{1,2}\s/g, ', ')
    .replace(/-{2,}/g, ' ')
    .replace(/(^|[^\w{/])([a-z]+(?:-[a-z0-9]+)+)(?![\w}/])/gi, (m, pre, slug) => pre + slug.replace(/-/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

export const pageWords = (page) => {
  const s = String(page ?? '').replace(/-/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const cut = (text, n) => (text.length > n ? `${text.slice(0, n - 3).trimEnd()}...` : text);

export function noteOf(ticket) {
  const body = String(ticket.body ?? '');
  const at = body.search(/^## /m);
  return (at === -1 ? body : body.slice(0, at)).trim();
}

export function kindOf(data) {
  if ((data['content-edits'] ?? []).length) return 'content';
  if ((data['setting-edits'] ?? []).length) return 'setting';
  return 'design';
}

export function issueTitle(ticket) {
  const d = ticket.data;
  const c = (d['content-edits'] ?? [])[0];
  const s = (d['setting-edits'] ?? [])[0];
  if (c) return cut(plain(`Change "${c.old}" to "${c.new}"`), 100);
  if (s) return cut(plain(`Change ${s.key} from ${showSetting(s.old)} to ${showSetting(s.new)}`), 100);
  return cut(plain(d.title || noteOf(ticket) || `Feedback ${d.id}`), 100);
}

export function labelsFor(data, categories = data.categories ?? []) {
  return [FEEDBACK_LABEL, ...categories, `page: ${pageWords(data.page)}`, KIND_LABELS[kindOf(data)]];
}

// ---------- urls ----------

export const blobUrl = (path, ref = 'main', repo = REPO) => `https://github.com/${repo}/blob/${ref}/${path}`;
export const specUrl = (spec, repo = REPO) => blobUrl(spec, 'main', repo);
// The repository path of an image, from the ticket's page folder and the path relative to the ticket.
export const imageRepoPath = (page, imagePath) => `docs/feedback/${page}/${imagePath}`;
export const imageUrl = (page, img, ref = 'main', repo = REPO) => `${blobUrl(imageRepoPath(page, img.path), ref, repo)}?raw=true`;
export const ticketRepoPath = (page, file) => `docs/feedback/${page}/${file}`;

// ---------- the body ----------

const bullets = (items) => items.map((i) => `- ${i}`).join('\n');
const code = (s) => `\`${String(s).replace(/`/g, "'")}\``;

export function sectionTexts(ticket, { ref = 'main', repo = REPO } = {}) {
  const d = ticket.data;
  const out = {};
  out['Summary'] = noteOf(ticket) || plain(d.title);
  out['Page'] = pageWords(d.page);
  const step = [d['job-title'] ? plain(d['job-title']) : null, d.step ? `Step ${d.step}` : null, d.state ? plain(d.state) : null].filter(Boolean);
  out['Journey step and state'] = step.join('. ');
  out['Route'] = [d.route, d.hash].filter(Boolean).join('');
  out['Spots'] = (d.spots ?? []).length
    ? d.spots.map((s) => `${s.n}. ${s.text ? `"${plain(s.text)}"` : 'An element on the page'} (${code(s.selector)})`).join('\n')
    : '';
  out['Components'] = (d.components ?? []).length
    ? bullets(d.components.map((c) => (c.spec ? `[${componentWords(c.name)}](${specUrl(c.spec, repo)})` : `${componentWords(c.name)}, no design system file yet`)))
    : '';
  out['Captured images'] = (d.images ?? []).length
    ? d.images.map((i) => {
      const url = imageUrl(d.page, i, ref, repo);
      return `${imageLabel(i)}\n\n[![${imageLabel(i)}](${url})](${url})`;
    }).join('\n\n')
    : '';
  out['Content edits'] = (d['content-edits'] ?? []).map((e) => `Copy entry ${code(e.key)} in ${code(e.file)}\n\n- Old: ${e.old}\n- New: ${e.new}${(e.instances ?? []).length ? `\n- Also changed: ${e.instances.map((i) => `${code(i.file)} line ${i.line}`).join(', ')}` : ''}`).join('\n\n');
  out['Setting edits'] = (d['setting-edits'] ?? []).map((e) => `Setting ${code(e.key)} in ${code(e.file)}\n\n- Old: ${showSetting(e.old)}\n- New: ${showSetting(e.new)}`).join('\n\n');
  out['Categories'] = (d.categories ?? []).map((c) => `- [x] ${c}`).join('\n');
  const criteria = [];
  for (const e of d['content-edits'] ?? []) criteria.push(`The words read "${e.new}" everywhere the old words appeared.`);
  for (const e of d['setting-edits'] ?? []) criteria.push(`The setting ${plain(e.key)} is ${showSetting(e.new)}.`);
  if (!criteria.length) criteria.push('The page does what the summary asks.');
  criteria.push('All repository checks pass.', 'No dash is used as punctuation and the copy is plain words.');
  out['Acceptance criteria and notes'] = `${bullets(criteria)}\n\nFeedback ticket ${d.id}, filed from the design review panel.`;
  return out;
}

export function renderIssueBody(ticket, opts = {}) {
  const text = sectionTexts(ticket, opts);
  return `${SECTIONS.map((name) => `### ${name}\n\n${text[name]?.trim() ? text[name].trim() : NO_RESPONSE}`).join('\n\n')}\n`;
}

// The headings of a rendered body, for checking it against the form.
export const sectionsOf = (body) => [...String(body).matchAll(/^### (.+)$/gm)].map((m) => m[1]);

// Local link from a directory to a file, with forward slashes.
export const relativeLink = (fromDir, file) => relative(fromDir, resolve(file)).split(sep).join('/');
