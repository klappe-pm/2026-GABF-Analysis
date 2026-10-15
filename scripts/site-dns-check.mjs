#!/usr/bin/env node
// Check that gabf.beer and www.gabf.beer reach the site's CloudFront distribution through Route 53,
// from the outside, with no AWS credentials:
//   1. the domain's name servers are Route 53's (awsdns), so the hosted zone answers for it;
//   2. each host has address records (Route 53 alias records to the distribution);
//   3. each host answers over HTTPS through CloudFront and serves the same home page as the
//      distribution's own address (same ETag), so both reach this distribution and this bucket.
// Exits 0 when every check holds and 1 otherwise, listing what is wrong.
//
//   node scripts/site-dns-check.mjs [--domain gabf.beer]

import { Resolver } from 'node:dns/promises';
import { pathToFileURL } from 'node:url';
import { parseArgs } from './lib/paths.mjs';
import { DISTRIBUTION_HOST, HOSTED_ZONE_ID, SITE_DOMAIN } from './lib/site-hosting.mjs';

async function lookup(fn) {
  try {
    return await fn();
  } catch (e) {
    return ['ENODATA', 'ENOTFOUND', 'ESERVFAIL'].includes(e.code) ? [] : Promise.reject(e);
  }
}

async function head(host) {
  try {
    const r = await fetch(`https://${host}/`, { method: 'HEAD', redirect: 'manual' });
    return { status: r.status, via: r.headers.get('via') ?? '', cf: Boolean(r.headers.get('x-amz-cf-id')), etag: r.headers.get('etag') ?? '' };
  } catch (e) {
    return { status: 0, via: '', cf: false, etag: '', error: e.cause?.code ?? e.message };
  }
}

export async function checkSite(domain = SITE_DOMAIN) {
  const r = new Resolver();
  const ns = (await lookup(() => r.resolveNs(domain))).map((h) => h.toLowerCase());
  const origin = await head(DISTRIBUTION_HOST);
  const rows = [
    { check: `${domain} name servers are Route 53 (zone ${HOSTED_ZONE_ID})`, got: ns.join(', ') || '(none)', ok: ns.length > 0 && ns.every((h) => h.includes('awsdns')) },
    { check: `${DISTRIBUTION_HOST} serves the home page`, got: `${origin.status || origin.error} ${origin.etag}`, ok: origin.status === 200 && Boolean(origin.etag) },
  ];
  for (const host of [domain, `www.${domain}`]) {
    const a = await lookup(() => r.resolve4(host));
    rows.push({ check: `${host} has address records`, got: a.join(', ') || '(none)', ok: a.length > 0 });
    const h = await head(host);
    rows.push({ check: `${host} answers over HTTPS through CloudFront`, got: `${h.status || h.error} ${h.via}`.trim(), ok: h.status === 200 && h.cf });
    rows.push({ check: `${host} serves the distribution's home page`, got: h.etag || '(no ETag)', ok: Boolean(h.etag) && h.etag === origin.etag });
  }
  return { ok: rows.every((x) => x.ok), rows };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  const { ok, rows } = await checkSite(args.domain || SITE_DOMAIN);
  for (const x of rows) console.log(`${x.ok ? 'ok  ' : 'FAIL'} ${x.check}: ${x.got}`);
  console.log(ok ? 'The site domain reaches the CloudFront distribution.' : 'The site domain does not reach the CloudFront distribution yet.');
  process.exit(ok ? 0 : 1);
}
