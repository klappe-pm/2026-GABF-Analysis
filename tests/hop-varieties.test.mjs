import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { REFERENCE, ROOT } from '../scripts/lib/paths.mjs';
import { toCsv } from '../scripts/lib/csv.mjs';
import { loadHopLookup, normalizeHopName, resolveHop } from '../scripts/lib/hop-aliases.mjs';
import { nassKey, parseNassVarietyTables } from '../scripts/lib/nass-hops.mjs';
import { VARIETY_COLUMNS, buildAliasRows, buildVarietyRecords, parseRange } from '../scripts/build-hop-data.mjs';
import { ACREAGE_COLUMNS } from '../scripts/ingest-nass-hops.mjs';
import { checkAcreageRows, checkVarietyRows, classifyProfileHops, csvHeader, profileHopNames, readCsvFile } from '../scripts/validate-hops.mjs';

const varieties = readCsvFile('hop-varieties.csv');
const acreage = readCsvFile('hop-acreage.csv');
const lookup = loadHopLookup();

test('hop-varieties.csv has exactly the expected columns, one field group source column each', () => {
  assert.deepEqual(csvHeader('hop-varieties.csv'), VARIETY_COLUMNS);
  for (const col of ['identity_source_urls', 'chemistry_source_urls', 'aroma_source_urls', 'acreage_source_url', 'identity_gap', 'chemistry_gap', 'aroma_gap']) assert.ok(VARIETY_COLUMNS.includes(col), col);
  for (const m of ['alpha', 'beta', 'cohumulone', 'total_oil', 'myrcene', 'humulene', 'caryophyllene', 'farnesene']) {
    assert.ok(VARIETY_COLUMNS.includes(`${m}_min`) && VARIETY_COLUMNS.includes(`${m}_max`), m);
  }
  assert.deepEqual(csvHeader('hop-acreage.csv'), ACREAGE_COLUMNS);
  assert.deepEqual(csvHeader('hop-aliases.csv'), ['alias', 'normalized', 'slug', 'canonical', 'kind']);
});

test('every variety row has at least one source and passes the structural checks', () => {
  assert.deepEqual(checkVarietyRows(varieties), []);
  for (const r of varieties) {
    const urls = [r.identity_source_urls, r.chemistry_source_urls, r.aroma_source_urls].flatMap((c) => c.split('|').filter(Boolean));
    assert.ok(urls.length >= 1, `${r.slug} has no source`);
  }
});

test('the committed CSVs are what the catalogue builds', () => {
  const records = buildVarietyRecords();
  assert.equal(readFileSync(resolve(REFERENCE, 'hop-varieties.csv'), 'utf8'), toCsv(records, VARIETY_COLUMNS));
  assert.equal(readFileSync(resolve(REFERENCE, 'hop-aliases.csv'), 'utf8'), toCsv(buildAliasRows(records), ['alias', 'normalized', 'slug', 'canonical', 'kind']));
});

test('every variety has a page and a missing field is a stated gap, not silence', () => {
  for (const r of varieties) {
    const page = readFileSync(resolve(ROOT, 'docs/hops/varieties', `${r.slug}.md`), 'utf8');
    assert.match(page, new RegExp(`^# ${r.slug}$`, 'm'));
    assert.ok(!/^(models|providers|session-link):/m.test(page), `${r.slug} carries provenance keys in a public repository`);
    if (r.chemistry_gap) assert.match(page, /Chemistry, /);
  }
});

test('every hop named in a 2026 profile maps to a variety or is on the explicit unmapped list', () => {
  const mentions = profileHopNames();
  assert.ok(mentions.length > 100, 'expected the 2026 profiles to name hops');
  const { mapped, unmapped, unknown } = classifyProfileHops(mentions, lookup);
  assert.deepEqual(unknown.map((u) => `${u.file}: ${u.name}`), []);
  assert.equal(mapped.length + unmapped.length, mentions.length);
  const slugs = new Set(varieties.map((v) => v.slug));
  for (const m of mapped) assert.ok(slugs.has(m.slug), `${m.name} maps to missing variety ${m.slug}`);
  for (const u of unmapped) assert.ok(u.reason.length > 10, `${u.name} has no reason`);
});

test('the unmapped list names no variety that the alias list also maps, and every row has a reason', () => {
  const rows = readCsvFile('hop-unmapped.csv');
  assert.ok(rows.length > 0);
  for (const r of rows) {
    assert.ok(r.reason, `${r.name} has no reason`);
    assert.equal(lookup.aliases.has(normalizeHopName(r.name)), false, `${r.name} is both mapped and unmapped`);
  }
});

test('published names, product forms and spellings resolve to one canonical variety', () => {
  const same = (names, slug) => names.forEach((n) => {
    const r = resolveHop(n, lookup);
    assert.equal(r.status, 'mapped', n);
    assert.equal(r.slug, slug, n);
  });
  same(['Citra', 'Citra Cryo', 'Citra LupuLN2', 'HBC 394', 'Citra Dynaboost', 'Citra DynaBoost', 'Citra HyperBoost', 'Citra Hyperboost', 'Citra Incognito', 'Citra® HBC 394'], 'citra');
  same(['Mosaic', 'Mosaic Incognito', 'Mosaic LUPOMAX', 'Mosaic Cryo', 'HBC 369'], 'mosaic');
  same(['Lemon Drop', 'Lemondrop'], 'lemondrop');
  same(['Nelson', 'Nelson Sauvin', 'Nelson Cryo'], 'nelson-sauvin');
  same(['Mittelfrüh', 'Hallertau Mittelfrüh', 'Hallertauer Mittelfrüh', 'Hallertauer Mittelfruh'], 'hallertauer-mittelfruh');
  same(['Czech Saaz', 'Saaz'], 'saaz');
  same(['Fuggle', 'Fuggles'], 'fuggle');
  same(['Hallertau Magnum', 'Hallertauer Magnum'], 'hallertauer-magnum');
  same(['US Tettnanger', 'US Tettnang'], 'us-tettnang');
  same(['CTZ'], 'columbus-tomahawk-zeus');
  same(['Columbus', 'Columbus Cryo'], 'columbus');
  same(['Falconer\'s Flight', 'Falconers Flight'], 'falconers-flight');
  same(['Hallertauer Hersbrucker', 'Hersbrucker'], 'hersbrucker');
  same(['Dolcita', 'Dolcita DynaBoost'], 'dolcita');
  assert.equal(resolveHop('Citra LupuLN2', lookup).form, 'LupuLN2');
  assert.equal(resolveHop('Citra Hyperboost', lookup).form, 'HyperBoost');
  assert.equal(resolveHop('Citra', lookup).form, '');
  assert.equal(resolveHop('Noble hops', lookup).status, 'unmapped');
  assert.equal(resolveHop('Not A Hop', lookup).status, 'unknown');
});

test('parseRange reads ranges, single values and bounded values', () => {
  assert.deepEqual(parseRange('11.0-13.0'), [11, 13]);
  assert.deepEqual(parseRange('12.1'), [12.1, 12.1]);
  assert.deepEqual(parseRange('<1'), [null, 1]);
  assert.deepEqual(parseRange('up to 71'), [null, 71]);
  assert.equal(parseRange(''), null);
  assert.throws(() => parseRange('about 5'));
});

test('the NASS parser reads three year tables, codes and the 2023 side by side layout', () => {
  const t2025 = [
    'Hop Area Harvested, Yield, and Production by Variety - States and United States: 2023-2025',
    '                  State                 :                   Area harvested                    ',
    'Idaho                                   :                                                     ',
    'Citra R, HBC 394 ...............        :      1,014               609               729      ',
    'Cascade ................................:        699               324               (D)      ',
    'Mt. Rainier ............................:         66                 -                 -      ',
    'Total ..................................:      8,645             5,797             5,102      ',
    'United States .......................   :     54,318            44,793            41,654      ',
  ].join('\n');
  const rows = parseNassVarietyTables(t2025, [2023, 2024, 2025]);
  const pick = (key, year) => rows.find((r) => r.key === key && r.year === year);
  assert.equal(pick('Citra', 2025).value, 729);
  assert.equal(pick('Citra', 2025).state, 'Idaho');
  assert.equal(pick('Cascade', 2025).value, null);
  assert.equal(pick('Cascade', 2025).code, 'D');
  assert.equal(pick('Mt. Rainier', 2024).value, 0);
  assert.equal(pick('Total', 2025).value, 5102);
  assert.equal(rows.find((r) => r.state === 'United States' && r.year === 2025).value, 41654);
  const t2023 = [
    'Hop Area Harvested, Yield, and Production by Variety - States and',
    '             State            :    Area harvested     :    Yield per acre     ',
    'Idaho                         :                                               ',
    'Citra R, HBC 394 .....        : 1,743   1,767   1,014   1,413   1,515   1,581 ',
  ].join('\n');
  const old = parseNassVarietyTables(t2023, [2021, 2022, 2023]);
  assert.equal(old.find((r) => r.measure === 'area' && r.year === 2021).value, 1743);
  assert.equal(old.find((r) => r.measure === 'yield' && r.year === 2023).value, 1581);
  assert.equal(nassKey('Columbus/Tomahawk R /Zeus (CTZ)'), 'Columbus/Tomahawk');
  assert.equal(nassKey('Talus HBC 692 ....'), 'Talus');
  assert.equal(nassKey('HBC 682 ....'), 'HBC 682');
});

test('acreage rows match the National Hop Report and reference real varieties', () => {
  assert.deepEqual(checkAcreageRows(acreage, varieties), []);
  const row = (v, s, y) => acreage.find((r) => r.variety === v && r.state === s && r.year === y);
  assert.equal(row('citra', 'Washington', '2025').acres, '5327');
  assert.equal(row('citra', 'Washington', '2025').production_1000_lb, '8741.6');
  assert.equal(row('all-varieties', 'United States', '2025').acres, '41654');
  assert.equal(row('cascade', 'Idaho', '2025').acres, '');
  assert.equal(row('cascade', 'Idaho', '2025').acres_code, 'D');
  assert.equal(row('citra', 'Idaho', '2021').acres, '1743');
  assert.equal(row('citra', 'Idaho', '2022').acres, '1767');
});

test('US acreage applies only to US grown varieties', () => {
  for (const v of varieties.filter((x) => x.nass_label)) assert.equal(v.us_grown, 'yes', `${v.slug} has a NASS line but is not marked US grown`);
  for (const slug of ['galaxy', 'nelson-sauvin', 'hallertau-blanc', 'nectaron']) {
    const v = varieties.find((x) => x.slug === slug);
    assert.equal(v.us_grown, 'no', slug);
    assert.equal(acreage.some((r) => r.variety === slug), false, slug);
  }
});
