#!/usr/bin/env node
// Switch GitHub Pages to the custom domain, once its DNS points at GitHub Pages. Run it once, by hand,
// with the GitHub CLI signed in as a repository admin. Without --apply it only checks and prints the plan.
//
//   node scripts/pages-domain.mjs           check DNS and show what --apply would do
//   node scripts/pages-domain.mjs --apply   switch the domain, enforce HTTPS, and redeploy
//
// Steps with --apply:
//   1. Stop unless scripts/pages-dns-check.mjs passes (switching first would redirect the github.io
//      site to a domain that does not resolve to Pages yet).
//   2. Set the Pages custom domain (PUT repos/<repo>/pages cname=<domain>).
//   3. Wait for GitHub to issue the certificate (https_certificate.state approved); enforcing HTTPS
//      fails before that. Gives up after --wait minutes (default 30) and says how to finish by hand.
//   4. Enforce HTTPS (PUT repos/<repo>/pages https_enforced=true).
//   5. Dispatch deploy.yml, so the web/ app rebuilds with an empty base path: the deploy reads the
//      base path from the Pages setting, which is empty for a custom domain.

import { execFileSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { parseArgs } from './lib/paths.mjs';
import { PAGES_DOMAIN, REPO } from './lib/pages.mjs';
import { checkDns } from './pages-dns-check.mjs';

const args = parseArgs(process.argv.slice(2));
const domain = args.domain || PAGES_DOMAIN;
const apply = Boolean(args.apply);
const waitMinutes = Number(args.wait || 30);

const gh = (...a) => execFileSync('gh', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
const pages = () => JSON.parse(gh('api', `repos/${REPO}/pages`));

const dns = await checkDns(domain);
for (const x of dns.rows) console.log(`${x.ok ? 'ok  ' : 'FAIL'} ${x.record}: ${x.got.join(', ') || '(none)'}`);
if (!dns.ok) {
  console.log(`DNS for ${domain} does not point at GitHub Pages yet; nothing changed.`);
  process.exit(1);
}

const before = pages();
console.log(`Pages now: cname ${before.cname ?? '(none)'}, https_enforced ${before.https_enforced}, url ${before.html_url}`);
if (!apply) {
  console.log(`Plan: set the custom domain to ${domain}, wait for the certificate, enforce HTTPS, dispatch deploy.yml. Run again with --apply.`);
  process.exit(0);
}

if (before.cname !== domain) {
  gh('api', '-X', 'PUT', `repos/${REPO}/pages`, '-f', `cname=${domain}`);
  console.log(`custom domain set to ${domain}`);
}

const deadline = Date.now() + waitMinutes * 60_000;
let state = pages().https_certificate?.state;
while (state !== 'approved' && Date.now() < deadline) {
  console.log(`certificate state: ${state ?? 'not started'}; checking again in 30 seconds`);
  await sleep(30_000);
  state = pages().https_certificate?.state;
}
if (state !== 'approved') {
  console.log(`The certificate is not issued yet (state ${state ?? 'not started'}). Run this script again with --apply later; it picks up where it stopped.`);
  process.exit(1);
}

gh('api', '-X', 'PUT', `repos/${REPO}/pages`, '-F', 'https_enforced=true');
console.log('HTTPS enforced');
gh('workflow', 'run', 'deploy.yml', '--repo', REPO, '--ref', 'main');
console.log(`deploy.yml dispatched; the site rebuilds for https://${domain}/ with an empty base path.`);
