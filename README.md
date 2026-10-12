# 2026-GABF-Analysis

Analysis of the Great American Beer Festival awards, published as a static site on GitHub Pages: interactive dashboards over every medal (year, medal, classic or special category, style family, category, region, state, brewery type, ownership, distribution, ABV band, search), a US map, reports for top breweries, top categories by total entrants, states and per-capita rates, regions, ownership and investors, economics, trends, and Brewery of the Year, and a markdown deep dive per brewery with locations, ownership, distributors, estimated barrels, ARR, margins, and a ten-year medal trend that says plainly when a brewery did not exist yet.

The pipeline is built so that the moment the Brewers Association posts the official winners list, one command loads it, enriches every brewery, and republishes the site. Charts are Apache ECharts (about 60,000 GitHub stars), vendored at build time so the site has no runtime network dependency; every chart has a table view and a save-as-PNG button.

## open-it-locally

The whole dashboard is also built as one self-contained file, [gabf-dashboard.html](gabf-dashboard.html). Open it by double-click or from a terminal: ECharts, the US map, every medal row, and the brewery deep dives are embedded, so it needs no server and no internet. It has seven tabs (Overview, Geography, Categories, Breweries, Ownership and economics, Data, About) under one filter row, with click-through charts, a brewery picker with profile card and deep dive, and light and dark themes.

```bash
open /Users/kevinlappe/projects/active/2026-GABF-Analysis/gabf-dashboard.html
```

Regenerate it after loading new results or editing a brewery profile:

```bash
cd /Users/kevinlappe/projects/active/2026-GABF-Analysis && npm run build:standalone
```

## quick-start

```bash
cd /Users/kevinlappe/projects/active/2026-GABF-Analysis && npm ci && npm run verify && npm run serve
```

Open http://localhost:8080/ for the overview dashboard, http://localhost:8080/dashboards/ for the others, and http://localhost:8080/breweries/green-cheek-beer-co/ for the Green Cheek Beer Co. deep dive.

## the-2026-results

The 2026 awards were announced on October 11, 2026: 336 medals to 243 breweries and cideries from 7,267 entries. The official PDF is loaded with one command once it is posted:

```bash
cd /Users/kevinlappe/projects/active/2026-GABF-Analysis && node scripts/new-year.mjs --year 2026
```

That fetches the PDF (or pass `--url` with the link from the Brewers Association release, `--pdf` with a downloaded file, or `--csv` with a hand-made sheet), parses every category with its total entrants, looks every brewery up in Open Brewery DB, runs the tests, and rebuilds dist/. Until then, 2026 carries seed rows confirmed from day-of coverage (Green Cheek's gold and two bronzes, Craft Coast's Brewery of the Year golds, and a handful of category rows with entry counts).

Before the PDF exists, the awards ceremony stream can be transcribed into a draft:

```bash
cd /Users/kevinlappe/projects/active/2026-GABF-Analysis && yt-dlp --write-auto-sub --sub-lang en --skip-download -o ceremony-2026 "https://www.youtube.com/live/EhJtEzE5wbg" && node scripts/import-ceremony-transcript.mjs --year 2026 --input ceremony-2026.en.vtt
```

Every drafted row carries a confidence and is replaced wholesale by the official list. Full detail: [docs/runbook-new-year.md](docs/runbook-new-year.md).

## dashboards

| dashboard | panels |
|---|---|
| Overview (home) | stat tiles, medals by year (click a column), US map (click a state), medals by style family, top breweries by points, results table, CSV download |
| Geography | US map, Census regions and divisions, medals per million residents |
| Categories | total entrants by category with special categories marked, classic versus special by year, category size versus medal spread |
| Breweries | pick any brewery: ten-year trend with did-not-exist and pending years, medals by category, medals by location credited |
| Ownership and economics | ownership share, parent companies, estimated revenue, and a financial table (barrels, ARR, gross margin, EBITDA range, distribution, ownership) |

One filter row scopes every panel and the table on a page, filters live in the URL hash so a view can be shared, and each chart's toolbox saves a PNG or opens the data.

## what-is-in-the-repository

| path | purpose |
|---|---|
| gabf-dashboard.html | generated single-file dashboard, committed so it opens without building (regenerate with `npm run build:standalone`) |
| data/results/gabf-YYYY.csv | one normalized row per medal per year (official list once ingested; seed rows marked "Partial seed" until then; transcript drafts under data/results/drafts/) |
| data/results/year-summary.csv, brewery-of-the-year.csv, world-beer-cup.csv | competition totals, size-bracket awards, other competitions |
| data/reference/ | categories with style families, special flag, and ranges; states with regions and population; ownership and investors; distributors; production; ABV overrides; brewery overrides; estimation parameters with their benchmark sources |
| data/enriched/breweries.json | Open Brewery DB enrichment plus overrides (generated, committed) |
| breweries/*.md | brewery deep dives with frontmatter the build reads (locations, founded, employees, distribution channel, known for, estimates) |
| scripts/ | fetch, parse, import CSV, import ceremony transcript, import style guidelines, enrich, build geo, build site, render visuals, scaffold a brewery, check prose |
| site/assets/ | stylesheet, chart option builders, ECharts bootstrap, dashboards client, shared page script, US states GeoJSON |
| .github/workflows/ | deploy-pages (build and publish on push to main) and ingest-results (scheduled and manual ingest) |
| .mcp.json | the unofficial Open Brewery DB MCP server, so an agent session in this repository can look breweries up directly |
| docs/ | architecture, data sources, data dictionary, estimation method, research playbook, runbook |

## commands

| command | what it does |
|---|---|
| `npm run fetch -- --year 2026 [--url <pdf>]` | download the official winners list PDF to data/raw/ |
| `npm run parse -- --year 2026 [--input file.pdf]` | parse the PDF (or extracted text) into data/results/gabf-2026.csv and report unparsed lines |
| `npm run import-csv -- --year 2026 --input file.csv` | normalize a hand-made results sheet instead |
| `node scripts/import-ceremony-transcript.mjs --year 2026 --input captions.vtt [--promote]` | draft rows from the awards ceremony captions |
| `npm run styles -- --input guidelines.pdf --year 2026` | refresh category ABV, IBU, and SRM ranges from the Brewers Association style guidelines |
| `npm run enrich [-- --all | --offline]` | Open Brewery DB lookups into data/enriched/breweries.json |
| `npm run build` | render dist/ (also regenerates the US map GeoJSON if missing) |
| `npm run build:standalone` | regenerate gabf-dashboard.html, the single-file dashboard |
| `npm run serve` | preview dist/ at http://localhost:8080/ |
| `npm run render-visuals -- --brewery green-cheek-beer-co` | PNG charts and page captures into reports/ (needs Playwright) |
| `node scripts/scaffold-brewery.mjs --brewery "Name"` | start a deep dive from the loaded data, with a research checklist |
| `npm run verify` | prose check, tests, site build, single-file build |

All commands assume the checkout at /Users/kevinlappe/projects/active/2026-GABF-Analysis; run them as `npm --prefix /Users/kevinlappe/projects/active/2026-GABF-Analysis run <name>` from anywhere.

## existing-tools-this-builds-on

- Open Brewery DB (free API, 40,000 plus breweries) for locations and types, and the unofficial `@jimbuck/open-brewery-db-mcp` server configured in .mcp.json for agent lookups. No MCP server exists for GABF results, Untappd (its API is closed), or BeerAdvocate; this repository's CSVs are the GABF dataset.
- Brewers Association Beer Style Guidelines for category definitions and ranges; Brewers Association financial benchmarking for revenue and cost per barrel.
- Apache ECharts for charts and the map, us-atlas for state boundaries, unpdf for PDF text, marked for markdown, yaml for frontmatter.

## privacy

A GitHub Pages site is public even when the repository is private (private-repository Pages needs a paid plan, and access control needs GitHub Enterprise Cloud). For a private copy, build locally and open dist/index.html, or publish dist/ behind authentication on Cloudflare Pages with Access or Netlify with password protection. Nothing in the site depends on the host.

## current-data-state

2026 is partial (seed rows from October 11 coverage) until the official PDF is ingested. 2018, 2019, 2024, and 2025 carry Green Cheek seed rows (partial); 2020 through 2023 are pending. Reference tables (ownership, distributors, production, categories) are curated starting points with verification flags; every financial figure is an estimate (E).

## license

MIT for the code. Results are the Brewers Association's published competition outcomes; style guideline ranges are used with attribution for non-commercial analysis; brewery location data comes from Open Brewery DB; Apache ECharts is Apache 2.0; us-atlas boundaries derive from US Census Bureau data.
