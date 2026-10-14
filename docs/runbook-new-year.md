---
domain: beer
category: gabf-analysis
sub-category: docs
topics:
  - runbook
  - ingest
types:
  - runbook
date-created: 2026-10-11
date-revised: 2026-10-13
status: ACCEPTED
aliases: []
tags: []
models:
  - claude-fable-5-1
providers:
  - Anthropic
session-link: https://claude.ai/code/session_017p8WkwJF1gqWYn98dKrcBw
---

# runbook-new-year

How to load a year's results the day they are published, and how to backfill earlier years. Every command runs from the repository root.

## the-one-command-path

```bash
node scripts/new-year.mjs --year 2026
```

If the fetch cannot find the PDF, open the Brewers Association release or greatamericanbeerfestival.com, copy the winners list PDF link, and rerun with the link:

```bash
node scripts/new-year.mjs --year 2026 --url "https://cdn.brewersassociation.org/.../GABF26-Winners-List.pdf"
```

Already downloaded the PDF? Point at it:

```bash
node scripts/new-year.mjs --year 2026 --pdf "$HOME/Downloads/GABF26-Winners-List.pdf"
```

## before-the-pdf-exists-the-ceremony-transcript

The awards ceremony is streamed (2026: https://www.youtube.com/live/EhJtEzE5wbg). Its auto captions can be drafted into rows within minutes of the ceremony:

```bash
yt-dlp --write-auto-sub --sub-lang en --skip-download -o ceremony-2026 "https://www.youtube.com/live/EhJtEzE5wbg" && node scripts/import-ceremony-transcript.mjs --year 2026 --input ceremony-2026.en.vtt
```

Install yt-dlp with `brew install yt-dlp` if needed. The draft lands in data/results/drafts/gabf-2026-transcript.csv with a confidence per row (category matched, brewery matched, state found). Review it, then add `--promote` to make it the year's working file; the official PDF replaces it wholesale when `npm run parse -- --year 2026` runs. Captions mishear beer and brewery names, so a promoted draft shows as draft coverage on the site until the official list is in.

## reading-the-parse-report

The parse prints category, medal, brewery, and award counts followed by problems. Expect roughly 100 categories and 300 to 350 medals. Problems of kind `unparsed-medal` quote the text the parser could not split; fix the extracted text in data/raw/gabf-2026-winners.txt (a missing comma, a wrapped line) and rerun `npm run parse -- --year 2026 --input data/raw/gabf-2026-winners.txt`. `empty-category` means a header matched but no medal lines followed it; check the text around that category. If the parse finds no categories at all, the PDF layout changed: open the text file, note the new header pattern, and update `categoryHeaderRegex` in scripts/lib/parse-winners-lib.mjs with a fixture under tests/fixtures/.

## after-the-parse

1. `npm run enrich` runs Open Brewery DB lookups for every new brewery (about a quarter second each, cached under data/cache/). Breweries the API does not know get an override row in data/reference/brewery-overrides.csv when you want a map pin.
2. `node scripts/build-fed-districts.mjs`, then `node scripts/fetch-state-indicators.mjs`: the first resolves new medal cities in split states to counties and Federal Reserve districts, the second adds the year's population and GDP rows (a year not yet published reuses the latest one and says so). When Census publishes a new population vintage or BEA a new GDP release, rerun the second with `--refresh`; a new Census vintage also needs the two vintage URLs and `POP_LAST` updated at the top of the script. Sources are in docs/data-sources.md.
3. `npm run build` and `npm run serve`, then open the explorer with the new year selected and the top-breweries report.
4. Fill the year's row in data/results/year-summary.csv from the Brewers Association release (entries, breweries entering, medals, categories).
5. Optionally scaffold local deep dives for the breweries you care about: `node scripts/scaffold-brewery.mjs --brewery "Name"`, then research and fill the sections. breweries/ is ignored by git, so these stay on your machine.
6. Commit data/ and docs/ and push to main. The deploy-pages workflow publishes within a few minutes.

## unattended-ingest

The ingest-results workflow runs every two hours from October 11 to 20 and on demand from the Actions tab (inputs: year, optional PDF URL, publish true or false). It skips a year that is already completely loaded, exits quietly when no PDF is found, and otherwise parses, enriches, runs the tests and data validation, rebuilds the site and gabf-dashboard.html, and either pushes to main and dispatches deploy-pages (publish true) or opens a pull request (publish false). A push made with the workflow token does not start other workflows, which is why the deploy is dispatched explicitly.

One-time repository settings, already applied to klappe-pm/GABF-Analysis: Settings, Pages, Source set to GitHub Actions; Settings, Actions, General, "Allow GitHub Actions to create and approve pull requests" turned on so publish false can open its pull request. deploy-pages also runs on every pull request with the full verify gates (prose check, tests, validation, site build, and a check that the committed gabf-dashboard.html is current) and deploys only from main.

## backfilling-earlier-years

```bash
npm run fetch -- --all
```

Known PDF URLs cover 2021, 2024, and 2025; 2022 and 2023 need `--url` from their press releases, and 2018 to 2020 are on the festival site's winners archive. Parse each year with `npm run parse -- --year YYYY`, then `npm run enrich` once and `npm run build`. Seed rows (notes "Partial seed") are replaced automatically because the parse writes the whole year file.

## refreshing-style-definitions

Download the current Beer Style Guidelines PDF from brewersassociation.org and run:

```bash
npm run styles -- --input "$HOME/Downloads/2026-beer-style-guidelines.pdf" --year 2026
```

Rows that match a category name get guideline ranges; new styles are appended with a derived style family.

## rendering-visuals

```bash
npm install --no-save playwright@1.56.1 && npx playwright install chromium && npm run render-visuals -- --brewery green-cheek-beer-co
```

PNG files land in reports/: each chart figure, the stat tiles, and the full page.
