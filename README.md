# 2026-GABF-Analysis

Analysis of the Great American Beer Festival awards, published as a static site on GitHub Pages: every medal browsable by year, category, style family, state, region, brewery, brewery type, ownership, and ABV band; reports for top breweries, top categories, states and per-capita rates, regions, ownership and investors, trends, and Brewery of the Year; and a markdown deep dive per brewery with locations, ownership, scale estimates, and a five-year medal trend that says plainly when a brewery did not exist yet.

The pipeline is built so that the moment the Brewers Association posts the official winners list, one command loads it, enriches every brewery, and republishes the site.

## quick-start

```bash
cd /Users/kevinlappe/projects/active/2026-GABF-Analysis && npm ci && npm run verify && npm run serve
```

Open http://localhost:8080/ for the explorer, http://localhost:8080/breweries/green-cheek-beer-co/ for the Green Cheek Beer Co. deep dive and visuals.

## when-the-2026-results-drop

```bash
cd /Users/kevinlappe/projects/active/2026-GABF-Analysis && node scripts/new-year.mjs --year 2026
```

That fetches the official PDF (or pass `--url` with the link from the Brewers Association release, `--pdf` with a downloaded file, or `--csv` with a hand-made sheet), parses it into data/results/gabf-2026.csv, looks every brewery up in Open Brewery DB, runs the tests, and rebuilds dist/. Review the parse report, commit data/, push to main, and the deploy-pages workflow publishes. The ingest-results workflow does the same unattended every two hours from October 11 to 20 and can be triggered by hand from the Actions tab. Full detail: [docs/runbook-new-year.md](docs/runbook-new-year.md).

## what-is-in-the-repository

| path | purpose |
|---|---|
| data/results/gabf-YYYY.csv | one normalized row per medal per year (official list once ingested; seed rows marked "Partial seed" until then) |
| data/results/year-summary.csv, brewery-of-the-year.csv, world-beer-cup.csv | competition totals, size-bracket awards, other competitions |
| data/reference/ | categories and style ranges, states with regions and population, ownership and investors, production, ABV overrides, brewery overrides, estimation parameters |
| data/enriched/breweries.json | Open Brewery DB enrichment plus overrides (generated, committed) |
| breweries/*.md | brewery deep dives with frontmatter the build reads (locations, founded, known for, estimates) |
| scripts/ | fetch, parse, import, enrich, build, render visuals, scaffold a brewery, check prose |
| site/assets/ | stylesheet, chart module, explorer script, shared page script |
| .github/workflows/ | deploy-pages (build and publish on push to main) and ingest-results (scheduled and manual ingest) |
| docs/ | architecture, data sources, data dictionary, estimation method, runbook |

## commands

| command | what it does |
|---|---|
| `npm run fetch -- --year 2026 [--url <pdf>]` | download the official winners list PDF to data/raw/ |
| `npm run parse -- --year 2026 [--input file.pdf]` | parse the PDF (or extracted text) into data/results/gabf-2026.csv and report unparsed lines |
| `npm run import-csv -- --year 2026 --input file.csv` | normalize a hand-made results sheet instead |
| `npm run styles -- --input guidelines.pdf --year 2026` | refresh category ABV, IBU, and SRM ranges from the Brewers Association style guidelines |
| `npm run enrich [-- --all | --offline]` | Open Brewery DB lookups into data/enriched/breweries.json |
| `npm run build` | render dist/ |
| `npm run serve` | preview dist/ at http://localhost:8080/ |
| `npm run render-visuals -- --brewery green-cheek-beer-co` | PNG charts and page captures into reports/ (needs Playwright) |
| `node scripts/scaffold-brewery.mjs --brewery "Name"` | start a deep dive from the loaded data, with a research checklist |
| `npm run verify` | prose check, tests, build |

All commands assume the checkout at /Users/kevinlappe/projects/active/2026-GABF-Analysis; run them as `npm --prefix /Users/kevinlappe/projects/active/2026-GABF-Analysis run <name>` from anywhere.

## current-data-state

The 2026 awards were presented on October 11, 2026, and the official list had not been published when this pipeline was built, so 2026 shows as pending. Years 2018, 2019, 2024, and 2025 carry seed rows for Green Cheek Beer Co. from secondary sources (marked partial); 2020 through 2023 are pending. Running the fetch and parse for each year replaces the seeds with the complete official lists. Reference tables (ownership, production, categories) are curated starting points with verification flags.

## license

MIT for the code. Results are the Brewers Association's published competition outcomes; style guideline ranges are used with attribution for non-commercial analysis; brewery location data comes from Open Brewery DB.
