// Owner decisions. A question only the owner can answer becomes a GitHub issue assigned to
// klappe-pm with the label "needs: owner decision", written to the form in
// .github/ISSUE_TEMPLATE/owner-decision.yml so a person and an agent file the same thing. When
// klappe-pm comments an answer, the pipeline turns it into a ticket of kind decision under
// docs/feedback/decisions/ and runs it like any other ticket. Only comments authored by klappe-pm
// count: every comment an agent posts carries AGENT_MARK and is ignored, because agents post
// through the owner's own GitHub login.

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { REPO, plain } from './feedback-issue.mjs';
import { ACCEPTED, addTicket, findTicket, listTickets, patchTicket } from './review-store.mjs';

export const OWNER = 'klappe-pm';
export const DECISION_LABEL = 'needs: owner decision';
export const AGENT_MARK = '<!-- feedback-pipeline -->';
export const DECISIONS_PAGE = 'decisions';

// The form labels, in order. The issue form's field labels must equal this list.
export const DECISION_SECTIONS = ['Question', 'Context', 'Options', 'Recommended option', 'What is blocked until it is answered', 'How to answer'];
export const HOW_TO_ANSWER = 'Reply to this issue with the letter of the option you choose, or with your own answer in plain words. Add a sentence if the reason matters. The next comment from klappe-pm is taken as the answer.';

const NO_RESPONSE = '_No response_';

export const areaLabel = (area) => `area: ${plain(area || 'general').toLowerCase()}`;
export const labelColor = (name) => (name === DECISION_LABEL ? 'd93f0b' : 'c2e0c6');

// ---------- the body ----------

export const letterOf = (i) => String.fromCharCode(65 + i);

// "Keep separate => no source links the four" is an option with its consequence.
export function parseOption(text, i) {
  const [label, ...rest] = String(text).split(/\s*=>\s*/);
  return { letter: letterOf(i), text: label.trim(), consequence: rest.join(' => ').trim() };
}

const optionLine = (o) => `- **${o.letter}.** ${o.text}.${o.consequence ? ` Consequence: ${o.consequence}.` : ''}`.replace(/\.\.$/, '.');

// Which option letter a recommendation names: "A", "A plus C", or the option's own words.
export function recommendedText(recommend, options) {
  const r = String(recommend ?? '').trim();
  if (!r) return '';
  const parts = r.split(/\s*(?:\bplus\b|\band\b|,|\+)\s*/i);
  const byLetter = parts.every((p) => /^[A-Za-z]$/.test(p)) ? parts.map((p) => p.toUpperCase()) : null;
  if (byLetter) return byLetter.map((l) => `${l}. ${options.find((o) => o.letter === l)?.text ?? ''}`).join('\n');
  const hit = options.find((o) => o.text.toLowerCase() === r.toLowerCase());
  return hit ? `${hit.letter}. ${hit.text}` : r;
}

export function renderDecisionBody({ question, context, options, recommend, blocks }) {
  const opts = options.map((o, i) => (typeof o === 'string' ? parseOption(o, i) : { letter: letterOf(i), ...o }));
  const sections = {
    'Question': plain(question),
    'Context': context,
    'Options': opts.map(optionLine).join('\n'),
    'Recommended option': recommendedText(recommend, opts),
    'What is blocked until it is answered': blocks,
    'How to answer': HOW_TO_ANSWER,
  };
  return `${DECISION_SECTIONS.map((name) => `### ${name}\n\n${String(sections[name] ?? '').trim() || NO_RESPONSE}`).join('\n\n')}\n`;
}

// The sections of an issue body, by heading.
export function sectionsFromBody(body) {
  const out = {};
  const parts = String(body).split(/^### /m).slice(1);
  for (const p of parts) {
    const nl = p.indexOf('\n');
    out[p.slice(0, nl).trim()] = p.slice(nl + 1).trim();
  }
  return out;
}

export function optionsFromBody(body) {
  const text = sectionsFromBody(body)['Options'] ?? '';
  return [...text.matchAll(/^- \*\*([A-Z])\.\*\* (.+?)(?: Consequence: (.*))?$/gm)].map((m) => ({ letter: m[1], text: m[2].replace(/\.$/, ''), consequence: (m[3] ?? '').replace(/\.$/, '') }));
}

// ---------- filing ----------

const norm = (s) => plain(s).toLowerCase().replace(/[^a-z0-9 ]+/g, '').replace(/\s+/g, ' ').trim();
const ghJson = (r, what) => {
  if (r.status !== 0) throw new Error(`${what} failed: ${(r.stderr || r.stdout).trim().split('\n').slice(-2).join(' ')}`);
  return JSON.parse(r.stdout || '[]');
};

export function listOpenDecisions({ exec, repo = REPO, cwd }) {
  return ghJson(exec('gh', ['issue', 'list', '-R', repo, '--label', DECISION_LABEL, '--state', 'open', '--json', 'number,title,body,url,createdAt', '--limit', '200'], { cwd }), 'listing open decisions');
}

function ensureLabels({ exec, repo, cwd }, names) {
  const have = new Set(ghJson(exec('gh', ['label', 'list', '-R', repo, '--json', 'name', '--limit', '500'], { cwd }), 'listing labels').map((l) => l.name.toLowerCase()));
  for (const name of names) {
    if (have.has(name.toLowerCase())) continue;
    const r = exec('gh', ['label', 'create', name, '-R', repo, '--color', labelColor(name), '--description', name === DECISION_LABEL ? 'A question only the owner can answer' : 'The part of the project a decision is about'], { cwd });
    if (r.status !== 0) throw new Error(`creating the label ${name} failed: ${(r.stderr || r.stdout).trim()}`);
  }
}

// File one decision. An open issue that asks the same question is returned instead of a second one.
// `sanitize` is the secret scan; a body it would change is refused, because the repository is public.
export function openDecision(input, { exec, repo = REPO, cwd, queueDir, sanitize, dry = false }) {
  const question = plain(input.question);
  if (!question) throw new Error('A decision needs a question.');
  if (!(input.options ?? []).length) throw new Error('A decision needs at least one option.');
  const body = renderDecisionBody({ ...input, question });
  if (sanitize && sanitize(body).redacted.length) throw new Error('The decision holds a value shaped like a secret. Nothing was filed.');
  const existing = listOpenDecisions({ exec, repo, cwd }).find((i) => norm(i.title) === norm(question) || norm(sectionsFromBody(i.body ?? '')['Question'] ?? '') === norm(question));
  if (existing) return { created: false, number: existing.number, url: existing.url };
  const labels = [DECISION_LABEL, areaLabel(input.area)];
  ensureLabels({ exec, repo, cwd }, labels);
  const file = resolve(queueDir, `decision-${Date.now()}.md`);
  if (!dry) { mkdirSync(queueDir, { recursive: true }); writeFileSync(file, body); }
  const r = exec('gh', ['issue', 'create', '-R', repo, '--title', question.length > 120 ? `${question.slice(0, 117)}...` : question, '--body-file', file, ...labels.flatMap((l) => ['--label', l]), '--assignee', OWNER], { cwd });
  if (r.status !== 0) throw new Error(`filing the decision failed: ${(r.stderr || r.stdout).trim()}`);
  const url = r.stdout.trim().split('\n').pop();
  return { created: true, number: Number(/\/issues\/(\d+)/.exec(url)?.[1]) || null, url };
}

// ---------- answers ----------

// Comments that count as an answer: authored by the owner, not posted by an agent through the owner's login.
export function ownerAnswers(comments, owner = OWNER) {
  return comments.filter((c) => c.user?.login === owner && !String(c.body ?? '').includes(AGENT_MARK) && String(c.body ?? '').trim());
}

// What the owner chose: the option a leading letter names, or free text.
export function interpretAnswer(text, options) {
  const t = String(text).trim();
  const m = /^\s*([A-Z])(?:\b|(?=\s*[,.;:]))/.exec(t);
  const chosen = m ? options.find((o) => o.letter === m[1]) : null;
  const letters = [...t.matchAll(/\b([A-Z])\b(?=\s*(?:plus|and|,|\+|$))/g)].map((x) => x[1]).filter((l) => options.some((o) => o.letter === l));
  return { text: t, option: chosen ?? null, letters: [...new Set(letters)] };
}

function ticketBody(issue, ans, options, note) {
  const pick = ans.option ? `Chosen option: ${ans.option.letter}. ${ans.option.text}${ans.option.consequence ? `. Consequence: ${ans.option.consequence}` : ''}` : 'Free text answer.';
  return `Owner decision on issue #${issue.number}: ${plain(issue.title)}\n\nAnswer from ${OWNER}: ${note}\n\n${pick}`;
}

// Turn the owner's answer to a decision issue into an ACCEPTED ticket of kind decision. Returns the
// ticket, or null when there is no owner answer yet or the issue already has a ticket.
export function ticketFromAnswer(issue, comments, { storeDir, sanitize, categories = [], root, now = new Date() }) {
  if (listTickets(storeDir).some((t) => t.data['decision-issue'] === issue.number)) return null;
  const answers = ownerAnswers(comments);
  if (!answers.length) return null;
  const answer = answers[answers.length - 1];
  const options = optionsFromBody(issue.body ?? '');
  const ans = interpretAnswer(answer.body, options);
  const sections = sectionsFromBody(issue.body ?? '');
  const out = addTicket(storeDir, {
    page: DECISIONS_PAGE,
    text: ticketBody(issue, ans, options, ans.text),
    categories,
    extraBody: `## decision\n\nQuestion: ${plain(sections['Question'] ?? issue.title)}\n\nContext: ${sections['Context'] ?? ''}\n\nBlocked until answered: ${sections['What is blocked until it is answered'] ?? ''}`,
    issue: issue.number,
    now,
  }, { sanitize, categories, now, root });
  return finishDecisionTicket(storeDir, out.id, { issue, answer, ans }, sanitize);
}

function finishDecisionTicket(storeDir, id, { issue, answer, ans }, sanitize) {
  patchTicket(storeDir, id, {
    kind: 'decision', title: plain(issue.title), 'issue-url': issue.url,
    'decision-issue': issue.number, 'decision-comment': answer.id, 'decision-answer': ans.text,
    ...(ans.option ? { 'decision-option': ans.option.letter } : {}),
  }, { sanitize });
  return findTicket(storeDir, id);
}

// Poll: for every open decision issue with an owner answer and no ticket yet, create the ticket.
// Also writes the list of open decisions for the review panel. Returns the new tickets.
export function pollDecisions({ exec, repo = REPO, cwd, storeDir, queueDir, sanitize, categories = [], root, now = new Date() }) {
  const open = listOpenDecisions({ exec, repo, cwd });
  const fresh = [];
  const rows = [];
  for (const issue of open) {
    const r = exec('gh', ['api', `repos/${repo}/issues/${issue.number}/comments`, '--paginate'], { cwd });
    let comments = [];
    try { comments = r.status === 0 ? JSON.parse(r.stdout || '[]') : []; } catch { comments = []; }
    const had = listTickets(storeDir).some((t) => t.data['decision-issue'] === issue.number);
    const t = ticketFromAnswer(issue, comments, { storeDir, sanitize, categories, root, now });
    if (t) fresh.push(t);
    rows.push({ number: issue.number, title: plain(issue.title), url: issue.url, answered: Boolean(t) || had });
  }
  if (queueDir) { mkdirSync(queueDir, { recursive: true }); writeFileSync(resolve(queueDir, 'decisions.json'), `${JSON.stringify({ at: now.toISOString(), open: rows }, null, 2)}\n`); }
  return fresh;
}

export { ACCEPTED };
