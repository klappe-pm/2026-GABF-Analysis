# Changelog

Notable changes to GABF Analysis, newest first. Each entry links the merged pull request. The project has not tagged a release yet; the version in package.json is 0.1.0.

## Unreleased

- CI and deployment rebuilt: `ci.yml` runs every gate (including the web/ build and the rendered design system audit) as the required `build` check, and `deploy.yml` publishes to GitHub Pages only after ci passes on main, queueing deploys instead of cancelling them. The Material 3 app in web/ is served at the site root with the older pages kept at their URLs (`docs/deployment.md`). `gabf-dashboard.html`, `gabf-explorer.html`, and the chart gallery are build outputs and are no longer committed. `npm run pages:dns` and `npm run pages:domain` prepare the move to gabf.beer.
- Project README rewritten with a banner, status and data badges, quick start, pipeline overview, and honesty notes.
- Added CONTRIBUTING, SECURITY, CODE_OF_CONDUCT (Contributor Covenant 2.1), CITATION.cff, issue forms for bugs and data corrections, a pull request template, and Dependabot for npm and GitHub Actions.
- The prose checker allows title or sentence case headings in public facing files (README, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT, CHANGELOG, PRODUCT, DESIGN, and files under .github/); every other markdown file keeps kebab case headings.

## 2026-10-14

- Added 2026 winner beer profiles, a winners database, an explorer build, and Fed district controls ([#6](https://github.com/klappe-pm/GABF-Analysis/pull/6)). One researched profile per 2026 medal (336) under docs/2026/winner/; `scripts/build-winner-db.mjs` builds a SQLite database with full text search; `scripts/build-explorer.mjs` writes gabf-explorer.html; every medal gets a Federal Reserve district, with population, GDP, and demographic controls by state and district.
- Added beer award skills, chart mockups, and a US competition registry ([#5](https://github.com/klappe-pm/GABF-Analysis/pull/5)): 38 US competitions from 2021 to 2026 in data/reference/us-beer-competitions.csv, and eleven reference charts rendered from synthetic data.

## 2026-10-13

- Used parsed medal counts for 2021 and 2022 in the year summary ([#4](https://github.com/klappe-pm/GABF-Analysis/pull/4)), so the totals match the rows loaded from the official lists.
- Ran the verify gates in CI and dispatched deploys after ingest ([#3](https://github.com/klappe-pm/GABF-Analysis/pull/3)). deploy-pages checks every pull request and deploys only from main; ingest-results validates, rebuilds the single file dashboard, and triggers a deploy.
- Ingested the official winners lists for 2021 to 2026 and added data validation ([#2](https://github.com/klappe-pm/GABF-Analysis/pull/2)). 2026 holds 336 medals to 243 breweries; `npm run validate` joined the verify gate.
- Built the GABF analysis pipeline, ECharts dashboards, and GitHub Pages site ([#1](https://github.com/klappe-pm/GABF-Analysis/pull/1)): ingest, enrichment, data model, five dashboards, brewery and category pages, reports, the single file dashboard, and the deploy and ingest workflows.
