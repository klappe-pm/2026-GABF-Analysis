# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js (React) with static export (`output: export`), pre-rendering every page to static HTML for GitHub Pages, styled with Tailwind CSS driven by the design tokens. Mobile first: every page must work fully on a phone. The existing Node data pipeline (ingest, enrichment, research profiles, SQLite database, validation, tests) stays and feeds the site build. Apache ECharts remains the chart engine.

## Users

Brewers and brewery owners are the primary readers. They open the site to benchmark their brewery against the field, decide which GABF categories to enter, see how crowded each category is, and study the beers that won: style, ABV, IBU, hops, and ingredients. Beer fans, press, and industry analysts use the same public data, but every decision favors the brewer's job first.

## Product Purpose

An independent, public analysis of Great American Beer Festival results. It turns the official winners lists into one linked, filterable record of every medal from 2018 to 2026, connects breweries, categories, and beers across years, documents the winning beers themselves, and explains what the results mean. Success is a brewer leaving with a concrete answer: where they stand, which categories reward entry, and what winning beers in a style look like.

## Positioning

Three things together that neither the official winners list nor beer rating sites offer:

1. Every medal across years, linked: breweries, categories, and beers connected from 2018 to 2026 in one filterable record.
2. The winning beers themselves: sourced specs (ABV, IBU, hops, malts, yeast, adjuncts) and the brewery's own description for every 2026 medal beer, with links to the brewery's page for the beer.
3. Story and analysis: written findings such as first time medalists, medal concentration, category odds, trends, and regional strength, each traceable to the data.

## Operating Context

Read on desktop at a desk while planning entries or studying competitors, and on a phone during and after the festival when results are announced. Visitors arrive through a shared link to a brewery, category, or beer as often as through the home page, so every page must stand on its own and carry its filter state in the URL.

## Capabilities and Constraints

- Static site, no backend, deployed to GitHub Pages (see Stack). Saved views and any personalization live in the browser (URL and local storage) only.
- Data: official winners lists 2021 to 2026 complete; 2018 and 2019 partial; 2020 pending. 1,907 medal rows, 947 breweries, 177 categories.
- One global filter applies to every view; every page with data is filterable by every dimension.
- Independent and unofficial: no GABF or Brewers Association marks, logos, or branding, and nothing that implies endorsement.
- Publishing at gabf.beer is approved (issue #143, 2026-10-15) and goes live once the apex DNS records pass `npm run pages:dns` and the custom domain is switched, as `docs/deployment.md` describes. Domains owned (all registered at Porkbun), with the agreed plan: gabf.beer is the primary address for this site; gabfawards.beer forwards to gabf.beer; medals.beer is reserved for medal record features (a brewery's or beer's medal history) or forwards to the primary; awards.beer is held for a future multi competition site (a registry of 228 US competitions exists in `data/reference/us-beer-competitions.csv`, without results).

## Brand Commitments

The name is "GABF Analysis". Voice is plain, precise, and brief: state the finding, then the evidence. No dash used as punctuation in any copy. No visible kebab case in public content. Nothing on the site credits an AI, model, or tool.

## Evidence on Hand

- Medal results: `data/results/gabf-2018.csv` to `gabf-2026.csv` (official lists for 2021 to 2026).
- 336 researched 2026 winner profiles: `docs/2026/winner/`, queryable in `data/enriched/winners-2026.sqlite` once `npm run explorer` builds it locally. Specs are published values only; about 42 beers have no published specs, and gaps are stated, never filled.
- Brewery deep dives and estimates: `breweries/`, `data/reference/` (estimates marked (E) and traceable to `data/reference/estimation-parameters.json`).
- Federal Reserve districts and state controls (population, GDP, ACS 2024 demographics, NCES literacy, NCHS life expectancy): `data/reference/`.
- No testimonials, users, press coverage, or endorsements exist; none may be invented.

## Product Principles

1. Data honesty first: official lists win, partial years and estimates are always labeled, and no figure, source, or medal is ever invented.
2. Answer the brewer's question before showing the machinery: lead with the finding, keep controls and method one step away.
3. Every page is a destination: shareable, self explanatory, and filterable without visiting the dashboard first.
4. Show the beers, not just the counts: medals connect to the actual beer, its specs, and its brewery.
5. Independent and plain spoken: clearly unofficial, concise, no promotional tone.

## Accessibility & Inclusion

WCAG 2.2 AA: text contrast at least 4.5:1, full keyboard operation including filters and chart interactions, visible focus, reduced motion respected, and a text or table alternative for every chart.
