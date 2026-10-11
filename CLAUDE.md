# CLAUDE.MD

Standing rules for every agent working in this repository.

## what-this-is

A static Great American Beer Festival results explorer published to GitHub Pages. Official winners lists are parsed into CSV, breweries are enriched from Open Brewery DB and curated reference tables, brewery deep dives live in markdown, and a Node build renders the site. Read [README.md](README.md) and [docs/architecture.md](docs/architecture.md) first; the runbook for a new year's results is [docs/runbook-new-year.md](docs/runbook-new-year.md).

## gates

The full gate is `verify`, mandatory before a push even when a focused check passes:

```bash
npm --prefix /Users/kevinlappe/projects/active/2026-GABF-Analysis run verify
```

It runs `check` (markdown prose rules), `test` (node test runner), and `build` (the site into dist/). `npm run serve` previews dist/ locally.

## data-rules

- Official winners lists win. A row whose notes say "Partial seed" is a placeholder from secondary sources and is replaced wholesale when the year's list is ingested.
- Every estimate is marked (E) and traceable to data/reference/estimation-parameters.json, data/reference/production.csv, or a brewery profile.
- Ownership rows carry a `verified` flag; set it to yes only after checking a primary source, and name the source.
- Generated outputs (dist/, data/enriched/breweries.json) are never hand-edited; change the inputs and rebuild.
- Never fabricate medals, figures, or sources. A gap stated plainly beats a guess.

## writing

No dash as punctuation anywhere in any file, including code comments and chart labels: use commas, colons, periods, or parentheses, and write ranges as "3 to 5". Every markdown paragraph and list item is one physical line. Headings are lowercase kebab-case. Filenames are lowercase kebab-case. Nothing in this repository credits a coding agent, model, or runtime.
