---
domain: beer
category: gabf-analysis
sub-category: docs
topics:
  - research
  - breweries
types:
  - playbook
date-created: 2026-10-11
date-revised: 2026-10-11
status: ACCEPTED
aliases: []
tags: []
models:
  - claude-fable-5-1
providers:
  - Anthropic
session-link: https://claude.ai/code/session_017p8WkwJF1gqWYn98dKrcBw
---

# research-playbook-brewery

How to turn a brewery name from the winners list into a complete profile (ownership, investors, distributors, volume, ARR, margins, locations) in under an hour, and where each fact goes in the repository.

## start-from-the-scaffold

```bash
node scripts/scaffold-brewery.mjs --brewery "Brewery Name As Printed"
```

The scaffold writes breweries/brewery-name.md with the medal table filled from the results and prints the checklist below. Fill the frontmatter keys as facts are confirmed: founded, employees, brewery-type, distribution-channel, has-kitchen, locations, barrels-estimate, revenue-estimate-usd with low and high.

## ownership-and-investors

1. Company site "about" page: founders, founding year, any parent company mention.
2. Brewbound brewery profile and news search for the name: acquisitions, investments, closures.
3. Trade press for deals: Brewbound, Craft Brewing Business, Good Beer Hunting, local business journals.
4. Funding databases: Nombase and Crunchbase for rounds and investors (most small breweries show none).
5. Brewers Association independent craft brewer seal on the company site or cans: a public claim of independence.
6. State business entity search for the LLC or corporation and its managers.

Record the result as a row in data/reference/ownership.csv with ownership_type, parent, investor, stake, deal_year, source, and verified set to yes only when a primary source (company release, filing, or interview) was read.

## distributors

1. Company site "where to find us" or "beer finder": a wholesaler name often appears in the footer or in distributor-run beer finders.
2. State alcohol regulator lookups: the California ABC license query shows a brewery's Type 23 or Type 01 license and whether it holds a Type 17 (beer and wine wholesaler) license for self-distribution; other states expose similar registries.
3. Distributor websites list their portfolios (Reyes Beer Division, Stone Distributing, Craft Beer Guild, Breakthru, Southern Glazer's craft portfolios, regional houses).
4. Untappd "available at" venues and retailer listings show the footprint; a footprint confined to the home county without a wholesaler name usually means self-distribution.
5. Press about collaborations or launches often names the distribution partner.

Record a row in data/reference/distributors.csv with channel (self-distribution or wholesaler), distributor, territory, since, source, verified, and notes. Set distribution-channel in the profile frontmatter so the dashboards and financial model use it.

## production-volume

1. Brewers Association top 50 craft brewing companies list (annual, by sales volume) for the largest.
2. Brewery of the Year brackets from the GABF results fix a winner's size for that year.
3. Local press and company statements ("we brewed 8,000 barrels last year").
4. TTB and state excise filings where public; brewery equipment announcements (a 30-barrel brewhouse with four 60-barrel fermenters implies a ceiling).
5. Absent all of these, estimate from brewery type, locations, and headcount and record the reasoning.

Record in data/reference/production.csv with basis reported, boty-bracket, or estimate, plus confidence and notes; or set barrels-estimate in the profile.

## revenue-arr-and-margins

The model in docs/estimation-method.md derives ARR, gross margin, and EBITDA from barrels, brewery type, kitchens, employees, and distribution channel. Improve a brewery's numbers by supplying the inputs it lacks: employees (LinkedIn headcount, press), kitchens, locations, channel, and any reported revenue (business journal lists, acquisition announcements, lender or SBA records). Override revenue in the profile frontmatter when a reported figure exists.

## locations

1. Company site locations page for names, addresses, kitchens, and opening dates.
2. Open Brewery DB (npm run enrich, or the MCP server in .mcp.json) for coordinates and types.
3. Local press for openings, acquisitions of other breweries' sites, and closures.

Record in the profile frontmatter locations list (name, address, city, state, postal-code, opened, kitchen, notes) and, for breweries without a profile, in data/reference/brewery-overrides.csv.

## styles-and-what-they-are-known-for

1. The medal record on the brewery page: which categories recur.
2. Untappd top beers and the company's core range.
3. Trade profiles and podcasts with the head brewer.

Record as known-for in the profile frontmatter and a paragraph in the deep dive.

## before-you-finish

Run the gate and open the page:

```bash
npm run verify && npm run serve
```

Then open http://localhost:8080/breweries/brewery-name/ and check the profile card, the distribution block, the scale estimates, and the deep dive. Every figure without a named source must read (E).
