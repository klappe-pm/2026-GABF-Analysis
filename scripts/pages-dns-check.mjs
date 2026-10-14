#!/usr/bin/env node
// Check that the custom domain's DNS points at GitHub Pages: the apex A records are exactly GitHub's
// four addresses, the apex AAAA records are exactly GitHub's four addresses, and www is a CNAME to the
// account's github.io host. Exits 0 when all three hold and 1 otherwise, listing what is wrong.
//
//   node scripts/pages-dns-check.mjs [--domain gabf.beer]

import { Resolver } from 'node:dns/promises';
import { pathToFileURL } from 'node:url';
import { parseArgs } from './lib/paths.mjs';
import { PAGES_A, PAGES_AAAA, PAGES_DOMAIN, PAGES_HOST } from './lib/pages.mjs';

const sameSet = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join();
const normalize6 = (ip) => ip.toLowerCase().replace(/(^|:)0+(?=[0-9a-f])/g, '$1');

async function lookup(fn) {
  try {
    return await fn();
  } catch (e) {
    return e.code === 'ENODATA' || e.code === 'ENOTFOUND' ? [] : Promise.reject(e);
  }
}

export async function checkDns(domain = PAGES_DOMAIN) {
  const r = new Resolver();
  const a = await lookup(() => r.resolve4(domain));
  const aaaa = (await lookup(() => r.resolve6(domain))).map(normalize6);
  const www = (await lookup(() => r.resolveCname(`www.${domain}`))).map((h) => h.replace(/\.$/, '').toLowerCase());
  const rows = [
    { record: `${domain} A`, want: PAGES_A, got: a, ok: sameSet(a, PAGES_A) },
    { record: `${domain} AAAA`, want: PAGES_AAAA, got: aaaa, ok: sameSet(aaaa, PAGES_AAAA.map(normalize6)) },
    { record: `www.${domain} CNAME`, want: [PAGES_HOST], got: www, ok: sameSet(www, [PAGES_HOST]) },
  ];
  return { ok: rows.every((x) => x.ok), rows };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  const { ok, rows } = await checkDns(args.domain || PAGES_DOMAIN);
  for (const x of rows) console.log(`${x.ok ? 'ok  ' : 'FAIL'} ${x.record}: ${x.got.join(', ') || '(none)'}${x.ok ? '' : `; want ${x.want.join(', ')}`}`);
  console.log(ok ? 'DNS points at GitHub Pages.' : 'DNS does not point at GitHub Pages yet.');
  process.exit(ok ? 0 : 1);
}
