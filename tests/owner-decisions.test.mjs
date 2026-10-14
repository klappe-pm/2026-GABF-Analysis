// Owner decisions: the form and the body agree, filing assigns to klappe-pm with the right labels,
// an open duplicate is not filed twice, only klappe-pm's own comments count as answers, an answer
// becomes a decision ticket, and that ticket runs through the pipeline against a temporary
// repository with gh stubbed.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
import { ROOT } from '../scripts/lib/paths.mjs';
import { AGENT_MARK, DECISION_LABEL, DECISION_SECTIONS, HOW_TO_ANSWER, OWNER, areaLabel, interpretAnswer, openDecision, optionsFromBody, ownerAnswers, parseOption, pollDecisions, renderDecisionBody, sectionsFromBody, ticketFromAnswer } from '../scripts/lib/owner-decisions.mjs';
import { buildContext, pollAndQueue, processQueue, realExec } from '../scripts/feedback-pipeline.mjs';
import { findTicket, listTickets, loadCategories } from '../scripts/lib/review-store.mjs';
import { jobFor, readQueue } from '../scripts/lib/feedback-queue.mjs';
import { repeated } from '../scripts/decisions.mjs';

const sanitize = (text) => (text.includes('SECRETVALUE') ? { text: text.replace(/SECRETVALUE/g, '[REDACTED:test_shape]'), redacted: ['test_shape'] } : { text, redacted: [] });
const REPO = 'klappe-pm/GABF-Analysis';
const ok = (stdout = '') => ({ status: 0, stdout, stderr: '' });
const scratch = () => mkdtempSync(join(tmpdir(), 'gabf-decide-'));

const input = () => ({
  question: 'Merge the four Coleman entities into one operation?',
  context: 'See the hop farms page (https://github.com/klappe-pm/GABF-Analysis/pull/36) and data/reference/hop-farms.csv.',
  options: ['Keep separate => no source links the four', 'Merge them => one operation with four sites'],
  recommend: 'A',
  blocks: 'The Coleman rows on the hop farms page.',
  area: 'data',
});

// A gh that remembers what it was asked and answers from a small state.
function fakeGh({ open = [], comments = {} } = {}) {
  const calls = [];
  const state = { labels: [], created: [], open, comments };
  const exec = (cmd, args) => {
    calls.push([cmd, ...args]);
    const [a, b] = args;
    const val = (flag) => args[args.indexOf(flag) + 1];
    if (a === 'label' && b === 'list') return ok(JSON.stringify(state.labels.map((name) => ({ name }))));
    if (a === 'label' && b === 'create') { state.labels.push(args[2]); return ok(); }
    if (a === 'issue' && b === 'list') return ok(JSON.stringify(state.open));
    if (a === 'issue' && b === 'create') { state.created.push({ title: val('--title'), body: readFileSync(val('--body-file'), 'utf8'), labels: args.flatMap((x, i) => (x === '--label' ? [args[i + 1]] : [])), assignee: val('--assignee') }); return ok(`https://github.com/${REPO}/issues/${60 + state.created.length}\n`); }
    if (a === 'api') { const n = /issues\/(\d+)\/comments/.exec(args[1])?.[1]; return ok(JSON.stringify(state.comments[n] ?? [])); }
    return ok();
  };
  return { exec, calls, state };
}

// ---------- the form and the body ----------

test('the owner decision form has the same fields as the rendered body, in order', () => {
  const form = parse(readFileSync(join(ROOT, '.github/ISSUE_TEMPLATE/owner-decision.yml'), 'utf8'));
  assert.deepEqual(form.body.filter((b) => b.type !== 'markdown').map((f) => f.attributes.label), DECISION_SECTIONS);
  assert.deepEqual(form.labels, [DECISION_LABEL]);
  assert.deepEqual(form.assignees, [OWNER]);
  assert.equal(form.body.find((f) => f.id === 'how-to-answer').attributes.value, HOW_TO_ANSWER);
});

test('the body has the question, context, lettered options with consequences, the recommendation, what is blocked, and how to answer', () => {
  const body = renderDecisionBody(input());
  assert.deepEqual([...body.matchAll(/^### (.+)$/gm)].map((m) => m[1]), DECISION_SECTIONS);
  assert.match(body, /- \*\*A\.\*\* Keep separate\. Consequence: no source links the four\./);
  assert.match(body, /- \*\*B\.\*\* Merge them\. Consequence: one operation with four sites\./);
  assert.match(body, /### Recommended option\n\nA\. Keep separate/);
  assert.match(body, /### What is blocked until it is answered\n\nThe Coleman rows/);
  assert.ok(body.includes(HOW_TO_ANSWER));
  assert.deepEqual(optionsFromBody(body).map((o) => [o.letter, o.text]), [['A', 'Keep separate'], ['B', 'Merge them']]);
  assert.equal(parseOption('Just words', 2).letter, 'C');
});

test('a recommendation can name several letters, and an empty field reads as the form leaves it', () => {
  const body = renderDecisionBody({ ...input(), options: ['One', 'Two', 'Three'], recommend: 'A plus C', context: '' });
  assert.match(body, /### Recommended option\n\nA\. One\nC\. Three/);
  assert.match(body, /### Context\n\n_No response_/);
});

test('the body has no dash used as punctuation, and the area label is plain words', () => {
  const body = renderDecisionBody({ ...input(), question: 'Show A - B?' });
  assert.ok(!/ - |--/.test(body.replace(/^- /gm, '')));
  assert.equal(areaLabel('Chart gallery'), 'area: chart gallery');
  assert.equal(areaLabel('hop-farms'), 'area: hop farms');
});

// ---------- filing ----------

test('filing creates the labels, assigns the issue to klappe-pm, and names the area', () => {
  const gh = fakeGh();
  const q = scratch();
  const r = openDecision(input(), { exec: gh.exec, queueDir: q, sanitize });
  assert.equal(r.created, true);
  assert.equal(r.number, 61);
  assert.deepEqual(gh.state.labels, [DECISION_LABEL, 'area: data']);
  const made = gh.state.created[0];
  assert.equal(made.assignee, 'klappe-pm');
  assert.deepEqual(made.labels, [DECISION_LABEL, 'area: data']);
  assert.equal(made.title, 'Merge the four Coleman entities into one operation?');
  assert.deepEqual([...made.body.matchAll(/^### (.+)$/gm)].map((m) => m[1]), DECISION_SECTIONS);
  assert.ok(gh.calls.every((c) => c[0] !== 'gh' || c.includes('-R')), 'every gh call names the repository');
});

test('an open issue that asks the same question is returned instead of a second', () => {
  const body = renderDecisionBody(input());
  const gh = fakeGh({ open: [{ number: 12, title: 'Merge the four Coleman entities into one operation?', body, url: `https://github.com/${REPO}/issues/12` }] });
  const r = openDecision({ ...input(), question: 'merge the four coleman entities into one operation' }, { exec: gh.exec, queueDir: scratch(), sanitize });
  assert.deepEqual(r, { created: false, number: 12, url: `https://github.com/${REPO}/issues/12` });
  assert.equal(gh.state.created.length, 0);
});

test('a decision that holds a secret shaped value is refused before anything is sent', () => {
  const gh = fakeGh();
  assert.throws(() => openDecision({ ...input(), context: 'token SECRETVALUE' }, { exec: gh.exec, queueDir: scratch(), sanitize }), /shaped like a secret/);
  assert.equal(gh.calls.length, 0);
});

test('a decision needs a question and an option', () => {
  const gh = fakeGh();
  assert.throws(() => openDecision({ ...input(), question: '' }, { exec: gh.exec, queueDir: scratch() }), /needs a question/);
  assert.throws(() => openDecision({ ...input(), options: [] }, { exec: gh.exec, queueDir: scratch() }), /at least one option/);
});

test('the command line collects every --option', () => {
  assert.deepEqual(repeated(['open', '--option', 'a => b', '--recommend', 'A', '--option', 'c'], 'option'), ['a => b', 'c']);
});

// ---------- answers ----------

const comment = (id, login, body) => ({ id, user: { login }, body });

test('only comments by klappe-pm count, and a pipeline comment posted through that login does not', () => {
  const list = [comment(1, 'someone-else', 'B'), comment(2, 'klappe-pm', `${AGENT_MARK}\n## session handoff`), comment(3, 'klappe-pm', 'A, keep them apart'), comment(4, 'klappe-pm', '   '), comment(5, 'KLAPPE-PM', 'B')];
  assert.deepEqual(ownerAnswers(list).map((c) => c.id), [3]);
  assert.deepEqual(ownerAnswers([comment(1, 'someone-else', 'A'), comment(2, 'github-actions[bot]', 'A')]), []);
});

test('an answer names an option by its letter or is free text', () => {
  const options = optionsFromBody(renderDecisionBody(input()));
  assert.equal(interpretAnswer('B', options).option.text, 'Merge them');
  assert.equal(interpretAnswer('A, because nothing links them.', options).option.letter, 'A');
  assert.equal(interpretAnswer('Neither, ask the breweries.', options).option, null);
});

const issue = (extra = {}) => ({ number: 12, title: 'Merge the four Coleman entities into one operation?', body: renderDecisionBody(input()), url: `https://github.com/${REPO}/issues/12`, ...extra });

test('the owner answer becomes an ACCEPTED decision ticket under docs/feedback/decisions, once', () => {
  const store = scratch();
  const t = ticketFromAnswer(issue(), [comment(9, 'klappe-pm', 'A, keep them separate')], { storeDir: store, sanitize, categories: loadCategories(ROOT), root: ROOT });
  assert.equal(t.page, 'decisions');
  assert.match(t.rel, /^decisions\/wi-001-.+\.md$/);
  assert.equal(t.data.status, 'ACCEPTED');
  assert.equal(t.data.kind, 'decision');
  assert.equal(t.data.issue, 12);
  assert.equal(t.data['decision-issue'], 12);
  assert.equal(t.data['decision-option'], 'A');
  assert.equal(t.data['decision-answer'], 'A, keep them separate');
  assert.match(t.body, /Chosen option: A\. Keep separate/);
  assert.match(t.body, /## decision\n\nQuestion: Merge the four Coleman entities/);
  assert.equal(ticketFromAnswer(issue(), [comment(9, 'klappe-pm', 'A')], { storeDir: store, sanitize, categories: [], root: ROOT }), null, 'a second look at the same issue makes no second ticket');
  assert.equal(listTickets(store).length, 1);
});

test('no owner answer, no ticket', () => {
  const store = scratch();
  assert.equal(ticketFromAnswer(issue(), [comment(1, 'someone-else', 'A'), comment(2, 'klappe-pm', `${AGENT_MARK}\nrecorded`)], { storeDir: store, sanitize, categories: [], root: ROOT }), null);
  assert.deepEqual(listTickets(store), []);
});

test('polling lists the open decisions for the panel and queues a ticket for each new answer', () => {
  const store = scratch();
  const q = scratch();
  const gh = fakeGh({ open: [issue(), issue({ number: 13, title: 'Another question?', url: `https://github.com/${REPO}/issues/13` })], comments: { 12: [comment(9, 'klappe-pm', 'B')], 13: [comment(1, 'someone-else', 'A')] } });
  const ctx = buildContext({ root: ROOT, storeDir: store, queueDir: q, exec: gh.exec, sanitize });
  const fresh = pollAndQueue(ctx, loadCategories(ROOT));
  assert.deepEqual(fresh.map((t) => t.data['decision-issue']), [12]);
  assert.deepEqual(readQueue(q).jobs.map((j) => [j.id, j.state]), [['WI-001', 'queued']]);
  const shown = JSON.parse(readFileSync(join(q, 'decisions.json'), 'utf8')).open;
  assert.deepEqual(shown.map((d) => [d.number, d.answered]), [[12, true], [13, false]]);
  assert.equal(pollAndQueue(ctx, []).length, 0, 'polling again changes nothing');
  assert.equal(readQueue(q).jobs.length, 1);
});

// ---------- an answer through the pipeline ----------

const g = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' });
const emptyConfig = join(scratch(), 'config');
writeFileSync(emptyConfig, '');
Object.assign(process.env, { GIT_CONFIG_GLOBAL: emptyConfig, GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 'Test Owner', GIT_AUTHOR_EMAIL: 'owner@example.test', GIT_COMMITTER_NAME: 'Test Owner', GIT_COMMITTER_EMAIL: 'owner@example.test' });

function makeRepo() {
  const base = scratch();
  const origin = join(base, 'origin.git');
  const root = join(base, 'root');
  g(base, 'init', '--bare', '-b', 'main', origin);
  g(base, 'clone', origin, root);
  g(root, 'checkout', '-b', 'main');
  writeFileSync(join(root, '.gitignore'), '.docs/feedback/\nnode_modules/\n');
  writeFileSync(join(root, 'README.md'), 'A fixture.\n');
  g(root, 'add', '-A'); g(root, 'commit', '-m', 'Fixture'); g(root, 'push', 'origin', 'main');
  return { base, origin, root, store: join(root, 'docs/feedback'), queue: join(base, 'queue') };
}

function pipelineGh(r) {
  const calls = [];
  const bodies = {};
  const state = { prs: 0, head: null };
  const exec = (cmd, args, o = {}) => {
    calls.push([cmd, ...args]);
    if (cmd === 'npm') return ok();
    if (cmd !== 'gh') return realExec(cmd, args, o);
    const [a, b] = args;
    const val = (flag) => args[args.indexOf(flag) + 1];
    if (a === 'label' && b === 'list') return ok('[]');
    if (a === 'label' && b === 'create') return ok();
    if (a === 'issue' && b === 'edit') return ok();
    if (a === 'issue' && b === 'comment') { bodies.issueComment = readFileSync(val('--body-file'), 'utf8'); return ok(); }
    if (a === 'pr' && b === 'create') { state.prs += 1; state.head = val('--head'); bodies.pr = readFileSync(val('--body-file'), 'utf8'); return ok(`https://github.com/${REPO}/pull/${70 + state.prs}\n`); }
    if (a === 'pr' && b === 'checks') return ok();
    if (a === 'pr' && b === 'merge') { g(r.origin, 'update-ref', 'refs/heads/main', `refs/heads/${state.head}`); return ok(); }
    if (a === 'pr' && b === 'view') return ok(JSON.stringify({ state: 'MERGED', mergeCommit: { oid: g(r.origin, 'rev-parse', 'main').trim() } }));
    if (a === 'pr' && b === 'comment') { bodies.prComment = readFileSync(val('--body-file'), 'utf8'); return ok(); }
    if (a === 'api') return ok();
    throw new Error(`unstubbed gh call: ${args.join(' ')}`);
  };
  return { exec, calls, bodies, state };
}

async function runAnswer(answer, agent) {
  const r = makeRepo();
  const t = ticketFromAnswer(issue(), [comment(9, 'klappe-pm', answer)], { storeDir: r.store, sanitize, categories: [], root: r.root });
  const gh = pipelineGh(r);
  const ctx = buildContext({ root: r.root, storeDir: r.store, queueDir: r.queue, exec: gh.exec, sanitize, remotePattern: /origin\.git$/, sleep: async () => {}, agent });
  const { enqueue } = await import('../scripts/lib/feedback-queue.mjs');
  enqueue(r.queue, t.id);
  const [result] = await processQueue(ctx);
  return { r, t, gh, result };
}

test('an answer that needs a change runs the agent, opens a pull request that closes the decision issue, and makes no new issue', async () => {
  const prompts = [];
  const { r, t, gh, result } = await runAnswer('B', (prompt, wt) => { prompts.push(prompt); writeFileSync(join(wt, 'README.md'), 'A fixture with the four merged.\n'); return ok('{}'); });
  assert.equal(result.ok, true, result.error);
  assert.ok(!gh.calls.some((c) => c[1] === 'issue' && c[2] === 'create'), 'the decision issue is reused');
  assert.match(gh.bodies.pr, /^Closes #12/);
  assert.match(prompts[0], /answered a question/);
  assert.match(prompts[0], /Chosen option: B\. Merge them/);
  assert.match(prompts[0], /If the answer needs no change to the repository, change nothing/);
  assert.equal(g(r.origin, 'show', 'main:README.md'), 'A fixture with the four merged.\n');
  const merged = g(r.origin, 'show', `main:docs/feedback/decisions/${t.rel.split('/').pop()}`);
  assert.match(merged, /^status: DONE$/m);
  assert.match(merged, /^decision-issue: 12$/m);
  assert.ok(gh.calls.some((c) => c.includes('--remove-label') && c.includes(DECISION_LABEL) && c.includes('status: done')));
  assert.ok(gh.bodies.issueComment.startsWith(AGENT_MARK), 'the pipeline comment is marked so it is never read as an answer');
  assert.ok(gh.bodies.prComment.startsWith(AGENT_MARK));
  assert.equal(jobFor(r.queue, t.id).state, 'merged');
});

test('an answer that needs no change is recorded in the ticket, with no verify run, and closes the issue through the pull request', async () => {
  const { r, t, gh, result } = await runAnswer('A', () => ok('{}'));
  assert.equal(result.ok, true, result.error);
  assert.ok(!gh.calls.some((c) => c[0] === 'npm' && c.includes('verify')), 'nothing to verify');
  assert.equal(g(r.origin, 'show', 'main:README.md'), 'A fixture.\n');
  assert.ok(g(r.origin, 'ls-tree', '-r', '--name-only', 'main', 'docs/feedback/decisions').includes('wi-001'));
  assert.match(gh.bodies.pr, /^Closes #12/);
  assert.match(gh.bodies.issueComment, /needed no change to the repository/);
  assert.equal(findTicket(r.store, t.id).data.status, 'DONE');
});
