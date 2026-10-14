// Polite fetching and field extraction for brewery websites.
//
// Rules this module enforces:
// - robots.txt is fetched once per host and obeyed (Allow and Disallow with the longest match, the
//   group for this project's agent token or else the * group, Crawl-delay when longer than the default).
// - one request every REQUEST_GAP_MS per host, even when many beers share a host.
// - a user agent that names the project and its GitHub URL.
// - everything captured passes through redact() before it is cached or returned.
// - the cache lives under data/cache/brewery-sites/, which git ignores; nothing here writes elsewhere.
//
// Extraction reads only the brewery's own page: JSON-LD (Product, Beer, Drink), meta descriptions, and
// labelled lines such as "ABV: 5.2%". A page counts only when its title, heading or structured name
// carries the beer's name. Untappd and BeerAdvocate hosts are refused outright.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from './paths.mjs';
import { redact } from './redact.mjs';

export const USER_AGENT = 'gabf-analysis-research/0.1 (+https://github.com/klappe-pm/GABF-Analysis)';
export const AGENT_TOKEN = 'gabf-analysis-research';
export const REQUEST_GAP_MS = 3500;
export const CACHE_DIR = resolve(ROOT, 'data/cache/brewery-sites');
const MAX_BYTES = 2_000_000;
const REFUSED_HOSTS = /(^|\.)(untappd\.com|beeradvocate\.com|ratebeer\.com)$/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const norm = (s) => String(s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '');

// ---------- robots.txt ----------
export function parseRobots(text) {
  const groups = [];
  let cur = null;
  const sitemaps = [];
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === 'user-agent') {
      if (!cur || cur.rules.length || cur.delay !== null) { cur = { agents: [], rules: [], delay: null }; groups.push(cur); }
      cur.agents.push(val.toLowerCase());
    } else if (key === 'sitemap') sitemaps.push(val);
    else if (cur && (key === 'allow' || key === 'disallow')) cur.rules.push({ allow: key === 'allow', path: val });
    else if (cur && key === 'crawl-delay') cur.delay = Number(val) || null;
  }
  const pick = groups.find((g) => g.agents.some((a) => a !== '*' && AGENT_TOKEN.includes(a))) ?? groups.find((g) => g.agents.includes('*')) ?? { rules: [], delay: null };
  return { rules: pick.rules, delay: pick.delay, sitemaps };
}

function ruleRegex(path) {
  const body = path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${body.endsWith('\\$') ? body.slice(0, -2) + '$' : body}`);
}

export function robotsAllows(robots, pathAndQuery) {
  let best = null;
  for (const r of robots.rules) {
    if (!r.path) continue;
    if (!ruleRegex(r.path).test(pathAndQuery)) continue;
    if (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow)) best = r;
  }
  return best ? best.allow : true;
}

// ---------- fetching ----------
const hosts = new Map();
const stats = { network: 0, cached: 0, blocked: 0 };
export const fetchStats = stats;

const cacheFile = (url) => resolve(CACHE_DIR, `${createHash('sha1').update(url).digest('hex')}.json`);

function hostState(host) {
  if (!hosts.has(host)) hosts.set(host, { chain: Promise.resolve(), last: 0, robots: null, gap: REQUEST_GAP_MS });
  return hosts.get(host);
}

// Run fn when this host's turn comes and at least `gap` ms after its previous request started.
function inTurn(state, fn) {
  const run = state.chain.then(async () => {
    const wait = state.last + state.gap - Date.now();
    if (wait > 0) await sleep(wait);
    state.last = Date.now();
    return fn();
  });
  state.chain = run.catch(() => {});
  return run;
}

async function rawGet(state, url, accept) {
  return inTurn(state, async () => {
    stats.network += 1;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 20000);
    try {
      const res = await fetch(url, { headers: { 'user-agent': USER_AGENT, accept }, redirect: 'follow', signal: ctl.signal });
      const type = res.headers.get('content-type') ?? '';
      let body = '';
      if (/text|xml|json|html/i.test(type) || type === '') body = (await res.text()).slice(0, MAX_BYTES);
      return { status: res.status, type, body, finalUrl: res.url || url };
    } finally { clearTimeout(timer); }
  });
}

export async function getRobots(origin) {
  const host = new URL(origin).host;
  const state = hostState(host);
  if (state.robots) return state.robots;
  const robotsUrl = `${origin}/robots.txt`;
  const hit = readCache(robotsUrl);
  let text = '';
  if (hit) { stats.cached += 1; text = hit.body; } else {
    try {
      const r = await rawGet(state, robotsUrl, 'text/plain');
      text = r.status === 200 ? r.body : '';
      writeCache(robotsUrl, { url: robotsUrl, finalUrl: r.finalUrl, status: r.status, type: r.type, body: text });
    } catch { text = ''; }
  }
  state.robots = parseRobots(text);
  if (state.robots.delay) state.gap = Math.min(Math.max(REQUEST_GAP_MS, state.robots.delay * 1000), 30000);
  return state.robots;
}

function readCache(url) {
  const f = cacheFile(url);
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
}
function writeCache(url, rec) {
  mkdirSync(CACHE_DIR, { recursive: true });
  const r = redact(rec.body);
  writeFileSync(cacheFile(url), JSON.stringify({ ...rec, body: r.text, redacted: r.kinds, fetchedAt: new Date().toISOString().slice(0, 10) }));
}

// One polite GET. Returns { url, finalUrl, status, body, fetchedAt, skipped } and never throws.
export async function politeFetch(url, { accept = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.5' } = {}) {
  let u;
  try { u = new URL(url); } catch { return { url, status: 0, body: '', skipped: 'bad url' }; }
  if (!/^https?:$/.test(u.protocol)) return { url, status: 0, body: '', skipped: 'not http' };
  if (REFUSED_HOSTS.test(u.hostname)) { stats.blocked += 1; return { url, status: 0, body: '', skipped: 'host is never scraped' }; }
  const cached = readCache(url);
  if (cached) { stats.cached += 1; return { url, finalUrl: cached.finalUrl, status: cached.status, body: cached.body, fetchedAt: cached.fetchedAt }; }
  const robots = await getRobots(u.origin);
  if (!robotsAllows(robots, u.pathname + u.search)) { stats.blocked += 1; return { url, status: 0, body: '', skipped: 'robots.txt disallows' }; }
  try {
    const r = await rawGet(hostState(u.host), url, accept);
    const rec = { url, finalUrl: r.finalUrl, status: r.status, type: r.type, body: r.body };
    writeCache(url, rec);
    return { url, finalUrl: r.finalUrl, status: r.status, body: redact(r.body).text, fetchedAt: new Date().toISOString().slice(0, 10) };
  } catch (e) {
    return { url, status: 0, body: '', skipped: `fetch failed: ${e.name}` };
  }
}

// ---------- sitemaps and links ----------
export function sitemapLocs(xml) {
  return [...String(xml).matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)\s*(?:\]\]>)?\s*<\/loc>/gi)].map((m) => decodeEntities(m[1]));
}

export function anchors(html, base) {
  const out = [];
  for (const m of String(html).matchAll(/<a\b[^>]*?href\s*=\s*["']([^"'#]+)(?:#[^"']*)?["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try { out.push({ url: new URL(decodeEntities(m[1]), base).href, text: decodeEntities(m[2].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim() }); } catch { /* skip */ }
  }
  return out;
}

export function sameSite(a, b) {
  try { return new URL(a).hostname.replace(/^www\./, '') === new URL(b).hostname.replace(/^www\./, ''); } catch { return false; }
}

// ---------- text extraction ----------
export function decodeEntities(s) {
  return String(s)
    .replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&apos;|&rsquo;|&lsquo;/g, "'").replace(/&rdquo;|&ldquo;/g, '"');
}

export function htmlToLines(html) {
  const body = String(html)
    .replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/tr|\/h[1-6]|\/section|\/article|\/dd|\/dt|\/td|\/th|\/ul|\/ol|\/table)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(body).split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

export function jsonLd(html) {
  const out = [];
  for (const m of String(html).matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const walk = (v) => {
        if (Array.isArray(v)) v.forEach(walk);
        else if (v && typeof v === 'object') { out.push(v); if (v['@graph']) walk(v['@graph']); }
      };
      walk(JSON.parse(m[1].trim()));
    } catch { /* malformed block */ }
  }
  return out;
}

const metaContent = (html, key) => {
  const re = new RegExp(`<meta\\b[^>]*(?:name|property)\\s*=\\s*["']${key}["'][^>]*>`, 'i');
  const tag = String(html).match(re)?.[0];
  const c = tag?.match(/content\s*=\s*["']([^"']*)["']/i);
  return c ? decodeEntities(c[1]).trim() : null;
};

export function pageNames(html) {
  const names = [];
  const title = String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title) names.push(decodeEntities(title[1]).replace(/\s+/g, ' ').trim());
  for (const m of String(html).matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)) names.push(decodeEntities(m[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim());
  const og = metaContent(html, 'og:title');
  if (og) names.push(og);
  for (const o of jsonLd(html)) if (typeof o.name === 'string') names.push(o.name);
  return names.filter(Boolean);
}

export const pageMatchesBeer = (html, beer) => {
  const key = norm(beer);
  return key.length >= 4 && pageNames(html).some((n) => norm(n).includes(key));
};

const LD_TYPES = /^(Product|Beer|Drink|AlcoholicBeverage|IndividualProduct)$/i;

const RANGE = { abv: [0, 25], ibu: [0, 150], srm: [0, 80] };
const inRange = (k, n) => Number.isFinite(n) && n >= RANGE[k][0] && n <= RANGE[k][1];

// A label line carries its value after a colon or dash, or on the following line.
function labelled(lines, labelRe) {
  const inline = new RegExp(`^(?:${labelRe.source})\\s*(?:[:\\u2013\\u2014]|\\s)\\s*(.+)$`, 'i');
  const bare = new RegExp(`^(?:${labelRe.source})\\s*:?$`, 'i');
  for (let i = 0; i < lines.length; i += 1) {
    const l = lines[i];
    if (l.length > 400) continue;
    const m = l.match(inline);
    if (m && m[m.length - 1]) return m[m.length - 1].trim();
    if (bare.test(l) && lines[i + 1] && lines[i + 1].length <= 400) return lines[i + 1].trim();
  }
  return null;
}

const num = (s) => { const m = String(s ?? '').match(/\d+(?:\.\d+)?/); return m ? Number(m[0]) : NaN; };

export function splitList(s) {
  const items = String(s ?? '').replace(/\.$/, '').split(/\s*(?:,|;|\band\b|&|\+|\/|\|)\s*/i).map((x) => x.trim().replace(/^and\s+/i, '')).filter(Boolean);
  const seen = new Set();
  const out = [];
  for (const it of items) {
    if (it.length > 45 || it.split(/\s+/).length > 6) return [];
    const k = it.toLowerCase();
    if (!seen.has(k)) { seen.add(k); out.push(it); }
  }
  return out.length <= 14 ? out : [];
}

// Fields found on a page already known to be about the beer. Every value is the brewery's own wording or figure.
export function extractFields(html) {
  const f = {};
  const lines = htmlToLines(html);
  const text = lines.join('\n');
  const ld = jsonLd(html).filter((o) => LD_TYPES.test([].concat(o['@type'] ?? []).join(' ')) || [].concat(o['@type'] ?? []).some((t) => LD_TYPES.test(t)));
  const props = {};
  for (const o of ld) for (const p of [].concat(o.additionalProperty ?? [])) if (p && p.name) props[norm(p.name)] = String(p.value ?? '');
  const ldDesc = ld.map((o) => o.description).find((d) => typeof d === 'string' && d.trim().length >= 40);
  const meta = metaContent(html, 'og:description') ?? metaContent(html, 'description');
  const desc = (ldDesc ? decodeEntities(ldDesc.replace(/<[^>]+>/g, ' ')) : meta)?.replace(/\s+/g, ' ').trim();
  if (desc && desc.length >= 40 && desc.length <= 1500) f.description = desc;

  // A bound ("<0.5%", "less than 0.5%", "up to 5%") is not the beer's figure.
  const BOUND = /(?:^|\s)(?:<|\u2264|less than|under|below|up to|max\w*|no more than)\s*$|^\s*(?:<|\u2264|less than|under|below|up to|max\w*|no more than)\b|\bor less\b/i;
  const bounded = (m) => m && (BOUND.test(m[1] ?? '') || /or less/i.test(m[0]) || /^\s*(?:or less|and under|maximum|max\b)/i.test(text.slice(m.index + m[0].length, m.index + m[0].length + 14)));
  const abvMatch = text.match(/((?:<|\u2264|less than|under|below|up to|max\w*|no more than)\s*)?(\d{1,2}(?:\.\d{1,2})?)\s*%\s*(?:or less\s*)?(?:ABV|alc)/i);
  const labelAbv = labelled(lines, /ABV|Alc(?:ohol)?(?: by volume)?\.?|A\.?B\.?V\.?/);
  const abv = props.abv ?? props.alcoholbyvolume ?? (labelAbv && !BOUND.test(labelAbv) && !/or less/i.test(labelAbv) ? labelAbv : null) ?? (abvMatch && !bounded(abvMatch) ? abvMatch[2] : null);
  if (abv !== undefined && abv !== null && inRange('abv', num(abv))) f.abv = num(abv);
  const ibu = props.ibu ?? props.ibus ?? labelled(lines, /IBUs?|International Bitterness Units?/) ?? text.match(/(\d{1,3})\s*IBUs?\b/i)?.[1];
  if (ibu !== undefined && ibu !== null && inRange('ibu', num(ibu))) f.ibu = num(ibu);
  const srm = props.srm ?? labelled(lines, /SRM/) ?? text.match(/(\d{1,2}(?:\.\d)?)\s*SRM\b/i)?.[1];
  if (srm !== undefined && srm !== null && inRange('srm', num(srm))) f.srm = String(num(srm));
  else {
    const color = props.color ?? props.colour ?? labelled(lines, /Colou?r/);
    if (color && color.length <= 60 && !/\d{3,}/.test(color)) f.color = color;
  }
  const gravity = (label) => {
    const v = props[norm(label)] ?? labelled(lines, new RegExp(`${label === 'og' ? 'OG|Original Gravity|Starting Gravity' : 'FG|Final Gravity|Finishing Gravity'}`));
    const m = String(v ?? '').match(/\b1\.\d{2,3}\b|\b\d{1,2}(?:\.\d{1,2})?\s*(?:°\s*P\b|degrees? Plato|° ?Plato)/i);
    return m ? m[0].trim() : null;
  };
  const og = gravity('og'); if (og) f.og = og;
  const fg = gravity('fg'); if (fg) f.fg = fg;

  const list = (re, key) => { const v = props[norm(key)] ?? labelled(lines, re); const items = v ? splitList(v) : []; if (items.length) f[key] = items; };
  list(/Hops?(?: bill)?|Hopping|Hop varieties/, 'hops');
  list(/Malts?(?: bill)?|Grains?(?: bill)?|Grist/, 'malts');
  list(/Yeast|Yeast strain/, 'yeast');
  list(/Adjuncts?|Additions|Spices|Fruit|Flavou?rings?/, 'adjuncts');
  const water = props.water ?? labelled(lines, /Water|Water profile/);
  if (water && water.length <= 200) f.water = water;
  const notes = props.tastingnotes ?? labelled(lines, /Tasting notes?|Flavou?r profile|Flavou?rs?|On the palate|Palate|Aroma|Notes/);
  if (notes && notes.length >= 12 && notes.length <= 600) f.tastingNotes = notes;
  const proc = props.process ?? labelled(lines, /Process|Brewing process|Brewing notes?|Fermentation|Conditioning|Aging|Aged in|Barrel/);
  if (proc && proc.length >= 8 && proc.length <= 400) f.process = proc;
  return f;
}
