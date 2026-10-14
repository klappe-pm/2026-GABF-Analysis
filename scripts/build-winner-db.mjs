#!/usr/bin/env node
// Builds a queryable SQLite database from the beer profiles in docs/<year>/winner/.
// Usage: node scripts/build-winner-db.mjs [year]   (default 2026)
// Output: data/enriched/winners-<year>.sqlite, rebuilt from scratch on every run.
// Needs Node 22 or newer for node:sqlite.

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import YAML from 'yaml';
import { readCsvRecords } from './lib/csv.mjs';
import { ROOT } from './lib/paths.mjs';

const year = process.argv[2] || '2026';
const dir = resolve(ROOT, 'docs', year, 'winner');
const outDir = resolve(ROOT, 'data', 'enriched');
const out = resolve(outDir, `winners-${year}.sqlite`);

export function parseProfile(text, file) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`${file}: no frontmatter`);
  return { fm: YAML.parse(m[1]), body: m[2] };
}

function section(body, name) {
  const re = new RegExp(`^## ${name}\\s*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm');
  const hit = body.match(re);
  return hit ? hit[1].trim() : '';
}

export const SCHEMA = `
CREATE TABLE breweries (name TEXT PRIMARY KEY, city TEXT, state TEXT, url TEXT);
CREATE TABLE categories (number INTEGER PRIMARY KEY, name TEXT NOT NULL, entries INTEGER);
CREATE TABLE beers (
  id TEXT PRIMARY KEY, year INTEGER, category_number INTEGER REFERENCES categories(number),
  medal TEXT, place INTEGER, beer TEXT, brewery TEXT REFERENCES breweries(name),
  style TEXT, abv REAL, ibu REAL, beer_url TEXT, brewery_description TEXT, body TEXT, file TEXT
);
CREATE TABLE ingredients (id INTEGER PRIMARY KEY, kind TEXT NOT NULL, name TEXT NOT NULL, UNIQUE (kind, name));
CREATE TABLE beer_ingredients (beer_id TEXT REFERENCES beers(id), ingredient_id INTEGER REFERENCES ingredients(id), PRIMARY KEY (beer_id, ingredient_id));
CREATE TABLE sources (beer_id TEXT REFERENCES beers(id), url TEXT, PRIMARY KEY (beer_id, url));
CREATE VIEW v_beer_ingredients AS
  SELECT b.id AS beer_id, b.beer, b.brewery, b.medal, i.kind, i.name AS ingredient
  FROM beers b JOIN beer_ingredients bi ON bi.beer_id = b.id JOIN ingredients i ON i.id = bi.ingredient_id;
CREATE VIEW v_brewery_medals AS
  SELECT brewery, COUNT(*) AS medals, SUM(medal = 'Gold') AS gold, SUM(medal = 'Silver') AS silver, SUM(medal = 'Bronze') AS bronze
  FROM beers GROUP BY brewery;
CREATE VIEW v_hop_usage AS
  SELECT ingredient AS hop, COUNT(*) AS beers FROM v_beer_ingredients WHERE kind = 'hop' GROUP BY ingredient ORDER BY beers DESC;
`;

// Reference tables that let an agent join medals to Federal Reserve districts and to state and
// district denominators and controls. Loaded from the committed CSVs in data/reference.
const REFERENCE_SCHEMA = `
CREATE TABLE fed_districts (state TEXT PRIMARY KEY, district_number INTEGER, district_name TEXT, split TEXT, secondary_districts TEXT, source TEXT, verified TEXT);
CREATE TABLE fed_district_counties (county_fips TEXT PRIMARY KEY, state TEXT, county_name TEXT, district_number INTEGER, basis TEXT, source TEXT);
CREATE TABLE medal_city_counties (state TEXT, city TEXT, county_fips TEXT, county_name TEXT, district_number INTEGER, source TEXT, verified TEXT, note TEXT, PRIMARY KEY (state, city));
CREATE TABLE state_indicators (state TEXT, year INTEGER, indicator TEXT, value REAL, unit TEXT, source TEXT, source_url TEXT, verified TEXT, PRIMARY KEY (state, year, indicator));
CREATE TABLE district_indicators (district_number INTEGER, district_name TEXT, year INTEGER, indicator TEXT, value REAL, unit TEXT, source TEXT, source_url TEXT, verified TEXT, PRIMARY KEY (district_number, year, indicator));
CREATE VIEW v_beer_district AS
  SELECT b.id AS beer_id, b.year, b.medal, b.beer, b.brewery, br.city, br.state,
    COALESCE(m.district_number, f.district_number) AS district_number,
    COALESCE((SELECT f2.district_name FROM fed_districts f2 WHERE f2.district_number = m.district_number LIMIT 1), f.district_name) AS district_name,
    CASE WHEN f.state IS NULL THEN NULL WHEN f.split = 'no' THEN 'state' WHEN f.verified <> 'yes' THEN 'approximation'
      WHEN m.district_number IS NOT NULL THEN 'county' ELSE 'approximation (city not resolved)' END AS district_method
  FROM beers b JOIN breweries br ON br.name = b.brewery
  LEFT JOIN fed_districts f ON f.state = br.state
  LEFT JOIN medal_city_counties m ON m.state = br.state AND m.city = br.city;
CREATE VIEW v_state_medal_rates AS
  SELECT d.state, d.year, COUNT(*) AS medals, p.value AS population, g.value AS gdp_real_millions,
    COUNT(*) * 1e6 / p.value AS medals_per_million, COUNT(*) * 1e5 / g.value AS medals_per_100b_real_gdp
  FROM v_beer_district d
  LEFT JOIN state_indicators p ON p.state = d.state AND p.year = d.year AND p.indicator = 'population'
  LEFT JOIN state_indicators g ON g.state = d.state AND g.year = d.year AND g.indicator = 'gdp_real'
  GROUP BY d.state, d.year;
CREATE VIEW v_district_medal_rates AS
  SELECT d.district_number, d.district_name, d.year, COUNT(*) AS medals, p.value AS population, g.value AS gdp_real_millions,
    COUNT(*) * 1e6 / p.value AS medals_per_million, COUNT(*) * 1e5 / g.value AS medals_per_100b_real_gdp
  FROM v_beer_district d
  LEFT JOIN district_indicators p ON p.district_number = d.district_number AND p.year = d.year AND p.indicator = 'population'
  LEFT JOIN district_indicators g ON g.district_number = d.district_number AND g.year = d.year AND g.indicator = 'gdp_real'
  WHERE d.district_number IS NOT NULL
  GROUP BY d.district_number, d.year;
`;

const REFERENCE_TABLES = [
  ['fed_districts', 'fed-districts.csv', ['state', 'district_number', 'district_name', 'split', 'secondary_districts', 'source', 'verified']],
  ['fed_district_counties', 'fed-district-counties.csv', ['county_fips', 'state', 'county_name', 'district_number', 'basis', 'source']],
  ['medal_city_counties', 'medal-city-counties.csv', ['state', 'city', 'county_fips', 'county_name', 'district_number', 'source', 'verified', 'note']],
  ['state_indicators', 'state-indicators.csv', ['state', 'year', 'indicator', 'value', 'unit', 'source', 'source_url', 'verified']],
  ['district_indicators', 'district-indicators.csv', ['district_number', 'district_name', 'year', 'indicator', 'value', 'unit', 'source', 'source_url', 'verified']],
];

export function addReferenceTables(db, referenceDir = resolve(ROOT, 'data', 'reference')) {
  db.exec(REFERENCE_SCHEMA);
  const counts = {};
  for (const [table, file, cols] of REFERENCE_TABLES) {
    const path = resolve(referenceDir, file);
    const rows = existsSync(path) ? readCsvRecords(readFileSync(path, 'utf8')) : [];
    const ins = db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`);
    db.exec('BEGIN');
    for (const r of rows) ins.run(...cols.map((c) => (r[c] === '' || r[c] === undefined ? null : r[c])));
    db.exec('COMMIT');
    counts[table] = rows.length;
  }
  return counts;
}

function main() {
  mkdirSync(outDir, { recursive: true });
  // Build beside the target and swap in only on success, so a profile caught mid-edit leaves the
  // previous database in place.
  const tmp = `${out}.tmp`;
  rmSync(tmp, { force: true });
  const db = new DatabaseSync(tmp);
  db.exec(SCHEMA);
  addReferenceTables(db);
  let fts = true;
  try { db.exec('CREATE VIRTUAL TABLE beers_fts USING fts5(id UNINDEXED, beer, brewery, style, body)'); } catch { fts = false; }

  const insBrewery = db.prepare('INSERT OR IGNORE INTO breweries VALUES (?, ?, ?, ?)');
  const insCat = db.prepare('INSERT OR IGNORE INTO categories VALUES (?, ?, ?)');
  const insBeer = db.prepare('INSERT INTO beers VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const insIng = db.prepare('INSERT OR IGNORE INTO ingredients (kind, name) VALUES (?, ?)');
  const getIng = db.prepare('SELECT id FROM ingredients WHERE kind = ? AND name = ?');
  const link = db.prepare('INSERT OR IGNORE INTO beer_ingredients VALUES (?, ?)');
  const insSrc = db.prepare('INSERT OR IGNORE INTO sources VALUES (?, ?)');
  const insFts = fts ? db.prepare('INSERT INTO beers_fts VALUES (?, ?, ?, ?, ?)') : null;

  // Profiles start with the category number; AGENTS.md and other notes are skipped.
  const files = readdirSync(dir).filter((f) => /^\d{3}-.+\.md$/.test(f)).sort();
  db.exec('BEGIN');
  for (const file of files) {
    const { fm, body } = parseProfile(readFileSync(resolve(dir, file), 'utf8'), file);
    const id = file.replace(/\.md$/, '');
    insBrewery.run(fm.brewery, fm['brewery-city'] ?? null, fm['brewery-state'] ?? null, fm['brewery-url'] ?? null);
    insCat.run(fm['category-number'], fm['category-name'], fm.entries ?? null);
    const desc = section(body, 'brewery-description');
    insBeer.run(id, Number(year), fm['category-number'], fm.medal, fm.place, fm.beer, fm.brewery, fm.style ?? null,
      fm.abv ?? null, fm.ibu ?? null, fm['beer-url'] ?? null, desc, body, file);
    for (const [kind, key] of [['hop', 'hops'], ['malt', 'malts'], ['yeast', 'yeast'], ['adjunct', 'adjuncts']]) {
      for (const name of fm[key] || []) {
        insIng.run(kind, String(name));
        link.run(id, getIng.get(kind, String(name)).id);
      }
    }
    for (const url of fm.sources || []) insSrc.run(id, String(url));
    if (insFts) insFts.run(id, fm.beer, fm.brewery, fm.style ?? '', body);
  }
  db.exec('COMMIT');
  const count = db.prepare('SELECT COUNT(*) AS n FROM beers').get().n;
  db.close();
  renameSync(tmp, out);
  console.log(`${out}: ${count} beers from ${files.length} files${fts ? ' (fts5 on)' : ''}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
