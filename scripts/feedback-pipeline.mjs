#!/usr/bin/env node
// The feedback pipeline. A saved ticket becomes a GitHub issue, a branch, a pull request, a merge
// and a handoff, one ticket at a time, following the repository's own practice:
//
//   branch from origin/main, ticket and images committed first, issue opened with the images
//   linked from that branch, the change applied, commit with "Refs #n", npm run verify, push,
//   pull request with "Closes #n", watch the checks, merge only when they pass, session handoff
//   on the pull request and on the merge commit, then clean up.
//
//   node scripts/feedback-pipeline.mjs [process] [WI-001 ...] [--scan] [--dry-run]
//
// It runs automatically when the review server registers a ticket (or the watcher sees one),
// unless GABF_FEEDBACK_PIPELINE=off. `npm run tickets -- process` runs the queue by hand. With
// --dry-run it prints the gh and git commands it would run and runs none of them.
//
// It only ever touches klappe-pm/GABF-Analysis: every gh call names it, and the origin remote is
// checked before any work starts. Every string that leaves in an issue, commit or pull request goes
// through the secret scan first.

import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { basename, dirname, resolve } from 'node:path';
import { ROOT, parseArgs } from './lib/paths.mjs';
import { applyRecordedContentEdit, applySettingEdit } from './lib/feedback-apply.mjs';
import { FEEDBACK_LABEL, REPO, STATUS_LABELS, imageUrl, issueTitle, kindOf, labelSpec, labelsFor, noteOf, plain, renderIssueBody } from './lib/feedback-issue.mjs';
import { appendLog, enqueue, jobFor, nextJob, queueDirOf, scanStore, takeLock, updateJob } from './lib/feedback-queue.mjs';
import { FEEDBACK_DIR, LOCAL_FEEDBACK_DIR, feedbackDirOf, findTicket, migrateLegacyStore, patchTicket, sanitizeDeep } from './lib/review-store.mjs';
import { kebab } from './lib/review-screens.mjs';

export class NeedsAttention extends Error {}

// What the headless agent may use. Real flags only; nothing here bypasses a permission or a guard.
export const AGENT_TOOLS = 'Read,Edit,Write,Glob,Grep,Bash(npm run verify),Bash(git status),Bash(git diff *)';
export const AGENT_ARGS = ['-p', '--allowedTools', AGENT_TOOLS, '--permission-prompts', 'none', '--output-format', 'json', '--no-session-persistence', '--max-budget-usd', '5'];

// ---------- running commands ----------

export function realExec(cmd, args, { cwd, input, timeout } = {}) {
  const r = spawnSync(cmd, args, { cwd, input, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout });
  return { status: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? (r.error ? String(r.error.message) : '') };
}

const quote = (a) => (/^[\w@%+=:,./~-]+$/.test(a) ? a : JSON.stringify(a));

// Dry run: print the command, run nothing, and answer the way a successful call would.
export function dryExec(repo, print = console.log) {
  return (cmd, args, { cwd } = {}) => {
    print(`$ ${cwd ? `(in ${cwd}) ` : ''}${cmd} ${args.map(quote).join(' ')}`);
    const a = args.join(' ');
    let stdout = '';
    if (cmd === 'gh' && a.startsWith('issue create')) stdout = `https://github.com/${repo}/issues/1001\n`;
    else if (cmd === 'gh' && a.startsWith('pr create')) stdout = `https://github.com/${repo}/pull/1002\n`;
    else if (cmd === 'gh' && a.startsWith('pr view')) stdout = JSON.stringify({ state: 'MERGED', mergeCommit: { oid: '0'.repeat(40) } });
    else if (cmd === 'gh' && a.startsWith('label list')) stdout = '[]';
    else if (cmd === 'git' && a.includes('remote get-url')) stdout = `https://github.com/${repo}.git\n`;
    else if (cmd === 'git' && a.includes('rev-parse --abbrev-ref')) stdout = 'main\n';
    const status = cmd === 'git' && a.includes('diff --cached --quiet') ? 1 : 0;
    return { status, stdout, stderr: '' };
  };
}

// ---------- the context ----------

export function buildContext(opts = {}) {
  const root = opts.root ?? ROOT;
  const env = opts.env ?? process.env;
  const dry = Boolean(opts.dry);
  const repo = opts.repo ?? REPO;
  const print = opts.print ?? console.log;
  // A dry run keeps its queue in a throwaway folder so it never touches the real one.
  const queueDir = opts.queueDir ?? (dry ? mkdtempSync(resolve(tmpdir(), 'gabf-dry-queue-')) : queueDirOf(root, env));
  const ctx = {
    root, env, dry, repo, queueDir,
    storeDir: opts.storeDir ?? feedbackDirOf(root, env),
    workDir: opts.workDir ?? resolve(root, LOCAL_FEEDBACK_DIR, '.work'),
    exec: opts.exec ?? (dry ? dryExec(repo, print) : realExec),
    sanitize: opts.sanitize,
    sleep: opts.sleep ?? ((ms) => new Promise((done) => setTimeout(done, ms))),
    remotePattern: opts.remotePattern ?? new RegExp(`github\\.com[:/]${repo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\.git)?$`, 'i'),
    verifyCommand: opts.verifyCommand ?? ['npm', ['run', 'verify']],
    checkRetries: opts.checkRetries ?? 20,
    agent: opts.agent ?? null,
    print,
    now: opts.now ?? (() => new Date()),
  };
  return ctx;
}

async function withSanitizer(ctx) {
  if (ctx.sanitize) return;
  const { engine } = await import('./lib/agent-graph.mjs');
  ctx.sanitize = (await engine('design-feedback.mjs')).sanitize;
}

// ---------- small helpers ----------

const sha = (file) => (existsSync(file) ? createHash('sha256').update(readFileSync(file)).digest('hex') : null);
const git = (ctx, cwd, ...args) => ctx.exec('git', args, { cwd });
const gh = (ctx, ...args) => ctx.exec('gh', args, { cwd: ctx.root });

function must(r, what) {
  if (r.status !== 0) throw new NeedsAttention(`${what} failed: ${(r.stderr || r.stdout).trim().split('\n').slice(-3).join(' ')}`);
  return r.stdout;
}

// Text that reaches GitHub from a ticket must pass the secret scan untouched, or the job stops.
function guard(ctx, text, what) {
  const clean = ctx.sanitize(String(text));
  if (clean.redacted.length) throw new NeedsAttention(`${what} holds a value shaped like a secret (${clean.redacted.join(', ')}); nothing was sent`);
  return String(text);
}
// Text we generate from command output is redacted instead, because it was never the owner's words.
const scrub = (ctx, text) => ctx.sanitize(String(text)).text;

function step(ctx, id, name, detail = '') {
  appendLog(ctx.queueDir, { id, step: name, status: 'ok', ...(detail ? { detail: String(detail).slice(0, 300) } : {}) }, ctx.now());
  ctx.print(`${id} ${name}${detail ? `: ${String(detail).slice(0, 120)}` : ''}`);
}

function bodyFile(ctx, id, name, text) {
  const file = resolve(ctx.queueDir, `${id.toLowerCase()}-${name}.md`);
  if (!ctx.dry) { mkdirSync(ctx.queueDir, { recursive: true }); writeFileSync(file, text); }
  return file;
}

// ---------- the job ----------

function ticketPaths(ctx, t) {
  const base = basename(t.rel, '.md');
  return { page: t.page, file: t.rel, dir: `${t.page}/${base}`, localFile: t.file, localImages: resolve(ctx.storeDir, t.page, base) };
}

function ensureLabels(ctx, id, labels) {
  const have = new Set((() => { try { return JSON.parse(must(gh(ctx, 'label', 'list', '-R', ctx.repo, '--json', 'name', '--limit', '500'), 'listing labels')); } catch (e) { if (e instanceof NeedsAttention) throw e; return []; } })().map((l) => l.name.toLowerCase()));
  for (const name of labels) {
    if (have.has(name.toLowerCase())) continue;
    const spec = labelSpec(name);
    must(gh(ctx, 'label', 'create', spec.name, '-R', ctx.repo, '--color', spec.color, '--description', spec.description), `creating the label ${name}`);
  }
  step(ctx, id, 'labels', labels.join(', '));
}

function applyChange(ctx, id, ticket, wt) {
  const d = ticket.data;
  const contentEdits = d['content-edits'] ?? [];
  const settingEdits = d['setting-edits'] ?? [];
  if (contentEdits.length || settingEdits.length) {
    if (ctx.dry) { step(ctx, id, 'apply', `would reapply ${contentEdits.length} copy edit(s) and ${settingEdits.length} setting edit(s)`); return; }
    try {
      for (const e of contentEdits) applyRecordedContentEdit(wt, e, { sanitize: ctx.sanitize });
      for (const e of settingEdits) applySettingEdit(wt, e);
    } catch (error) { throw new NeedsAttention(error.message); }
    step(ctx, id, 'apply', `${contentEdits.length} copy edit(s), ${settingEdits.length} setting edit(s)`);
    return;
  }
  return 'agent';
}

export function agentPrompt(issueBody) {
  return `You are making one change to this repository, described by the issue below. Work only inside this checkout.

${issueBody}

Rules for this repository:
- No dash is used as punctuation anywhere, including code comments. Use commas, colons, periods or parentheses, and write ranges as "3 to 5".
- Nothing credits an AI model, assistant or tool, in any file, comment or message.
- Visible copy is plain words, one line per paragraph in Markdown, with no data slugs shown as words.
- Change only what the issue asks for. Generated files are rebuilt, not hand edited.
- Do not commit, push, or open anything. The pipeline commits for you.
- Run npm run verify when you are done and fix what it reports.
`;
}

async function runAgent(ctx, id, issueBody, wt) {
  if (ctx.dry) {
    ctx.exec('claude', AGENT_ARGS, { cwd: wt });
    step(ctx, id, 'apply', 'would invoke the agent with the issue as the prompt');
    return;
  }
  const run = ctx.agent ?? ((prompt) => ctx.exec('claude', AGENT_ARGS, { cwd: wt, input: prompt, timeout: 45 * 60 * 1000 }));
  const r = await run(agentPrompt(issueBody), wt);
  if (r.status !== 0) throw new NeedsAttention(`the agent step failed: ${scrub(ctx, (r.stderr || r.stdout).trim().split('\n').slice(-3).join(' '))}`);
  step(ctx, id, 'apply', 'the agent finished');
}

function fastForward(ctx, id, own, localHash) {
  must(git(ctx, ctx.root, 'fetch', 'origin', 'main'), 'fetching main');
  const branch = git(ctx, ctx.root, 'rev-parse', '--abbrev-ref', 'HEAD').stdout.trim();
  if (branch !== 'main') return 'the main checkout is not on main; it needs a pull';
  // The ticket and its images were committed by the pull request; the local copies are discarded
  // only when nobody has touched them since the pipeline last wrote them.
  if (!ctx.dry && own && sha(own.localFile) === localHash) {
    rmSync(own.localFile, { force: true });
    rmSync(own.localImages, { recursive: true, force: true });
  }
  const dirty = git(ctx, ctx.root, 'status', '--porcelain').stdout.trim();
  if (dirty && !ctx.dry) return 'the main checkout has local changes; it needs a pull';
  must(git(ctx, ctx.root, 'merge', '--ff-only', 'origin/main'), 'fast-forwarding main');
  return null;
}

export async function runJob(id, ctx) {
  await withSanitizer(ctx);
  const storeRel = FEEDBACK_DIR;
  const t = findTicket(ctx.storeDir, id);
  let issue = null;
  let wt = null;
  let branch = null;
  try {
    if (!t) throw new NeedsAttention(`there is no ticket ${id}`);
    const own = ticketPaths(ctx, t);
    const remote = git(ctx, ctx.root, 'remote', 'get-url', 'origin').stdout.trim();
    if (!ctx.remotePattern.test(remote)) throw new NeedsAttention(`origin is ${remote}, not ${ctx.repo}; the pipeline only touches ${ctx.repo}`);
    const found = sanitizeDeep({ data: t.data, body: t.body }, ctx.sanitize).redacted;
    if (found.size) throw new NeedsAttention(`the ticket holds a value shaped like a secret (${[...found].join(', ')}); nothing was sent`);

    must(git(ctx, ctx.root, 'fetch', 'origin', 'main'), 'fetching main');
    const title = guard(ctx, issueTitle(t), 'the title');
    branch = `feedback/${t.id.toLowerCase()}-${kebab(title).slice(0, 40).replace(/-+$/, '') || 'change'}`;
    wt = resolve(ctx.workDir, t.id);
    const wtStore = resolve(wt, storeRel);
    let localHash = sha(own.localFile);

    // The worktree, with the ticket and its images placed where the pull request will carry them.
    if (!existsSync(wt) || ctx.dry) {
      const added = git(ctx, ctx.root, 'worktree', 'add', '-b', branch, wt, 'origin/main');
      if (added.status !== 0) must(git(ctx, ctx.root, 'worktree', 'add', wt, branch), 'creating the worktree');
    }
    step(ctx, id, 'worktree', branch);
    const patchBoth = (fields) => {
      if (ctx.dry) return;
      patchTicket(ctx.storeDir, id, fields, { sanitize: ctx.sanitize });
      localHash = sha(own.localFile);
      if (existsSync(resolve(wtStore, own.file))) patchTicket(wtStore, id, fields, { sanitize: ctx.sanitize });
    };
    if (!ctx.dry) {
      mkdirSync(resolve(wtStore, t.page), { recursive: true });
      cpSync(own.localFile, resolve(wtStore, own.file));
      if (existsSync(own.localImages)) cpSync(own.localImages, resolve(wtStore, own.dir), { recursive: true });
    }
    // The recorded image urls are the ones that work once the pull request is merged.
    const images = (t.data.images ?? []).map((i) => ({ ...i, url: imageUrl(t.page, i, 'main', ctx.repo) }));
    if (images.length) patchBoth({ images });
    const live = () => findTicket(ctx.storeDir, id) ?? t;

    // Ticket and images first, on the ticket's branch, so the issue can link them.
    git(ctx, wt, 'add', '--', `${storeRel}/${own.file}`, `${storeRel}/${own.dir}`);
    let ref = 'main';
    if (git(ctx, wt, 'diff', '--cached', '--quiet').status !== 0) {
      must(git(ctx, wt, 'commit', '-m', `Add feedback ticket ${t.id}`), 'committing the ticket');
      must(git(ctx, wt, 'push', '-u', 'origin', branch), 'pushing the ticket branch');
      ref = branch;
      step(ctx, id, 'ticket-branch', 'ticket and images pushed');
    }

    // The issue.
    const labels = [...labelsFor(t.data), STATUS_LABELS.progress];
    ensureLabels(ctx, id, [FEEDBACK_LABEL, ...labels.filter((l) => l !== FEEDBACK_LABEL), STATUS_LABELS.done, STATUS_LABELS.attention]);
    const issueBody = guard(ctx, renderIssueBody(ctx.dry ? t : live(), { ref, repo: ctx.repo }), 'the issue body');
    const created = must(gh(ctx, 'issue', 'create', '-R', ctx.repo, '--title', title, '--body-file', bodyFile(ctx, id, 'issue', issueBody), ...labels.flatMap((l) => ['--label', l])), 'creating the issue').trim();
    const number = Number(/\/issues\/(\d+)/.exec(created)?.[1]);
    if (!number) throw new NeedsAttention(`gh did not return an issue number: ${created.slice(0, 80)}`);
    issue = number;
    patchBoth({ issue: number, 'issue-url': created });
    updateJob(ctx.queueDir, id, { state: 'issue', issue: number, issueUrl: created, branch }, ctx.now());
    step(ctx, id, 'issue', `#${number} ${created}`);

    // The change.
    updateJob(ctx.queueDir, id, { state: 'in progress' }, ctx.now());
    const needsAgent = applyChange(ctx, id, t, wt) === 'agent';
    if (needsAgent) await runAgent(ctx, id, issueBody, wt);
    if (!ctx.dry) {
      const changed = git(ctx, wt, 'status', '--porcelain').stdout.trim();
      if (!changed.split('\n').some((l) => l.trim() && !l.includes(`${storeRel}/`))) throw new NeedsAttention('the change produced no edit to commit');
    }

    // Commit with the issue reference. The message and the diff both pass the secret scan.
    git(ctx, wt, 'add', '-A');
    const diff = git(ctx, wt, 'diff', '--cached').stdout;
    const found2 = ctx.sanitize(diff).redacted;
    if (found2.length) throw new NeedsAttention(`the change holds a value shaped like a secret (${found2.join(', ')}); nothing was committed`);
    must(git(ctx, wt, 'commit', '-m', title, '-m', `Refs #${number}`), 'committing the change');
    step(ctx, id, 'commit', title);

    // The gates.
    if (!ctx.dry && !existsSync(resolve(wt, 'node_modules'))) must(ctx.exec('npm', ['ci'], { cwd: wt }), 'npm ci');
    const [vcmd, vargs] = ctx.verifyCommand;
    const verified = ctx.exec(vcmd, vargs, { cwd: wt });
    if (verified.status !== 0) {
      const tail = scrub(ctx, `${verified.stdout}\n${verified.stderr}`.trim().split('\n').slice(-40).join('\n'));
      throw new NeedsAttention(`npm run verify failed\n\n${tail}`);
    }
    step(ctx, id, 'verify', 'passed');
    if (git(ctx, wt, 'status', '--porcelain').stdout.trim()) {
      git(ctx, wt, 'add', '-A');
      must(git(ctx, wt, 'commit', '--amend', '--no-edit'), 'folding in the rebuilt files');
      step(ctx, id, 'rebuild', 'generated files folded into the commit');
    }

    // The pull request.
    must(git(ctx, wt, 'push', '-u', 'origin', branch), 'pushing the branch');
    const prBody = guard(ctx, `Closes #${number}\n\n${noteOf(t) || title}\n\nThe ticket ${t.id} and its captured images are in this change.\n`, 'the pull request body');
    const prUrl = must(gh(ctx, 'pr', 'create', '-R', ctx.repo, '--base', 'main', '--head', branch, '--title', title, '--body-file', bodyFile(ctx, id, 'pr', prBody)), 'opening the pull request').trim();
    const pr = Number(/\/pull\/(\d+)/.exec(prUrl)?.[1]);
    if (!pr) throw new NeedsAttention(`gh did not return a pull request number: ${prUrl.slice(0, 80)}`);
    updateJob(ctx.queueDir, id, { state: 'pr', pr, prUrl }, ctx.now());
    step(ctx, id, 'pull-request', `#${pr} ${prUrl}`);

    // The merged ticket records its pull request and is DONE; this lands with the merge.
    if (!ctx.dry) {
      patchTicket(wtStore, id, { status: 'DONE', pr, 'pr-url': prUrl, resolution: { status: 'DONE', change: `pull request #${pr}`, note: 'Delivered by the feedback pipeline.', at: ctx.now().toISOString() } }, { sanitize: ctx.sanitize });
      git(ctx, wt, 'add', '-A');
      must(git(ctx, wt, 'commit', '-m', `Record pull request ${pr} on feedback ticket ${t.id}`, '-m', `Refs #${number}`), 'recording the pull request');
    }
    must(git(ctx, wt, 'push', 'origin', branch), 'pushing the ticket record');

    // Checks, then merge only on a pass.
    let passed = false;
    let lastOut = '';
    for (let tries = 0; tries < ctx.checkRetries; tries += 1) {
      const c = gh(ctx, 'pr', 'checks', String(pr), '-R', ctx.repo, '--watch');
      lastOut = `${c.stdout}\n${c.stderr}`;
      if (c.status === 0) { passed = true; break; }
      if (/no checks reported/i.test(lastOut)) { await ctx.sleep(15000); continue; }
      break;
    }
    if (!passed) throw new NeedsAttention(`the checks did not pass\n\n${scrub(ctx, lastOut.trim().split('\n').slice(-30).join('\n'))}`);
    step(ctx, id, 'checks', 'passed');
    gh(ctx, 'pr', 'merge', String(pr), '-R', ctx.repo, '--merge', '--delete-branch');
    const view = JSON.parse(must(gh(ctx, 'pr', 'view', String(pr), '-R', ctx.repo, '--json', 'state,mergeCommit'), 'reading the pull request') || '{}');
    if (view.state !== 'MERGED') throw new NeedsAttention(`the pull request is ${view.state ?? 'not merged'} after the merge command`);
    const merge = view.mergeCommit?.oid ?? '';
    updateJob(ctx.queueDir, id, { state: 'merged', mergeCommit: merge }, ctx.now());
    step(ctx, id, 'merge', merge);

    // The handoff, on the pull request and on the merge commit.
    const handoff = [
      '## session handoff', '',
      `Delivered: feedback ${t.id} (${plain(t.data.title)}) as pull request #${pr}, merged as ${merge}. It closes issue #${number}. The ticket and ${images.length} captured image(s) are in docs/feedback.`, '',
      'Gates: npm run verify passed before the push, and the pull request checks passed before the merge.', '',
      'Next: nothing is queued for this ticket. The main checkout is brought up to date by the pipeline, or flagged as needing a pull.', '',
      'Blocked: nothing.', '',
      'Do not: edit the ticket by hand to reopen it (file a new ticket instead), or push to main directly.', '',
      'Open decisions: none.', '',
    ].join('\n');
    const handoffFile = bodyFile(ctx, id, 'handoff', guard(ctx, handoff, 'the handoff'));
    gh(ctx, 'pr', 'comment', String(pr), '-R', ctx.repo, '--body-file', handoffFile);
    if (merge) gh(ctx, 'api', '-X', 'POST', `repos/${ctx.repo}/commits/${merge}/comments`, '-F', `body=@${handoffFile}`);
    step(ctx, id, 'handoff', 'posted');

    // The issue now points at main, and its status is done. It closes through the pull request.
    const finalTicket = ctx.dry ? t : live();
    gh(ctx, 'issue', 'edit', String(number), '-R', ctx.repo, '--body-file', bodyFile(ctx, id, 'issue-main', guard(ctx, renderIssueBody(finalTicket, { ref: 'main', repo: ctx.repo }), 'the issue body')), '--add-label', STATUS_LABELS.done, '--remove-label', STATUS_LABELS.progress);

    // Cleanup, then the main checkout.
    git(ctx, ctx.root, 'worktree', 'remove', '--force', wt);
    git(ctx, ctx.root, 'branch', '-D', branch);
    git(ctx, ctx.root, 'worktree', 'prune');
    step(ctx, id, 'cleanup', 'worktree and local branch removed');
    if (!ctx.dry) { patchTicket(ctx.storeDir, id, { status: 'DONE', pr, 'pr-url': prUrl }, { sanitize: ctx.sanitize }); localHash = sha(own.localFile); }
    const needsPull = fastForward(ctx, id, own, localHash);
    if (needsPull) { updateJob(ctx.queueDir, id, { needsPull }, ctx.now()); step(ctx, id, 'main', needsPull); } else step(ctx, id, 'main', 'fast-forwarded');
    return { ok: true, issue: number, pr, merge };
  } catch (error) {
    if (!(error instanceof NeedsAttention)) {
      appendLog(ctx.queueDir, { id, step: 'error', status: 'fail', detail: String(error.message).slice(0, 300) }, ctx.now());
      error = new NeedsAttention(error.message);
    }
    appendLog(ctx.queueDir, { id, step: 'needs-attention', status: 'fail', detail: error.message.split('\n')[0].slice(0, 300) }, ctx.now());
    if (issue) {
      const file = bodyFile(ctx, id, 'failure', `The pipeline stopped for ${id}.\n\n${scrub(ctx, error.message)}\n\nThe branch ${branch} is left for review.\n`);
      gh(ctx, 'issue', 'comment', String(issue), '-R', ctx.repo, '--body-file', file);
      gh(ctx, 'issue', 'edit', String(issue), '-R', ctx.repo, '--add-label', STATUS_LABELS.attention, '--remove-label', STATUS_LABELS.progress);
    }
    try { updateJob(ctx.queueDir, id, { state: 'needs attention', error: error.message.split('\n')[0].slice(0, 300) }, ctx.now()); } catch { /* the job was never queued */ }
    ctx.print(`${id} needs attention: ${error.message.split('\n')[0]}`);
    return { ok: false, error: error.message };
  }
}

// ---------- the queue ----------

// Run queued jobs one at a time until none is left. Only one runner works at a time.
export async function processQueue(ctx) {
  const release = ctx.dry ? () => {} : takeLock(ctx.queueDir);
  if (!release) { ctx.print('another pipeline run is already working through the queue'); return []; }
  const results = [];
  try {
    if (!ctx.dry) {
      const moved = migrateLegacyStore(resolve(ctx.root, LOCAL_FEEDBACK_DIR), ctx.storeDir);
      if (moved.length) step(ctx, 'queue', 'migrate', `${moved.length} ticket(s) moved to ${FEEDBACK_DIR}`);
    }
    for (;;) {
      const job = nextJob(ctx.queueDir);
      if (!job) break;
      results.push({ id: job.id, ...(await runJob(job.id, ctx)) });
      if (ctx.dry) break;
    }
  } finally { release(); }
  return results;
}

// A runner the review server holds: kick() starts the queue on the next turn of the loop and
// returns at once, so saving a ticket never waits for the pipeline.
export function createRunner(ctx) {
  let running = null;
  let again = false;
  const loop = async () => {
    do { again = false; try { await processQueue(ctx); } catch (e) { appendLog(ctx.queueDir, { id: 'queue', step: 'runner', status: 'fail', detail: String(e.message).slice(0, 300) }); } } while (again);
    running = null;
  };
  return {
    kick() { if (running) { again = true; return running; } running = new Promise((r) => setImmediate(r)).then(loop); return running; },
    idle: () => running ?? Promise.resolve(),
  };
}

export { enqueue, jobFor, scanStore };

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  const ids = args._.filter((a) => a !== 'process');
  const ctx = buildContext({ dry: Boolean(args['dry-run']) });
  if (!ctx.dry) await withSanitizer(ctx);
  else ctx.sanitize = (text) => ({ text, redacted: [] });
  for (const id of ids) enqueue(ctx.queueDir, id);
  if (args.scan) for (const id of scanStore(ctx.storeDir, ctx.queueDir)) ctx.print(`queued ${id}`);
  const results = await processQueue(ctx);
  if (!results.length) ctx.print('Nothing is queued.');
  process.exit(results.some((r) => !r.ok) ? 1 : 0);
}
