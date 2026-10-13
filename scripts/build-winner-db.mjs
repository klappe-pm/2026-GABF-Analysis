#!/usr/bin/env node
// Builds a queryable SQLite database from the beer profiles in docs/<year>/winner/.
// Usage: node scripts/build-winner-db.mjs [year]   (default 2026)
// Output: data/enriched/winners-<year>.sqlite, rebuilt from scratch on every run.
// Needs Node 22 or newer for node:sqlite.

import { mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import YAML from 'yaml';
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

const SCHEMA = `
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

function main() {
  mkdirSync(outDir, { recursive: true });
  rmSync(out, { force: true });
  const db = new DatabaseSync(out);
  db.exec(SCHEMA);
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
  console.log(`${out}: ${count} beers from ${files.length} files${fts ? ' (fts5 on)' : ''}`);
  db.close();
}

if (import.meta.url === `file://${process.argv[1]}`) main();
