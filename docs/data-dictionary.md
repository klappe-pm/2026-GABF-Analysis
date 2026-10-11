---
domain: beer
category: gabf-analysis
sub-category: docs
topics:
  - data-dictionary
types:
  - reference
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

# data-dictionary

## results-gabf-yyyy-csv

| column | meaning |
|---|---|
| year | competition year |
| competition | GABF (world-beer-cup.csv uses WBC) |
| section | main, pro-am, or collaboration |
| category_number | the category's number in that year's list (numbering changes yearly) |
| category_name | official category name as printed |
| entries | entries judged in the category that year, from the header |
| medal | Gold, Silver, Bronze (Honorable Mention in older years) |
| beer_name | as printed |
| brewery_printed | the brewery string exactly as printed, including any location suffix |
| brewery_name | brewery_printed without the location suffix |
| brewery_location | the location suffix, such as Costa Mesa, when printed |
| city, state | as printed; state is the two-letter code |
| source | where the row came from (official list file name, or the secondary source for seed rows) |
| notes | free text; "Partial seed" marks a placeholder row |

Derived at build time: brewery_key (normalized identity), brewery_slug, category_slug, style_family, abv_min and abv_max (from categories.csv), abv (from beer-abv-overrides.csv), abv_band, region, division, points (3, 2, 1), partial.

## year-summary-csv

year, competition, ceremony_date, venue, entries, entering_breweries, medals, winning_breweries, categories, notes, source. Figures come from Brewers Association releases; blanks are filled from the ingested list where derivable.

## brewery-of-the-year-csv

year, competition, award, bracket, brewery_printed, brewery_name, brewery_location, city, state, source.

## reference-categories-csv

category_name, style_family, abv_min, abv_max, ibu_min, ibu_max, srm_min, srm_max, description, guideline_source, confidence (approximate or guideline).

## reference-states-csv

state, name, region, division, population_2020, source.

## reference-ownership-csv

brewery_name, aliases (semicolon separated), hq_city, hq_state, ownership_type (independent, employee-owned, private-equity-backed, large-brewer-owned, public-company-owned, beverage-conglomerate-owned, hospitality-group, closed), parent, parent_type, investor, stake, deal_year, status, ba_independent (yes or no), founded, source, verified (yes or no).

## reference-production-csv

brewery_name, year, barrels, basis (reported, boty-bracket, estimate), source, confidence, notes (for boty-bracket rows the bracket text).

## reference-beer-abv-overrides-csv

competition, year, brewery_name, beer_name, abv, source. Lets a beer's actual ABV replace the style range in the explorer's ABV band.

## reference-brewery-overrides-csv

brewery_name, brewery_location (blank for the headquarters record), open_brewery_db_id, address, city, state, postal_code, latitude, longitude, website, brewery_type, notes.

## brewery-profile-frontmatter

Canonical keys first (domain, category, sub-category, topics, types, date-created, date-revised, status, aliases, tags), then A to Z: barrels-estimate, brewery (must match the printed name so the key resolves), brewery-type, founded, has-kitchen, hq-city, hq-state, known-for (list), locations (list of name, address, city, state, postal-code, opened, kitchen, notes), revenue-estimate-usd, revenue-high-usd, revenue-low-usd, website.

## enriched-breweries-json

Keyed by brewery_key: name, best (the headquarters record: address_1, city, state, postal_code, latitude, longitude, website_url, brewery_type, source), locations (each candidate location with source openbrewerydb or override), obdb_queried_at, obdb_candidates, error.

## site-data-exports

dist/data/results.json (decorated rows), meta.json (years, coverage, summary, states, bands, brewery types, ownership map, categories), breweries.json, categories.json, and dist/data/csv/ copies of every source CSV.
