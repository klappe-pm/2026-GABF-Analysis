import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { ROOT } from '../scripts/lib/paths.mjs';
import { parseFrontmatter } from '../scripts/lib/frontmatter.mjs';
import { CANONICAL_KEYS, applyFiles, frontmatter, prose } from '../scripts/lib/doc-meta.mjs';
import { PATHS, buildGraph } from '../scripts/lib/doc-graph.mjs';
import { hopDocFiles } from '../scripts/build-hop-docs.mjs';
import { breweryDocFiles } from '../scripts/build-brewery-docs.mjs';

const graph = buildGraph();
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');
const folder = (rel) => readdirSync(resolve(ROOT, rel)).filter((f) => f.endsWith('.md')).sort().map((f) => `${rel}/${f}`);
const varietyFiles = folder('docs/hops/varieties');
const farmFiles = folder('docs/hops/farms').filter((f) => !f.endsWith('README.md'));
const breweryFiles = folder('docs/breweries').filter((f) => !f.endsWith('README.md'));
const indexFiles = [PATHS.hopsIndex, PATHS.farmsIndex, PATHS.breweriesIndex];
const allFiles = [...varietyFiles, ...farmFiles, ...breweryFiles, ...indexFiles];

const lower = (x) => String(x).toLowerCase();
const relation = (x) => typeof x === 'string' && /^\.{1,2}\/.+\.md$/.test(x);

test('one file per variety, farm and brewery in the data', () => {
  const listed = graph.model.varieties.filter((v) => v.listed);
  assert.deepEqual(varietyFiles, listed.map((v) => PATHS.variety(v.docSlug)).sort());
  assert.deepEqual(farmFiles, graph.model.farms.map((f) => PATHS.farm(f.slug)).sort());
  assert.deepEqual(breweryFiles, graph.ds.breweries.map((b) => PATHS.brewery(b.slug)).sort());
  assert.equal(breweryFiles.length, 947);
});

test('every reference file opens with the canonical frontmatter keys in order, then the rest sorted', () => {
  for (const rel of allFiles) {
    const text = read(rel);
    assert.ok(text.startsWith('---\n'), `${rel} frontmatter opens on row 1`);
    const { data } = parseFrontmatter(text);
    const keys = Object.keys(data);
    assert.deepEqual(keys.slice(0, CANONICAL_KEYS.length), CANONICAL_KEYS, `${rel} canonical keys`);
    const rest = keys.slice(CANONICAL_KEYS.length);
    assert.deepEqual(rest, [...rest].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)), `${rel} file-specific keys sorted A to Z`);
    assert.ok(!keys.some((k) => ['models', 'providers', 'session-link'].includes(k)), `${rel} carries provenance keys in a public repository`);
    assert.match(data['date-created'], /^\d{4}-\d{2}-\d{2}$/);
    assert.match(data['date-revised'], /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(data['date-revised'] >= data['date-created'], `${rel} revised before created`);
    for (const [k, v] of Object.entries(data)) {
      if (!Array.isArray(v)) continue;
      const sorted = [...new Set(v)].sort((a, b) => (lower(a) < lower(b) ? -1 : lower(a) > lower(b) ? 1 : a < b ? -1 : a > b ? 1 : 0));
      assert.deepEqual(v, sorted, `${rel} ${k} is deduped and sorted`);
    }
    assert.ok(!/^[a-z0-9-]+:\s*\[\s+\]$/m.test(text.split('\n---')[0]), `${rel} empty array written as []`);
  }
});

test('varieties, farms and breweries carry the file-specific metadata the readers need', () => {
  const needs = {
    variety: ['canonical-name', 'aliases', 'breeder', 'owner-program', 'origin-country', 'release-year', 'parentage', 'proprietary-status', 'alpha-acid-percent', 'total-oil-ml-per-100g', 'aroma-descriptors', 'use', 'us-acres-latest', 'medal-beers-2026', 'sources', 'gaps'],
    farm: ['name', 'state', 'county', 'county-source', 'city', 'founded', 'generation', 'acreage', 'ownership', 'certifications', 'merchant-affiliation', 'varieties-grown', 'verified', 'verification', 'sources', 'gaps'],
    brewery: ['name', 'city', 'state', 'region', 'fed-district', 'brewery-type', 'ownership', 'website', 'instagram', 'medals-by-year', 'categories-won', 'beers-2026', 'hops-used', 'farms-reached', 'sources', 'gaps'],
  };
  for (const [kind, files] of [['variety', varietyFiles], ['farm', farmFiles], ['brewery', breweryFiles]]) {
    for (const rel of files) {
      const { data } = parseFrontmatter(read(rel));
      for (const key of needs[kind]) assert.ok(key in data, `${rel} lacks ${key}`);
    }
  }
});

test('every relative link in the reference files resolves to an existing file', () => {
  const broken = [];
  let links = 0;
  for (const rel of allFiles) {
    const { data, body } = parseFrontmatter(read(rel));
    let fenced = false;
    const targets = [];
    for (const line of body.split('\n')) {
      if (/^\s*```/.test(line)) { fenced = !fenced; continue; }
      if (fenced) continue;
      for (const m of line.matchAll(/\]\(([^)\s]+)\)/g)) targets.push(m[1]);
    }
    for (const v of Object.values(data)) for (const item of Array.isArray(v) ? v : [v]) if (relation(item)) targets.push(item);
    for (const t of targets) {
      if (/^(https?:|mailto:|#)/.test(t)) continue;
      links += 1;
      if (!existsSync(resolve(ROOT, dirname(rel), t.split('#')[0]))) broken.push(`${rel} -> ${t}`);
    }
  }
  assert.deepEqual(broken.slice(0, 20), []);
  assert.ok(links > 5000, `expected thousands of links, found ${links}`);
});

test('every variety used by a 2026 beer links back to that beer, and the brewery and named farms link to it', () => {
  const missing = [];
  for (const beer of graph.model.beers.values()) {
    const beerPath = `../../2026/winner/${beer.stem}.md`;
    for (const u of beer.usage) {
      if (!u.variety.listed) continue;
      if (!read(PATHS.variety(u.variety.docSlug)).includes(`](${beerPath})`)) missing.push(`${u.variety.docSlug} lacks ${beer.stem}`);
    }
    const brewery = graph.breweryBySlug.get(beer.brewery_slug);
    if (brewery && !read(PATHS.brewery(brewery.slug)).includes(`](../2026/winner/${beer.stem}.md)`)) missing.push(`${brewery.slug} lacks ${beer.stem}`);
    for (const u of beer.usage) if (u.farm && !read(PATHS.farm(u.farm.slug)).includes(`](${beerPath})`)) missing.push(`${u.farm.slug} lacks ${beer.stem}`);
  }
  assert.deepEqual(missing.slice(0, 20), []);
});

test('a farm page links every variety it grows and every variety page links every farm that grows it', () => {
  for (const f of graph.model.farms) {
    const text = read(PATHS.farm(f.slug));
    for (const { variety } of f.varieties.values()) if (variety.listed) assert.ok(text.includes(`](../varieties/${variety.docSlug}.md)`), `${f.slug} lacks ${variety.docSlug}`);
  }
  for (const v of graph.model.varieties.filter((x) => x.listed)) {
    const text = read(PATHS.variety(v.docSlug));
    for (const { farm } of v.farms.values()) assert.ok(text.includes(`](../farms/${farm.slug}.md)`), `${v.docSlug} lacks ${farm.slug}`);
  }
});

test('named and grown farm links stay in separate labelled sections', () => {
  for (const rel of [PATHS.variety('citra'), PATHS.farm('cls-farms'), PATHS.brewery('bend-brewing-co')]) {
    const text = read(rel);
    assert.match(text, /^### (grown-by|reached-through-varieties|farms-grown-reaching-its-hops)$/m, rel);
    assert.match(text, /^### (named-by-the-brewery|farms-named-by-the-brewery)$/m, rel);
  }
});

test('each index page links every file in its folder', () => {
  const hops = read(PATHS.hopsIndex);
  for (const rel of varietyFiles) assert.ok(hops.includes(`](varieties/${rel.split('/').pop()})`), `hops index lacks ${rel}`);
  const farmsIndex = read(PATHS.farmsIndex);
  for (const rel of farmFiles) assert.ok(farmsIndex.includes(`](${rel.split('/').pop()})`), `farms index lacks ${rel}`);
  const breweries = read(PATHS.breweriesIndex);
  for (const rel of breweryFiles) assert.ok(breweries.includes(`](${rel.split('/').pop()})`), `breweries index lacks ${rel}`);
});

test('frontmatter relations run one way: farm to variety, brewery to the rest, never back', () => {
  for (const rel of varietyFiles) {
    const { data } = parseFrontmatter(read(rel));
    assert.deepEqual(Object.values(data).flat().filter(relation), [], `${rel} lists relations in frontmatter`);
  }
  for (const rel of farmFiles) {
    const { data } = parseFrontmatter(read(rel));
    const paths = Object.values(data).flat().filter(relation);
    assert.ok(paths.every((p) => p.startsWith('../varieties/')), `${rel} relates to something other than varieties`);
  }
});

test('generated prose carries no dash as punctuation and frontmatter is deduped, sorted and canonical', () => {
  const en = String.fromCharCode(8211);
  const em = String.fromCharCode(8212);
  const hy = String.fromCharCode(45);
  assert.equal(prose(`A ${en} B ${em} C ${hy} D ${hy}${hy} E`), 'A, B, C, D, E');
  assert.equal(prose(`Brewing ${hy} Costa Mesa`), 'Brewing, Costa Mesa');
  const out = frontmatter({ domain: 'beer', category: 'x', 'sub-category': 'y', topics: [], types: ['b', 'a', 'a'], 'date-created': '2026-01-01', 'date-revised': '2026-01-01', status: 'DONE', aliases: [], tags: ['B', 'a'], zed: 1, alpha: null });
  assert.deepEqual(out.split('\n').slice(0, 9), ['---', 'domain: beer', 'category: x', 'sub-category: y', 'topics: []', 'types:', '  - "a"', '  - "b"', 'date-created: 2026-01-01']);
  assert.ok(out.indexOf('alpha: null') < out.indexOf('zed: 1'));
});

test('the generated files are what the build scripts write', () => {
  const stale = [...applyFiles(hopDocFiles(graph), { check: true }), ...applyFiles(breweryDocFiles(graph), { check: true })];
  assert.deepEqual(stale.slice(0, 20), [], 'run npm run docs:build');
});
