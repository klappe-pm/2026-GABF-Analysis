# AGENTS.MD

This folder holds one markdown profile per GABF 2026 medal (336 files): style, ABV, IBU, hops, malts, yeast, adjuncts, the brewery's own description, and links to the beer on the brewery's site. A SQLite database built from these files is the way to traverse them. Read this file before touching either.

## source-and-output-boundary

The profiles in this folder are the source. The database is generated output and is never hand-edited: change a profile, then rebuild.

```bash
cd /Users/kevinlappe/projects/active/gabf-analysis && node scripts/build-winner-db.mjs 2026
```

The build writes `data/enriched/winners-2026.sqlite` from scratch on every run and needs Node 22 or newer.

## file-names

`<category-number>-<category-style>-<place>-<brewery>-<beer>.md`, lowercase kebab-case. The category number is zero padded to three digits so files sort (special categories reach 501). Place is 1 for gold, 2 for silver, 3 for bronze. A file name without `.md` is the beer's `id` in the database.

## profile-format

Each profile opens with frontmatter, then lowercase kebab-case sections: `award`, `specs`, `brewery-description`, `ingredients`, `style-context`, `links`, `research-notes`.

- Structured keys: `abv`, `ibu`, `style`, `hops`, `malts`, `yeast`, `adjuncts`, `beer-url`, `brewery-url`, `sources`, `medal`, `place`, `category-number`, `category-name`, `entries`, `brewery`, `brewery-city`, `brewery-state`.
- `null` or `[]` means the value was looked for and not published, never that it is zero. The `research-notes` section says what was tried.
- Official winners lists win. Nothing here is estimated; an estimate belongs in `breweries/` and carries the (E) mark.
- The repository is public: profiles carry no `models`, `providers` or `session-link` keys.

## querying

Open the database read-only. Tables: `beers`, `breweries`, `categories`, `ingredients` (kind is hop, malt, yeast or adjunct), `beer_ingredients`, `sources`, and the full text index `beers_fts`. Views: `v_beer_ingredients`, `v_brewery_medals`, `v_hop_usage`.

```bash
sqlite3 -readonly /Users/kevinlappe/projects/active/gabf-analysis/data/enriched/winners-2026.sqlite "SELECT hop, beers FROM v_hop_usage LIMIT 10"
```

To traverse: start at `categories` or `breweries`, join to `beers` on `category_number` or `brewery`, then to `beer_ingredients` and `ingredients` for what is in the glass, or to `sources` for the pages behind a row. To read the prose, open the file named by `beers.file`. Full text search: `SELECT id FROM beers_fts WHERE beers_fts MATCH 'grapefruit'`.

## editing

Follow `CLAUDE.md` at the repository root: no dash as punctuation, one physical line per paragraph, lowercase kebab-case headings, no credit to any agent or model. Never fabricate a figure, hop, or link; a stated gap beats a guess. After editing profiles, rebuild the database, then run the gate.

```bash
cd /Users/kevinlappe/projects/active/gabf-analysis && npm run verify
```
