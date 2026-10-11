---
domain: beer
category: gabf-analysis
sub-category: docs
topics:
  - estimates
  - methodology
types:
  - method
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

# estimation-method

Every production, volume, and revenue figure on the site is marked (E) unless the production table carries a reported number with a source. This document explains how the (E) figures are produced so they can be tuned or replaced.

## production-barrels

Order of preference in `scripts/lib/estimate.mjs`:

1. Reported: a data/reference/production.csv row with basis `reported` (newest year wins). Confidence high.
2. Brewery of the Year bracket: the midpoint of the bracket the brewery won in (for example 5,001 to 15,000 barrels gives 10,000). Open-ended brackets use 1.25 times the floor. Confidence medium.
3. Curated estimate: a production.csv row with basis `estimate`, or `barrels-estimate` in the brewery profile frontmatter, with its stated confidence and reasoning.
4. Type heuristic: barrels by brewery type from estimation-parameters.json (nano 150, brewpub 1,200, taproom 800, micro 2,500, regional 50,000, large 1,000,000) plus 600 barrels for each location beyond the first. Confidence low.

## volume-equivalents

One US beer barrel is 31 gallons (3,968 fluid ounces): 13.78 cases of 24 twelve-ounce containers, 248 sixteen-ounce cans or pints, 330.7 twelve-ounce cans, 117.3 liters. The packaged share by brewery type (brewpub 25 percent, micro 55 percent, regional 80 percent, and so on) splits barrels into packaged cans and draft pints.

## revenue

Revenue per barrel follows the Brewers Association 2023 benchmarks: direct-to-consumer beer 1,276 USD per barrel (taproom, brewpub, nano), distributed beer 602 USD (regional), a 900 USD blend for micro, and 500 USD for large. A pint at 7 to 8 USD times 248 pints is 1,700 to 2,000 USD per barrel at the glass before waste, which is why the direct figure sits where it does. Kitchens add 1.2 million USD per kitchen location. The range shown is 0.7 to 1.35 times the point estimate. A profile may override with revenue-estimate-usd, revenue-low-usd, and revenue-high-usd when better information exists.

## arr-gross-margin-and-ebitda

ARR here means the annual revenue run rate implied by the volume and channel mix. From it, `estimateFinancials` in scripts/lib/estimate.mjs derives gross profit from a gross margin by brewery type (taproom 70 percent, brewpub 62 percent, micro 50 percent, regional 42 percent) and EBITDA from a point margin by brewery type (taproom 16 percent, brewpub 12 percent, micro 8 percent, regional 6 percent) with a range by distribution channel (taproom 8 to 24 percent, self-distribution 5 to 11 percent, distributor 2 to 6 percent). It also reports revenue per barrel, per location, and per employee when a headcount is known. Benchmarks: the Brewers Association 2023 financial benchmarking survey (total revenue 1,511 USD per barrel on average, direct-to-consumer beer 1,276 USD, distributed beer 602 USD, beer COGS above 500 USD per barrel, average beer gross margin 41 percent) and the Brewery Profit Workshop channel ranges. Set distribution-channel and employees in a brewery profile to sharpen its figures.

## locations-and-employees

Locations count the profile's `locations` list when present, otherwise distinct city and state pairs credited in the results. Employee counts are only shown when a source states them.

## worked-example-green-cheek-beer-co

Four locations, three kitchens, two brewing sites, more than 100 employees reported, brewpub type, production unknown. Curated estimate 6,500 barrels (range 4,000 to 9,000): 201,500 gallons, 89,600 case equivalents, about 400,000 sixteen-ounce cans at a 25 percent packaged share and 1.2 million pints on draft. Revenue (ARR): profile estimate 12 million USD (range 9 to 16 million), consistent with 6,500 barrels at about 1,276 USD per barrel (8.3 million) plus three kitchens (3.6 million), and with a payroll of 100 plus people. Financials: gross margin 62 percent (7.4 million gross profit), EBITDA 12 percent (1.4 million) within a self-distribution range of 5 to 11 percent (0.6 to 1.3 million), revenue per employee 120,000 USD, revenue per location 3 million USD.

## tuning

Edit data/reference/estimation-parameters.json and rerun `npm run build`. Add reported figures to data/reference/production.csv as they are found; they take precedence immediately.
