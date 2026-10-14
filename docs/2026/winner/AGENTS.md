# AGENTS.MD

This folder holds one markdown profile per GABF 2026 medal (336 files): style, ABV, IBU, hops, malts, yeast, adjuncts, the brewery's own description, and links to the beer on the brewery's site. A SQLite database built from these files is the way to traverse them. Read this file before touching either.

## source-and-output-boundary

The profiles in this folder are the source. The database is generated output and is never hand-edited: change a profile, then rebuild.

```bash
cd /Users/kevinlappe/projects/active/gabf-analysis && node scripts/build-winner-db.mjs 2026
```

The build writes `data/enriched/winners-2026.sqlite` from scratch on every run and needs Node 22 or newer. The database is a local build output and is not in git: never commit it, `gabf-dashboard.html`, or `gabf-explorer.html` on a research branch. `npm run generate`, `npm run build`, CI, and the deploy rebuild them from the profiles.

## file-names

`<category-number>-<category-style>-<place>-<brewery>-<beer>.md`, lowercase kebab-case. The category number is zero padded to three digits so files sort (special categories reach 501). Place is 1 for gold, 2 for silver, 3 for bronze. A file name without `.md` is the beer's `id` in the database.

## profile-format

Each profile opens with frontmatter, then lowercase kebab-case sections: `award`, `specs`, `brewery-description`, `ingredients`, `style-context`, `links`, `research-notes`.

- Structured keys: `abv`, `ibu`, `style`, `hops`, `malts`, `yeast`, `adjuncts`, `beer-url`, `brewery-url`, `sources`, `medal`, `place`, `category-number`, `category-name`, `entries`, `brewery`, `brewery-city`, `brewery-state`.
- `null` or `[]` means the value was looked for and not published, never that it is zero. The `research-notes` section says what was tried.
- Official winners lists win. Nothing here is estimated; an estimate belongs in `breweries/` and carries the (E) mark.
- The repository is public: profiles carry no `models`, `providers` or `session-link` keys.

## querying

Open the database read-only. Tables: `beers`, `breweries`, `categories`, `ingredients` (kind is hop, malt, yeast or adjunct), `beer_ingredients`, `sources`, and the full text index `beers_fts`, plus the district and indicator tables below. Views: `v_beer_ingredients`, `v_brewery_medals`, `v_hop_usage`, and the district views below.

```bash
sqlite3 -readonly /Users/kevinlappe/projects/active/gabf-analysis/data/enriched/winners-2026.sqlite "SELECT hop, beers FROM v_hop_usage LIMIT 10"
```

To traverse: start at `categories` or `breweries`, join to `beers` on `category_number` or `brewery`, then to `beer_ingredients` and `ingredients` for what is in the glass, or to `sources` for the pages behind a row. To read the prose, open the file named by `beers.file`. Full text search: `SELECT id FROM beers_fts WHERE beers_fts MATCH 'grapefruit'`.

## districts-and-indicators

The build also loads five reference tables from `data/reference/` so medals can be joined to Federal Reserve districts and to population, GDP, and demographic controls. They are copies of committed CSVs; change the CSVs through their scripts (`scripts/build-fed-districts.mjs`, then `scripts/fetch-state-indicators.mjs`), never by hand. Sources and method are in `docs/data-sources.md` and `docs/estimation-method.md`.

| table | key | holds |
|---|---|---|
| `fed_districts` | `state` | district_number, district_name, split (yes or no), secondary_districts, source, verified (no marks the West Virginia approximation) |
| `fed_district_counties` | `county_fips` | every county of a split state with its district_number and basis (named in a Reserve Bank list, or the complement) |
| `medal_city_counties` | `state`, `city` | each medal city in a split state with county_fips (several joined by `;` when a city spans counties in one district), district_number, source, verified, note |
| `state_indicators` | `state`, `year`, `indicator` | population, gdp_real, gdp_nominal, gdp_per_capita_real (2018 to 2026, 2026 using 2025), ACS 2024 controls, urban_share 2020, literacy (modeled), life_expectancy 2022, each with unit, source, source_url, verified |
| `district_indicators` | `district_number`, `year`, `indicator` | district population, gdp_real, gdp_nominal, gdp_per_capita_real; split state GDP is apportioned and marked `estimate (E)` |

Views: `v_beer_district` (each beer with its brewery's district and `district_method`: state, county, approximation, or approximation (city not resolved)), `v_state_medal_rates` and `v_district_medal_rates` (medals, population, real GDP, medals per million, and medals per $100 billion of real GDP by geography and year).

```bash
sqlite3 -readonly /Users/kevinlappe/projects/active/gabf-analysis/data/enriched/winners-2026.sqlite "SELECT district_number, district_name, medals, ROUND(medals_per_million, 2) FROM v_district_medal_rates ORDER BY medals_per_million DESC"
```

The join runs from `beers.brewery` to `breweries` (city and state from the profile frontmatter) to `medal_city_counties` and `fed_districts`. A profile whose city is spelled differently from the winners list falls back to the state's majority district and says so in `district_method`.

## editing

Follow the repository writing rules: no dash as punctuation, one physical line per paragraph, lowercase kebab-case headings, no credit to any agent or model. Never fabricate a figure, hop, or link; a stated gap beats a guess. After editing profiles, rebuild the database, then run the gate.

```bash
cd /Users/kevinlappe/projects/active/gabf-analysis && npm run verify
```
