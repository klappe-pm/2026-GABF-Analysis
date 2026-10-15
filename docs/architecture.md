---
domain: beer
category: gabf-analysis
sub-category: docs
topics:
  - architecture
  - pipeline
types:
  - design
date-created: 2026-10-11
date-revised: 2026-10-15
status: ACCEPTED
aliases: []
tags: []
models:
  - claude-fable-5-1
providers:
  - Anthropic
session-link: https://claude.ai/code/session_017p8WkwJF1gqWYn98dKrcBw
---

# architecture

## shape

Four stages, each a Node script with no framework, chained by `scripts/new-year.mjs` and by the ingest-results workflow:

1. Ingest: `fetch-winners.mjs` downloads the official winners list PDF; `parse-winners.mjs` extracts text with unpdf and `lib/parse-winners-lib.mjs` turns it into one CSV row per medal plus Brewery of the Year awards. `import-results-csv.mjs` is the fallback for a hand-made sheet.
2. Enrich: `enrich-breweries.mjs` looks every brewery up in Open Brewery DB, scores candidates by normalized name and city, applies `data/reference/brewery-overrides.csv`, and writes `data/enriched/breweries.json`. `import-style-guidelines.mjs` refreshes ABV, IBU, and SRM ranges from the Brewers Association guidelines.
3. Model: `lib/data-model.mjs` loads every CSV, the markdown profiles, and the enrichment file into one dataset: decorated result rows (style family, ABV band, region, points), brewery entities (locations, ownership, production, estimates, yearly trend with did-not-exist handling, streaks), categories, coverage per year.
4. Publish: the Material 3 app in web/ (Next.js static export) renders every page into web/out (dashboards, breweries, categories, beers, hops, analysis, about, JSON and CSV exports), reading the dataset through `lib/site-payload.mjs` (decorated medal rows, the shared payload, estimate explanations); `build-standalone.mjs` writes the single file dashboard from the same payload. The ci workflow runs every gate as the required `build` check; every push to main is built by AWS CodeBuild (`buildspec.yml`), which puts web/out and the single file dashboard together with `assemble-site.mjs` and syncs the result to an S3 bucket behind CloudFront (AWS resources, caching, URL map, and DNS in [deployment.md](deployment.md)). `import-ceremony-transcript.mjs` is the stopgap between the live announcement and the PDF.

## why-static

The host serves files only (S3 behind CloudFront, no server code), and the dataset is small (a few hundred medals a year), so the Explore page filters in the browser over one JSON file and every other page is pre-rendered HTML. CloudFront is the only CDN; the web app is a Next.js static export with no server code, its charts are Apache ECharts bundled into the export, and the pipeline depends on unpdf (PDF text), marked (markdown), yaml (frontmatter), us-atlas and topojson-client (map).

## key-decisions

- Node and kebab-case files rather than Python: the owner's other repositories run Node scripts the same way, Python module names cannot be kebab-case, and the pipeline needs no scientific libraries.
- Apache ECharts draws every chart and the US map. The web app draws them through `web/components/ChartCard.tsx`; in the single file dashboard, option builders in `site/assets/chart-options.mjs` build options in the browser from the filtered slice and `site/assets/echarts-init.js` resolves CSS custom properties to concrete colors for the light theme and registers the map. ECharts is bundled into the export and inlined into the single file dashboard, so the site has no CDN dependency. The earlier hand-rolled SVG module was retired once the owner asked for a widely used library with manipulable dashboards.
- Medal colors follow the dataviz method: gold as the yellow slot, silver as the blue slot, bronze as the orange slot, validated for adjacency in both modes; every chart ships a legend, a hover layer, and a table view.
- Partial years are first-class: a row whose notes say "Partial seed" marks its year partial, the UI says so, and streaks skip partial years instead of counting them as misses.
- Brewery identity is a normalized key (`lib/slug.mjs`): corporate suffixes and location suffixes such as "(Costa Mesa)" are folded away so multi-location breweries roll up to one entity while the location credited is kept per medal.
- Estimates are explicit: an order of preference (reported, bracket, curated, heuristic), parameters in one JSON file, and an (E) mark everywhere an estimate is shown.

## directory-map

| path | role |
|---|---|
| scripts/lib/ | csv, slug, text, parser, style families, style guidelines, estimate, frontmatter, data model, site payload, paths |
| scripts/*.mjs | CLI stages and the orchestrator |
| site/assets/ | the single file dashboard's client (styles.css, charts.mjs, chart-options.mjs, echarts-init.js, dashboards.js, page.js, page-views.mjs, us-states.geo.json) and the filter, rate and sort modules the web app shares (filter-bar.mjs, rates.mjs, sort-order.mjs) |
| web/ | the Material 3 app (Next.js static export), the whole public site |
| data/ | raw (PDF text extracts), results, reference, enriched, cache (ignored) |
| breweries/ | local only and ignored by git: markdown deep dives, with template-brewery.md as the scaffold source; the published build has none |
| tests/ | node test runner suites with fixtures |
| docs/ | this document, data sources, data dictionary, estimation method, runbook |

## extension-points

- New competition: add a results CSV with the same columns and a `competition` value (World Beer Cup rows already live in data/results/world-beer-cup.csv and show on brewery pages).
- New report: add it to the analysis model (`web/lib/models/analysis.mjs`, whose report list the `web/app/(site)/analysis/[slug]/` route renders).
- New reference dimension (for example distributor or hop supplier): a CSV in data/reference keyed by brewery name, joined in data-model.mjs, surfaced in profileCard.
- Deep dive automation: `scaffold-brewery.mjs` creates the file and prints the research checklist; an agent can fill the sections from the listed sources.
