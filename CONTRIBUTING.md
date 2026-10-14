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

1. `npm run docs:check` and `npm run check`: the generated hop and brewery docs are current, and markdown prose rules (see Writing style below).
2. `npm run brand:check`: the committed brand outputs match the design settings.
3. `npm test`: runs `npm run generate` (the single file pages) and then the node test runner suites in `tests/`.
4. `npm run validate` and `npm run hops:check`: structural checks on every medal row, the year totals, and the hop tables.
5. `npm run build`: the site into `dist/`.
6. `npm run design:check` and `npm run design-system:check`: the design control plane and the design system.

The single file pages (`gabf-dashboard.html`, `gabf-explorer.html`, and `docs/design/chart-gallery/index.html`) are build outputs and are not committed; CI and the deploy build them. CI also builds the web/ app and runs the rendered design system audit (`npm run web:build && npm run design-system:audit`, which needs Playwright Chromium: `npx playwright install chromium`).

## Data rules

These keep the dataset trustworthy. A pull request that breaks one will be asked to change.

- **Official winners lists win.** Rows whose notes say "Partial seed" are placeholders from secondary sources and are replaced wholesale once a year's official list is ingested. Do not hand patch an ingested year to match a news story.
- **Estimates are marked (E).** Every estimate must trace to `data/reference/estimation-parameters.json`, `data/reference/production.csv`, or a brewery profile.
- **Ownership needs a primary source.** Set an ownership row's `verified` flag to yes only after checking a primary source, and name that source.
- **Generated files are never hand edited.** Change the inputs and rebuild `dist/`, `data/enriched/breweries.json`, `data/enriched/winners-2026.sqlite`, and the single file pages.
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

Keep each pull request to one concern, describe what changed and how you verified it, and fill in the checklist in the template. The ci workflow runs every gate on each pull request as the `build` check, and branch protection on main requires it to pass before merge.

Merge with auto-merge, never by hand: `gh pr merge <number> --auto --merge` queues the merge and GitHub completes it when `build` passes. After a merge, the deploy workflow publishes main to GitHub Pages; see [docs/deployment.md](docs/deployment.md).
