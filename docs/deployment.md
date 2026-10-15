---
domain: beer
category: gabf-analysis
sub-category: docs
topics:
  - aws
  - ci
  - cloudfront
  - deployment
  - route-53
types:
  - runbook
date-created: 2026-10-14
date-revised: 2026-10-15
status: ACCEPTED
aliases: []
tags: []
---

# deployment

The site is served from AWS at gabf.beer: an S3 bucket behind a CloudFront distribution, with DNS in Route 53. AWS CodeBuild builds and publishes every push to main. GitHub runs the checks only; no AWS key is stored in GitHub. The AWS resources are owned and changed outside this repository; their names are in `scripts/lib/site-hosting.mjs`.

## aws-resources

| resource | name | role |
|---|---|---|
| S3 bucket | `gabf-beer-site-768801480220` (us-east-2) | holds the site files; private, read only by the distribution through origin access control |
| CloudFront distribution | `E1T56UM0ZOIMXQ` (`d18mow5csnyul.cloudfront.net`) | serves the bucket at gabf.beer and www.gabf.beer over HTTPS |
| CloudFront function | viewer request on the distribution | answers `/path/` and `/path` from `/path/index.html` |
| CloudFront error responses | 403 and 404 from the bucket | answered with `/404.html` |
| CodeBuild project | runs `buildspec.yml` as the role `gabf-site-deploy-codebuild` | builds the site from main and publishes it; the role can only sync the bucket and invalidate the distribution |
| CodeConnections link | GitHub connection used by the CodeBuild project | pulls the repository and starts a build on every push to main |
| Route 53 hosted zone | `Z08677032YJWSE1XU5DWE` (gabf.beer) | alias records for gabf.beer and www.gabf.beer to the distribution |

GitHub OpenID Connect deploys are not possible in this AWS project (its service control policy denies creating identity providers), which is why the build runs in CodeBuild rather than in a GitHub workflow.

## workflows

| where | runs on | what it does |
|---|---|---|
| `.github/workflows/ci.yml` | every pull request, pushes to main, dispatch | one job named `build`, the check branch protection on main requires: generated hop and brewery docs check, prose check, brand check, the web/ static export (before the tests, so the tests that read web/out check this commit), tests (after `npm run generate`), data validation, hop validation, the design system check, the rendered design system audit in Playwright Chromium, and a trial assembly of the site artifact |
| `buildspec.yml` (AWS CodeBuild) | every push to main | builds the single file dashboard and the web/ export with an empty base path, assembles `_site/`, fails when it has no `index.html` or `404.html`, syncs it to the bucket, and invalidates the distribution |
| `.github/workflows/ingest-results.yml` | schedule in the results window, dispatch | ingests a winners list into a pull request, starts ci on it, and with publish true merges it once `build` passes; the merge is a push to main, so CodeBuild publishes it |

Runs of ci on a pull request cancel older runs for the same pull request; runs on main never cancel. Every pull request merges with auto-merge (`gh pr merge <n> --auto --merge`), which waits for `build`, so what CodeBuild publishes from main has passed every check.

## caching

The sync in `buildspec.yml` sets how long browsers and CloudFront may keep each file:

| files | Cache-Control |
|---|---|
| `/_next/static/` (file names carry a content hash) | `public, max-age=31536000, immutable` |
| other files (images, CSV exports, any `.mjs` module) | `public, max-age=300` |
| pages and data (`.html`, `.json`, `.txt`) | `public, max-age=0, must-revalidate` |

Pages and data upload last, so a page never names a file that is not in the bucket yet, and the invalidation of `/*` clears CloudFront's copies at the end of every deploy. `.mjs` files are uploaded with a JavaScript content type, because browsers refuse a module script served as anything else.

## deploy-by-hand

A push to main deploys. To check an artifact before it ships, build and serve it locally with the same path rules as the distribution:

```bash
cd GABF-Analysis && npm ci && npm run web:install && npm run build:standalone && npm run web:build && npm run site:assemble && npm run site:serve
```

To publish by hand, with AWS credentials allowed to write the bucket and invalidate the distribution (the owner's, not stored here), run the four sync commands and the invalidation in the `post_build` phase of `buildspec.yml` from the repository root after the build above. Starting the CodeBuild project from the AWS console on main does the same with the project's own role.

## domain-and-dns

gabf.beer and www.gabf.beer are alias records in the Route 53 hosted zone `Z08677032YJWSE1XU5DWE`, pointing at the distribution; gabfawards.beer forwards to gabf.beer at the registrar. The owner approved publishing at gabf.beer on 2026-10-15 (issue #143) and chose AWS over GitHub Pages. Check the setup from outside, with no AWS credentials:

```bash
cd GABF-Analysis && npm run site:dns
```

It passes when the domain's name servers are Route 53's, both hosts have address records, and both answer over HTTPS through CloudFront with the same home page as `d18mow5csnyul.cloudfront.net`. Once it passes, GitHub Pages can be turned off in the repository settings (Settings, Pages); nothing in the repository deploys there any more.

## generated-files

These are build outputs and are not in git: `gabf-dashboard.html`, `docs/design/chart-gallery/index.html`, `data/enriched/winners-2026.sqlite` (built from the profiles in `docs/2026/winner/`, and read only by the tests), and the artifact `_site/`. `npm run generate` writes the first three (and `npm test` runs it first), `npm run winner-db` writes the database, and the deploy publishes the dashboard at `/gabf-dashboard.html`. `tests/winner-db.test.mjs` checks that the rebuilt database holds exactly one beer per profile. Two pull requests that each regenerate a committed copy can merge into a stale one even when both pass their checks, and a 12 MB page or a 7 MB database conflicts on every parallel research change; building them in CI removes both failures. A branch never carries them. The brand outputs (`site/assets/brand.css`, `site/assets/brand.json`, and the README banners) stay in git, because the README renders the banners on GitHub; `npm run brand:check` keeps them current and is deterministic.

## url-map

The deploy publishes the web/ export with the single file dashboard beside it (`scripts/assemble-site.mjs`). The old static page build was retired in issue #141; nothing of it is published.

| URL | serves |
|---|---|
| `/` | the web/ app home |
| `/overview/`, `/dashboards/`, `/breweries/`, `/categories/`, `/beers/`, `/hops/`, `/hop-farms/`, `/analysis/`, `/first-time-medalists/`, `/saved/`, `/method/`, `/about/`, `/data/` | the web/ app |
| `/reports/`, `/reports/<slug>/`, `/explorer/` | web/ pages that forward to their new address under `/analysis/`, keeping the URL hash |
| `/design-system/`, `/design-settings/` | the web/ style guide and its settings |
| `/404.html` | the web/ not found page, also served for any address with no file, including the retired `/assets/` files |
| `/gabf-dashboard.html` | the single file dashboard |

## base-path

The web/ build reads `NEXT_BASE_PATH` (web/next.config.ts). The site serves at the domain root, so `buildspec.yml`, ci, and local builds leave it empty.
