// The feedback pipeline end to end against a temporary repository with a local bare origin, real git,
// and gh, npm and the agent stubbed. Nothing here reaches GitHub, and nothing is pushed anywhere but
// the temporary bare repository.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { AGENT_ARGS, AGENT_TOOLS, agentPrompt, buildContext, processQueue, realExec, runJob } from '../scripts/feedback-pipeline.mjs';
import { applySettingEdit } from '../scripts/lib/feedback-apply.mjs';
import { enqueue, jobFor, logFile, readQueue } from '../scripts/lib/feedback-queue.mjs';
import { addTicket, findTicket, loadCategories } from '../scripts/lib/review-store.mjs';
import { loadCopy } from '../scripts/lib/review-content.mjs';
import { ROOT } from '../scripts/lib/paths.mjs';

const sanitize = (text) => (text.includes('SECRETVALUE') ? { text: text.replace(/SECRETVALUE/g, '[REDACTED:test_shape]'), redacted: ['test_shape'] } : { text, redacted: [] });
const categories = loadCategories(ROOT);
const PNG = Buffer.from('89504e470d0a1a0a', 'hex');
const REPO = 'klappe-pm/GABF-Analysis';

// Git without the owner's global configuration, hooks or signing.
const emptyConfig = join(mkdtempSync(join(tmpdir(), 'gabf-gitcfg-')), 'config');
writeFileSync(emptyConfig, '');
Object.assign(process.env, { GIT_CONFIG_GLOBAL: emptyConfig, GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 'Test Owner', GIT_AUTHOR_EMAIL: 'owner@example.test', GIT_COMMITTER_NAME: 'Test Owner', GIT_COMMITTER_EMAIL: 'owner@example.test' });
const g = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' });

const FILTERS = '# Filters\n\n## `panel`\n\nWhere: the filter sheet.\n\n- `title`: Filter medals\n- `reset`: Reset\n';

// A "main checkout" cloned from a bare "origin", with the copy folder tracked.
function makeRepo() {
  const base = mkdtempSync(join(tmpdir(), 'gabf-pipe-'));
  const origin = join(base, 'origin.git');
  const root = join(base, 'root');
  g(base, 'init', '--bare', '-b', 'main', origin);
  g(base, 'clone', origin, root);
  g(root, 'checkout', '-b', 'main');
  mkdirSync(join(root, '.docs/content-management-system/global'), { recursive: true });
  writeFileSync(join(root, '.docs/content-management-system/global/filters.md'), FILTERS);
  writeFileSync(join(root, '.gitignore'), '.docs/feedback/\nnode_modules/\n');
  writeFileSync(join(root, 'README.md'), 'A fixture.\n');
  g(root, 'add', '-A');
  g(root, 'commit', '-m', 'Fixture');
  g(root, 'push', 'origin', 'main');
  return { base, origin, root, store: join(root, 'docs/feedback'), queue: join(base, 'queue') };
}

function contentTicket(r, extra = {}) {
  const key = loadCopy(join(r.root, '.docs/content-management-system')).find((e) => e.value === 'Filter medals').key;
  const out = addTicket(r.store, {
    page: 'overview-dashboard', step: 'S-01', state: 'overview-default', route: '/', text: 'The filter title should say what it filters.', categories: ['Content'],
    contentEdits: [{ key, file: '.docs/content-management-system/global/filters.md', old: 'Filter medals', new: 'Filter the medals', instances: [] }],
    images: [{ path: 'wi-001-page/page.png', kind: 'page', spot: null, component: null, url: null }],
    ...extra,
  }, { sanitize, categories, root: r.root });
  return out;
}
function placeImage(r, out) {
  const dir = join(r.store, 'overview-dashboard', out.file.split('/').pop().replace(/\.md$/, ''));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'page.png'), PNG);
  return dir;
}

// gh, npm and claude are stubbed; git is real. `calls` keeps every command for the assertions.
function stubs(r, { verifyFails = false, checksFail = false, agent = null } = {}) {
  const calls = [];
  const state = { issues: 0, prs: 0, bodies: {}, head: null, labels: [] };
  const ok = (stdout = '') => ({ status: 0, stdout, stderr: '' });
  const exec = (cmd, args, o = {}) => {
    calls.push([cmd, ...args]);
    if (cmd === 'gh') {
      const [a, b] = args;
      const val = (flag) => args[args.indexOf(flag) + 1];
      if (a === 'label' && b === 'list') return ok(JSON.stringify(state.labels.map((name) => ({ name }))));
      if (a === 'label' && b === 'create') { state.labels.push(args[2]); return ok(); }
      if (a === 'issue' && b === 'create') { state.issues += 1; state.bodies.issueCreate = readFileSync(val('--body-file'), 'utf8'); state.issueLabels = args.flatMap((x, i) => (x === '--label' ? [args[i + 1]] : [])); state.issueTitle = val('--title'); return ok(`https://github.com/${REPO}/issues/${40 + state.issues}\n`); }
      if (a === 'issue' && b === 'edit') { if (args.includes('--body-file')) state.bodies.issueEdit = readFileSync(val('--body-file'), 'utf8'); return ok(); }
      if (a === 'issue' && b === 'comment') { state.bodies.issueComment = readFileSync(val('--body-file'), 'utf8'); return ok(); }
      if (a === 'pr' && b === 'create') { state.prs += 1; state.head = val('--head'); state.bodies.pr = readFileSync(val('--body-file'), 'utf8'); return ok(`https://github.com/${REPO}/pull/${50 + state.prs}\n`); }
      // Auto-merge: turning it on merges nothing by itself. GitHub merges when the check passes, which
      // the stub does on the second look at the pull request; with a failing check it never merges.
      if (a === 'pr' && b === 'merge' && args.includes('--disable-auto')) { state.autoOff = true; return ok(); }
      if (a === 'pr' && b === 'merge') { state.autoMerge = args.includes('--auto'); return ok(); }
      if (a === 'pr' && b === 'view') {
        state.looks = (state.looks ?? 0) + 1;
        if (checksFail) return ok(JSON.stringify({ state: 'OPEN', mergeCommit: null, statusCheckRollup: [{ name: 'build', status: 'COMPLETED', conclusion: 'FAILURE' }] }));
        if (state.looks < 2) return ok(JSON.stringify({ state: 'OPEN', mergeCommit: null, statusCheckRollup: [{ name: 'build', status: 'IN_PROGRESS', conclusion: '' }] }));
        if (!state.merged) { g(r.origin, 'update-ref', 'refs/heads/main', `refs/heads/${state.head}`); g(r.origin, 'update-ref', '-d', `refs/heads/${state.head}`); state.merged = true; }
        return ok(JSON.stringify({ state: 'MERGED', mergeCommit: { oid: g(r.origin, 'rev-parse', 'main').trim() }, statusCheckRollup: [{ name: 'build', status: 'COMPLETED', conclusion: 'SUCCESS' }] }));
      }
      if (a === 'pr' && b === 'comment') { state.bodies.prComment = readFileSync(val('--body-file'), 'utf8'); return ok(); }
      if (a === 'api') { state.bodies.commitComment = readFileSync(args[args.indexOf('-F') + 1].replace(/^body=@/, ''), 'utf8'); return ok(); }
      throw new Error(`unstubbed gh call: ${args.join(' ')}`);
    }
    if (cmd === 'npm') return args.includes('verify') && verifyFails ? { status: 1, stdout: 'not ok 3 - something failed', stderr: '' } : ok();
    if (cmd === 'claude') throw new Error('the agent runs through ctx.agent in tests');
    return realExec(cmd, args, o);
  };
  const ctx = buildContext({ root: r.root, storeDir: r.store, queueDir: r.queue, workDir: join(r.root, '.docs/feedback/.work'), exec, sanitize, remotePattern: /origin\.git$/, sleep: async () => {}, pollMs: 0, checkRetries: 5, agent });
  return { ctx, calls, state };
}
const has = (calls, ...prefix) => calls.some((c) => prefix.every((p, i) => c[i] === p));

test('a content edit ticket goes from issue to merge to cleanup, with the ticket and images committed', async () => {
  const r = makeRepo();
  const out = contentTicket(r);
  placeImage(r, out);
  const { ctx, calls, state } = stubs(r);
  enqueue(r.queue, out.id);
  const [result] = await processQueue(ctx);

  assert.equal(result.ok, true, result.error);
  assert.equal(result.issue, 41);
  assert.equal(result.pr, 51);
  const branch = state.head;
  assert.match(branch, /^feedback\/wi-001-change-filter-medals-to-filter-the-medal/);

  // The issue came first, from the branch that already carried the ticket and the image.
  assert.equal(state.issueTitle, 'Change "Filter medals" to "Filter the medals"');
  assert.ok(state.issueLabels.includes('feedback') && state.issueLabels.includes('Content') && state.issueLabels.includes('page: Overview dashboard') && state.issueLabels.includes('kind: content') && state.issueLabels.includes('status: in progress'));
  assert.ok(state.bodies.issueCreate.includes(`/blob/${branch}/docs/feedback/overview-dashboard/`), 'images link to the ticket branch until the merge');
  assert.ok(state.bodies.issueEdit.includes('/blob/main/docs/feedback/overview-dashboard/'), 'after the merge the issue points at main');
  const order = calls.map((c) => c.slice(0, 3).join(' '));
  assert.ok(order.indexOf('git push -u') < order.indexOf('gh issue create'), 'the branch with the ticket is pushed before the issue is made');
  assert.ok(order.indexOf('gh issue create') < order.indexOf('gh pr create'));
  assert.ok(order.indexOf('git push origin feedback/wi-001-change-filter-medals-to-filter-the-medal') < order.indexOf('gh pr merge'), 'auto-merge goes on after the ticket record is pushed');
  assert.ok(has(calls, 'gh', 'pr', 'merge', '51', '-R', REPO, '--auto', '--merge', '--delete-branch'));
  assert.equal(state.autoMerge, true);
  assert.ok(state.looks >= 2, 'the pull request is polled until it is merged');
  assert.ok(calls.every((c) => c[0] !== 'gh' || c.includes('-R') || c[1] === 'api'), 'every gh call names the repository');

  // What merged: the copy change, the ticket with its issue and pull request, and the image.
  const copy = g(r.origin, 'show', 'main:.docs/content-management-system/global/filters.md');
  assert.ok(copy.includes('- `title`: Filter the medals') && copy.includes('- `reset`: Reset'));
  const tickets = g(r.origin, 'ls-tree', '-r', '--name-only', 'main', 'docs/feedback').trim().split('\n');
  assert.equal(tickets.filter((f) => f.endsWith('.md')).length, 1);
  assert.equal(tickets.filter((f) => f.endsWith('page.png')).length, 1);
  const merged = g(r.origin, 'show', `main:${tickets.find((f) => f.endsWith('.md'))}`);
  assert.match(merged, /^status: DONE$/m);
  assert.match(merged, /^issue: 41$/m);
  assert.match(merged, /^pr: 51$/m);
  assert.match(merged, /url: https:\/\/github\.com\/klappe-pm\/GABF-Analysis\/blob\/main\/docs\/feedback\/overview-dashboard\/.+\/page\.png\?raw=true/);

  // The commit message refers to the issue and credits no one.
  const log = g(r.origin, 'log', 'main', '--format=%B');
  assert.match(log, /Refs #41/);
  assert.ok(!/claude|session|co-authored/i.test(log), log);
  assert.match(state.bodies.pr, /^Closes #41/);

  // The handoff is on the pull request and on the merge commit.
  for (const k of ['prComment', 'commitComment']) for (const w of ['## session handoff', 'Delivered:', 'Gates:', 'Next:', 'Blocked:', 'Do not:', 'Open decisions:']) assert.ok(state.bodies[k].includes(w), `${k} lacks ${w}`);
  const edit = calls.find((c) => c[1] === 'issue' && c[2] === 'edit' && c.includes('--add-label'));
  assert.deepEqual([edit[3], edit.slice(-4)], ['41', ['--add-label', 'status: done', '--remove-label', 'status: in progress']]);

  // Cleanup, and the main checkout brought up to date because it was clean on main.
  assert.equal(existsSync(join(ctx.workDir, out.id)), false);
  assert.equal(g(r.root, 'branch', '--list', branch).trim(), '');
  assert.equal(jobFor(r.queue, out.id).state, 'merged');
  assert.equal(jobFor(r.queue, out.id).needsPull, undefined);
  assert.ok(readFileSync(join(r.root, '.docs/content-management-system/global/filters.md'), 'utf8').includes('Filter the medals'));
  assert.equal(findTicket(r.store, out.id).data.status, 'DONE');
  assert.equal(g(r.root, 'status', '--porcelain').trim(), '');
  const steps = readFileSync(logFile(r.queue), 'utf8').trim().split('\n').map((l) => JSON.parse(l).step);
  for (const s of ['queue', 'worktree', 'ticket-branch', 'labels', 'issue', 'apply', 'commit', 'verify', 'pull-request', 'checks', 'merge', 'handoff', 'cleanup', 'main']) assert.ok(steps.includes(s), `no log line for ${s}`);
});

test('the live edit the review server already made in the main checkout does not block the pull', async () => {
  const r = makeRepo();
  const out = contentTicket(r);
  const { ctx } = stubs(r);
  writeFileSync(join(r.root, '.docs/content-management-system/global/filters.md'), FILTERS.replace('Filter medals', 'Filter the medals'));
  enqueue(r.queue, out.id);
  const [result] = await processQueue(ctx);
  assert.equal(result.ok, true, result.error);
  assert.equal(jobFor(r.queue, out.id).needsPull, undefined);
  assert.equal(g(r.root, 'status', '--porcelain').trim(), '');
  assert.equal(g(r.root, 'rev-parse', 'HEAD'), g(r.origin, 'rev-parse', 'main'));
});

test('a local edit that was never committed asks for a pull instead of being overwritten', async () => {
  const r = makeRepo();
  const out = contentTicket(r);
  const { ctx, state } = stubs(r);
  writeFileSync(join(r.root, 'README.md'), 'A local edit.\n');
  enqueue(r.queue, out.id);
  const [result] = await processQueue(ctx);
  assert.equal(result.ok, true, result.error);
  assert.match(jobFor(r.queue, out.id).needsPull, /local changes/);
  assert.equal(readFileSync(join(r.root, 'README.md'), 'utf8'), 'A local edit.\n');
  assert.equal(state.prs, 1);
});

test('a failed verify comments on the issue, labels it, leaves the branch, and opens no pull request', async () => {
  const r = makeRepo();
  const out = contentTicket(r);
  const { ctx, state, calls } = stubs(r, { verifyFails: true });
  enqueue(r.queue, out.id);
  const [result] = await processQueue(ctx);
  assert.equal(result.ok, false);
  assert.equal(jobFor(r.queue, out.id).state, 'needs attention');
  assert.match(state.bodies.issueComment, /npm run verify failed/);
  assert.match(state.bodies.issueComment, /not ok 3/);
  assert.ok(calls.some((c) => c.includes('status: needs attention')));
  assert.equal(state.prs, 0);
  assert.ok(!has(calls, 'gh', 'pr', 'create'));
  assert.ok(existsSync(join(ctx.workDir, out.id)), 'the work is left for review');
  assert.equal(g(r.root, 'branch', '--list', 'feedback/*').trim().length > 0, true);
});

test('a failed check stops the job as needs attention, turns auto-merge off, and labels the issue', async () => {
  const r = makeRepo();
  const out = contentTicket(r);
  const { ctx, calls, state } = stubs(r, { checksFail: true });
  enqueue(r.queue, out.id);
  const [result] = await processQueue(ctx);
  assert.equal(result.ok, false);
  assert.match(result.error, /a check did not pass: build/);
  assert.ok(has(calls, 'gh', 'pr', 'merge', '51', '--disable-auto'));
  assert.equal(jobFor(r.queue, out.id).state, 'needs attention');
  assert.ok(calls.some((c) => c.includes('status: needs attention')));
  assert.ok(existsSync(join(ctx.workDir, out.id)), 'the branch is left for review');
});

test('a copy that has moved on since the ticket stops the job instead of guessing', async () => {
  const r = makeRepo();
  const out = contentTicket(r);
  writeFileSync(join(r.root, '.docs/content-management-system/global/filters.md'), FILTERS.replace('Filter medals', 'Narrow the medals'));
  g(r.root, 'commit', '-am', 'Someone else changed it');
  g(r.root, 'push', 'origin', 'main');
  const { ctx } = stubs(r);
  enqueue(r.queue, out.id);
  const [result] = await processQueue(ctx);
  assert.equal(result.ok, false);
  assert.match(result.error, /no longer reads "Filter medals"/);
});

test('a secret shaped value in a ticket is never sent', async () => {
  const r = makeRepo();
  const out = contentTicket(r);
  const file = findTicket(r.store, out.id).file;
  writeFileSync(file, readFileSync(file, 'utf8').replace('The filter title', 'The SECRETVALUE title'));
  const { ctx, calls } = stubs(r);
  enqueue(r.queue, out.id);
  const [result] = await processQueue(ctx);
  assert.equal(result.ok, false);
  assert.match(result.error, /shaped like a secret/);
  assert.ok(!calls.some((c) => c[0] === 'gh' && c[1] === 'issue' && c[2] === 'create'));
});

test('origin must be this repository', async () => {
  const r = makeRepo();
  const out = contentTicket(r);
  const { ctx, calls } = stubs(r);
  ctx.remotePattern = /github\.com\/klappe-pm\/GABF-Analysis/;
  enqueue(r.queue, out.id);
  const [result] = await processQueue(ctx);
  assert.equal(result.ok, false);
  assert.match(result.error, /the pipeline only touches klappe-pm\/GABF-Analysis/);
  assert.ok(!calls.some((c) => c[0] === 'gh'));
});

test('a design note with no mechanical edit goes to the agent, with the issue and the repo rules as the prompt', async () => {
  const r = makeRepo();
  const prompts = [];
  const agent = (prompt, wt) => { prompts.push(prompt); writeFileSync(join(wt, 'README.md'), 'A fixture, clearer.\n'); return { status: 0, stdout: '{}', stderr: '' }; };
  const out = addTicket(r.store, { page: 'overview-dashboard', step: 'S-01', route: '/', text: 'The fixture readme should be clearer.', categories: ['Content'] }, { sanitize, categories, root: r.root });
  const { ctx, state } = stubs(r, { agent });
  enqueue(r.queue, out.id);
  const [result] = await processQueue(ctx);
  assert.equal(result.ok, true, result.error);
  assert.ok(state.issueLabels.includes('kind: design'));
  assert.equal(prompts.length, 1);
  for (const w of ['The fixture readme should be clearer.', 'No dash is used as punctuation', 'Nothing credits an AI', 'npm run verify', 'Do not commit']) assert.ok(prompts[0].includes(w), w);
  assert.equal(g(r.origin, 'show', 'main:README.md'), 'A fixture, clearer.\n');
});

test('an agent that changes nothing stops the job', async () => {
  const r = makeRepo();
  const out = addTicket(r.store, { page: 'overview-dashboard', step: 'S-01', route: '/', text: 'Make it nicer.', categories: [] }, { sanitize, categories, root: r.root });
  const { ctx } = stubs(r, { agent: () => ({ status: 0, stdout: '{}', stderr: '' }) });
  enqueue(r.queue, out.id);
  const [result] = await processQueue(ctx);
  assert.equal(result.ok, false);
  assert.match(result.error, /no edit to commit/);
});

test('the agent is called with real flags only, none of which bypasses permissions', () => {
  const help = ['--allowedTools', '--permission-prompts', '--output-format', '--no-session-persistence', '--max-budget-usd', '-p'];
  for (const flag of AGENT_ARGS.filter((a) => a.startsWith('-'))) assert.ok(help.includes(flag), flag);
  assert.ok(!AGENT_ARGS.some((a) => /dangerously|bypass|skip-permissions|permission-mode/i.test(a)));
  assert.equal(AGENT_ARGS[AGENT_ARGS.indexOf('--permission-prompts') + 1], 'none');
  assert.ok(AGENT_TOOLS.includes('Bash(npm run verify)') && !/Bash\((git push|gh|curl|\*)/.test(AGENT_TOOLS));
  assert.match(agentPrompt('### Summary\n\nx'), /### Summary/);
});

// ---------- the dry run ----------

test('--dry-run prints the gh and git commands for a content edit ticket and runs none of them', async () => {
  const r = makeRepo();
  const out = contentTicket(r);
  const lines = [];
  const ctx = buildContext({ root: r.root, storeDir: r.store, dry: true, print: (l) => lines.push(l), sanitize });
  enqueue(ctx.queueDir, out.id);
  const before = g(r.root, 'worktree', 'list');
  const results = await processQueue(ctx);
  assert.equal(results[0].ok, true);
  const text = lines.map((l) => l.replace(/^\$ \(in [^)]*\) /, '$ ')).join('\n');
  for (const want of [
    '$ git fetch origin main',
    '$ git worktree add -b feedback/wi-001-change-filter-medals-to-filter-the-medal',
    `$ gh issue create -R ${REPO} --title "Change \\"Filter medals\\" to \\"Filter the medals\\"" --body-file`,
    '--label feedback --label Content --label "page: Overview dashboard" --label "kind: content" --label "status: in progress"',
    '$ git commit -m "Change \\"Filter medals\\" to \\"Filter the medals\\"" -m "Refs #1001"',
    '$ npm run verify',
    '$ git push -u origin feedback/wi-001-',
    `$ gh pr create -R ${REPO} --base main --head feedback/wi-001-`,
    `$ gh pr merge 1002 -R ${REPO} --auto --merge --delete-branch`,
    `$ gh pr view 1002 -R ${REPO} --json state,mergeCommit,statusCheckRollup`,
    '$ gh pr comment 1002',
    `$ gh api -X POST repos/${REPO}/commits/${'0'.repeat(40)}/comments`,
    '$ git worktree remove --force',
    '$ git branch -D feedback/wi-001-',
  ]) assert.ok(text.includes(want), `missing: ${want}\n${text}`);
  assert.equal(g(r.root, 'worktree', 'list'), before, 'nothing was created');
  assert.equal(existsSync(join(r.root, '.docs/feedback/.work')), false);
  assert.equal(readQueue(join(r.base, 'nonexistent')).jobs.length, 0);
  assert.deepEqual(g(r.origin, 'branch', '--list').split('\n').map((l) => l.replace('*', '').trim()).filter(Boolean), ['main'], 'origin has only main');
});

test('--dry-run for a design note prints the agent command with its flags', async () => {
  const r = makeRepo();
  const out = addTicket(r.store, { page: 'overview-dashboard', step: 'S-01', route: '/', text: 'Make the readme clearer.', categories: [] }, { sanitize, categories, root: r.root });
  const lines = [];
  const ctx = buildContext({ root: r.root, storeDir: r.store, dry: true, print: (l) => lines.push(l), sanitize });
  enqueue(ctx.queueDir, out.id);
  await processQueue(ctx);
  assert.ok(lines.some((l) => l.includes('$ (in ') && l.includes('claude -p --allowedTools') && l.includes('--permission-prompts none') && l.includes('--max-budget-usd 5')), lines.join('\n'));
});

// ---------- a ticket written by the design system Save ----------

test('a design system Save ticket with a setting edit and a component image runs the same way', async () => {
  const r = makeRepo();
  mkdirSync(join(r.root, '.design/design-system/components/button'), { recursive: true });
  writeFileSync(join(r.root, '.design/design-system/settings.md'), '---\nCorner shape: medium\nSeed color: "#4A8F3C"\n---\n\n# Settings\n');
  writeFileSync(join(r.root, '.design/design-system/components/button/spec.md'), '---\nname: button\nCorner shape: medium\n---\n\n- Corner shape: medium\n');
  g(r.root, 'add', '-A'); g(r.root, 'commit', '-m', 'Design system fixture'); g(r.root, 'push', 'origin', 'main');
  const dir = join(r.store, 'design-system');
  mkdirSync(join(dir, 'wi-002-corner'), { recursive: true });
  writeFileSync(join(dir, 'wi-002-corner', 'component.png'), PNG);
  writeFileSync(join(dir, 'wi-002-corner.md'), `---
id: WI-002
status: ACCEPTED
title: Design setting Corner shape changed from medium to large
page: design-system
step: null
components:
  - name: button
    spec: .design/design-system/components/button/spec.md
images:
  - path: wi-002-corner/component.png
    kind: component
    spot: null
    component: button
    url: null
setting-edits:
  - file: .design/design-system/components/button/spec.md
    key: Corner shape
    old: medium
    new: large
created: '2026-10-14T20:00:00.000Z'
revised: '2026-10-14T20:00:00.000Z'
---

Design setting Corner shape changed from medium to large in the button spec.

## images

- [Button after the change](wi-002-corner/component.png)
`);
  const { ctx, state, calls } = stubs(r);
  enqueue(r.queue, 'WI-002');
  const [result] = await processQueue(ctx);
  assert.equal(result.ok, true, result.error);
  assert.ok(state.issueLabels.includes('kind: setting') && state.issueLabels.includes('page: Design system'));
  assert.equal(state.issueTitle, 'Change Corner shape from medium to large');
  assert.match(state.bodies.issueCreate, /### Setting edits\n\nSetting `Corner shape` in `.design\/design-system\/components\/button\/spec.md`\n\n- Old: medium\n- New: large/);
  assert.match(state.bodies.issueCreate, /\[Button\]\(https:\/\/github.com\/klappe-pm\/GABF-Analysis\/blob\/main\/.design\/design-system\/components\/button\/spec.md\)/);
  assert.match(state.bodies.issueCreate, /Component, Button/);
  assert.equal(g(r.origin, 'show', 'main:.design/design-system/components/button/spec.md'), '---\nname: button\nCorner shape: large\n---\n\n- Corner shape: large\n');
  assert.equal(g(r.origin, 'show', 'main:.design/design-system/settings.md'), '---\nCorner shape: medium\nSeed color: "#4A8F3C"\n---\n\n# Settings\n', 'the other file is untouched');
  assert.ok(g(r.origin, 'ls-tree', '-r', '--name-only', 'main', 'docs/feedback').includes('component.png'));
  assert.ok(!calls.some((c) => c[0] === 'claude'));
});

// ---------- setting edits ----------

test('a setting edit changes only the value text, in JSON, YAML and CSS, and refuses a moved or ambiguous value', () => {
  const root = mkdtempSync(join(tmpdir(), 'gabf-setting-'));
  writeFileSync(join(root, 'tokens.json'), '{\n  "color": {\n    "brand": "#112233",\n    "text": "#000000"\n  },\n  "radius": 4\n}\n');
  writeFileSync(join(root, 'styles.css'), ':root {\n  --accent: #112233;\n  --gap: 8px;\n}\n');
  writeFileSync(join(root, 'spec.md'), '---\nsize: large\n---\n\nBody.\n');
  applySettingEdit(root, { file: 'tokens.json', key: 'color.brand', old: '#112233', new: '#334455' });
  assert.equal(readFileSync(join(root, 'tokens.json'), 'utf8'), '{\n  "color": {\n    "brand": "#334455",\n    "text": "#000000"\n  },\n  "radius": 4\n}\n');
  applySettingEdit(root, { file: 'tokens.json', key: 'radius', old: '4', new: '6' });
  assert.match(readFileSync(join(root, 'tokens.json'), 'utf8'), /"radius": 6\n/);
  applySettingEdit(root, { file: 'styles.css', key: '--accent', old: '#112233', new: '#abcdef' });
  assert.equal(readFileSync(join(root, 'styles.css'), 'utf8'), ':root {\n  --accent: #abcdef;\n  --gap: 8px;\n}\n');
  applySettingEdit(root, { file: 'spec.md', key: 'size', old: 'large', new: 'small' });
  assert.equal(readFileSync(join(root, 'spec.md'), 'utf8'), '---\nsize: small\n---\n\nBody.\n');
  assert.throws(() => applySettingEdit(root, { file: 'styles.css', key: '--gap', old: '9px', new: '10px' }), /cannot be applied as it stands/);
  assert.throws(() => applySettingEdit(root, { file: '../outside.json', key: 'a', old: '1', new: '2' }), /outside the repository/);
  writeFileSync(join(root, 'two.json'), '{ "a": { "size": 1 }, "b": { "size": 1 } }');
  assert.throws(() => applySettingEdit(root, { file: 'two.json', key: 'a.size', old: '1', new: '2' }), /appears 2 times/);
});

test('the pipeline never writes outside the ticket store, the work folder, the queue and the checkout it was given', async () => {
  const r = makeRepo();
  const out = contentTicket(r);
  const { ctx, calls } = stubs(r);
  enqueue(r.queue, out.id);
  await runJob(out.id, ctx);
  for (const c of calls.filter((x) => x[0] === 'git' && x[1] === 'push')) assert.ok(['-u', 'origin'].includes(c[2]) && (c[2] === 'origin' || c[3] === 'origin'), c.join(' '));
});
