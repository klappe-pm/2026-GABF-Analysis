---
domain: beer
category: gabf-analysis
sub-category: docs
topics:
  - ci
  - deployment
  - github-pages
types:
  - runbook
date-created: 2026-10-14
date-revised: 2026-10-14
status: ACCEPTED
aliases: []
tags: []
---

# deployment

## workflows

| workflow | runs on | what it does |
|---|---|---|
| `.github/workflows/ci.yml` | every pull request, pushes to main, dispatch | one job named `build`, the check branch protection on main requires: generated hop and brewery docs check, prose check, brand check, tests (after `npm run generate`), data validation, hop validation, the old site build, the design system check, the web/ static export, the rendered design system audit in Playwright Chromium, and a trial assembly of the Pages artifact |
| `.github/workflows/deploy.yml` | a successful ci run on main, dispatch | builds the old site, the single file dashboard, and the web/ export, assembles `_site/`, and deploys it to GitHub Pages |
| `.github/workflows/ingest-results.yml` | schedule in the results window, dispatch | ingests a winners list into a pull request, starts ci on it, and with publish true merges it once `build` passes and dispatches deploy |

Runs of ci on a pull request cancel older runs for the same pull request; runs on main never cancel. Deploys share the concurrency group `pages` and never cancel a deploy in progress; GitHub keeps only the newest waiting deploy, so a burst of merges publishes the latest main. Every pull request merges with auto-merge (`gh pr merge <n> --auto --merge`), which waits for `build`.

## generated-files

The single file pages are build outputs and are not in git: `gabf-dashboard.html`, `gabf-explorer.html`, and `docs/design/chart-gallery/index.html`. `npm run generate` writes all three (and `npm test` runs it first), `npm run build` writes the explorer before the site build copies it, and the deploy publishes the dashboard at `/gabf-dashboard.html`. Two pull requests that each regenerate a committed copy can merge into a stale one even when both pass their checks, and a 12 MB file conflicts on every parallel data change; building them in CI removes both failures. The brand outputs (`site/assets/brand.css`, `site/assets/brand.json`, and the README banners) stay in git, because the README renders the banners on GitHub; `npm run brand:check` keeps them current and is deterministic.

## url-map

The deploy lays the web/ export over the old static site (`scripts/assemble-pages.mjs`). A web/ route replaces an old page at the same path; the assembly log lists any it replaces.

| URL | serves |
|---|---|
| `/` | the web/ app home (the old overview dashboard moved to `/overview/`) |
| `/design-system/` | the web/ style guide |
| `/404.html` | the web/ not found page |
| `/overview/` | the old overview dashboard, with its links rewritten one level down; old `/#year=…` links now open the web/ home |
| `/dashboards/`, `/breweries/`, `/categories/`, `/beers/`, `/hops/`, `/hop-farms/`, `/reports/`, `/first-time-medalists/`, `/explorer/`, `/about/`, `/data/`, `/assets/` | the old static site, unchanged |
| `/gabf-dashboard.html` | the single file dashboard |

As pages are ported to web/, their routes take over the old paths automatically. The old site retires when nothing in the URL map comes from dist/.

## base-path

The web/ build reads `NEXT_BASE_PATH` (web/next.config.ts). The deploy sets it from one place, the Pages setting, through the `base_path` output of actions/configure-pages: `/GABF-Analysis` while the site is served from klappe-pm.github.io, and empty once the custom domain is set. Local builds and the ci audit build leave it empty. The old static site uses relative links and works under either base.

## custom-domain

The site moves to gabf.beer, with gabfawards.beer forwarding to it at the registrar. The artifact carries a `CNAME` file naming gabf.beer, which GitHub ignores for Actions deploys, so the domain changes only through the Pages setting.

1. At the registrar, point the apex of gabf.beer at GitHub Pages (A records 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153; AAAA records 2606:50c0:8000::153, 2606:50c0:8001::153, 2606:50c0:8002::153, 2606:50c0:8003::153) and add a `www` CNAME to klappe-pm.github.io. Remove any other apex records, such as parking or forwarding records.
2. Check DNS until it passes:

```bash
cd GABF-Analysis && npm run pages:dns
```

3. Switch the domain, wait for the certificate, enforce HTTPS, and redeploy with an empty base path (needs the GitHub CLI signed in as a repository admin; without `--apply` it prints the plan):

```bash
cd GABF-Analysis && npm run pages:domain -- --apply
```

Do not set the custom domain before DNS passes: the setting redirects the github.io site to the domain at once.
