# Contributing to GABF Analysis

Thank you for helping. The most valuable contributions are data corrections backed by a source, parser fixes for a new winners list layout, and clearer dashboards. Please read the [Code of Conduct](CODE_OF_CONDUCT.md) first.

## Set up

You need Node 22 or newer, which is what CI runs: the test suite and the SQLite scripts (`scripts/build-winner-db.mjs` and `scripts/build-explorer.mjs`) use the built in `node:sqlite` module.

```bash
git clone https://github.com/klappe-pm/GABF-Analysis.git && cd GABF-Analysis && npm ci
```

Preview the site while you work:

```bash
cd GABF-Analysis && npm run build && npm run serve
```

The site is at http://localhost:8080/. Every command runs from the repository root.

## The verify gate

Run the full gate before you push, even when a focused check already passes:

```bash
cd GABF-Analysis && npm run verify
```

It runs, in order:

1. `npm run check`: markdown prose rules (see Writing style below).
2. `npm test`: the node test runner suites in `tests/`.
3. `npm run validate`: structural checks on every medal row and the year totals.
4. `npm run build`: the site into `dist/`.
5. `npm run build:standalone`: regenerates `gabf-dashboard.html`.

`gabf-dashboard.html` is committed. If your change touches data or dashboard code, commit the regenerated file too; CI fails when it is stale.

## Data rules

These keep the dataset trustworthy. A pull request that breaks one will be asked to change.

- **Official winners lists win.** Rows whose notes say "Partial seed" are placeholders from secondary sources and are replaced wholesale once a year's official list is ingested. Do not hand patch an ingested year to match a news story.
- **Estimates are marked (E).** Every estimate must trace to `data/reference/estimation-parameters.json`, `data/reference/production.csv`, or a brewery profile.
- **Ownership needs a primary source.** Set an ownership row's `verified` flag to yes only after checking a primary source, and name that source.
- **Generated files are never hand edited.** Change the inputs and rebuild `dist/`, `data/enriched/breweries.json`, `data/enriched/winners-2026.sqlite`, and `gabf-dashboard.html`.
- **Never fabricate.** No invented medals, figures, or sources. A gap stated plainly beats a guess.

## Proposing a data correction

1. Open a [data correction issue](https://github.com/klappe-pm/GABF-Analysis/issues/new?template=data-correction.yml). It asks for the year, category, medal, brewery, what is wrong, and a source URL.
2. Link a primary source when one exists: the Brewers Association's official winners list, the brewery's own site, or a filing. Secondary sources are fine for context but will be labeled as such.
3. If you want to fix it yourself, edit the input (a CSV under `data/results/` or `data/reference/`, or a markdown profile), run `npm run verify`, and open a pull request that links the issue.

## Writing style

The prose checker enforces these on every markdown file:

- No dash used as punctuation: no em dash, en dash, spaced hyphen, or double hyphen. Use a comma, colon, period, or parentheses, and write ranges as "2018 to 2026". Hyphens inside words and in code are fine.
- One physical line per paragraph and per list item; let the editor wrap.
- Headings are lowercase kebab case (for example `## data-rules`), except in the public facing README.md, CONTRIBUTING.md, SECURITY.md, CODE_OF_CONDUCT.md, CHANGELOG.md, PRODUCT.md, DESIGN.md, and files under `.github/`.
- File names are lowercase kebab case.

The no dash rule also applies to code comments and chart labels.

## Pull requests

Keep each pull request to one concern, describe what changed and how you verified it, and fill in the checklist in the template. The deploy-pages workflow runs the same gates on every pull request; a green run is expected before merge.
