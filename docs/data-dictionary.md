---
domain: beer
category: gabf-analysis
sub-category: docs
topics:
  - data-dictionary
types:
  - reference
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

Derived at build time: brewery_key (normalized identity), brewery_slug, category_slug, style_family, special and category_type (classic or special, from categories.csv or the rule in style-families.mjs), abv_min and abv_max (from categories.csv), abv (from beer-abv-overrides.csv), abv_band, region, division, points (3, 2, 1), partial, draft (transcript rows).

## year-summary-csv

year, competition, ceremony_date, venue, entries, entering_breweries, medals, winning_breweries, categories, notes, source. Figures come from Brewers Association releases; blanks are filled from the ingested list where derivable.

## brewery-of-the-year-csv

year, competition, award, bracket, brewery_printed, brewery_name, brewery_location, city, state, source.

## reference-categories-csv

category_name, style_family, abv_min, abv_max, ibu_min, ibu_max, srm_min, srm_max, description, guideline_source, confidence (approximate or guideline), special (yes or no).

## reference-states-csv

state, name, region, division, population_2020, source.

## reference-fed-districts-csv

state, district_number (1 to 12), district_name, split (yes or no), secondary_districts, source, verified (no marks the West Virginia approximation). Written by scripts/build-fed-districts.mjs.

## reference-fed-district-counties-csv

state, county_fips, county_name, district_number, basis (named or complement), source. Split states only.

## reference-medal-city-counties-csv

state, city (exactly as printed on the medal rows), county_fips (several joined by `;` when the city spans counties in one district), county_name, district_number, source, verified, note. Split states only.

## reference-state-indicators-csv

state, year, indicator, value, unit, source, source_url, verified (yes, or derived for gdp_per_capita_real). Indicators and their years are listed in docs/data-sources.md. Written by scripts/fetch-state-indicators.mjs.

## reference-district-indicators-csv

district_number, district_name, year, indicator (population, gdp_real, gdp_nominal, gdp_per_capita_real), value, unit, source, source_url, verified (yes, derived, approximation, or estimate (E) where split state GDP is apportioned).

## result-row-district-fields

The data model adds fed_district, fed_district_name, and fed_district_method (state, county, approximation, or approximation (city not resolved)) to every medal row; World Beer Cup rows outside the US carry blanks. The fields appear in dist/data/results.json and the dashboard CSV download.

## reference-ownership-csv

brewery_name, aliases (semicolon separated), hq_city, hq_state, ownership_type (independent, employee-owned, private-equity-backed, large-brewer-owned, public-company-owned, beverage-conglomerate-owned, hospitality-group, closed), parent, parent_type, investor, stake, deal_year, status, ba_independent (yes or no), founded, source, verified (yes or no).

## reference-production-csv

brewery_name, year, barrels, basis (reported, boty-bracket, estimate), source, confidence, notes (for boty-bracket rows the bracket text).

## reference-distributors-csv

brewery_name, channel (self-distribution or wholesaler), distributor, territory, since, source, verified (yes or no), notes.

## reference-brewery-facts-csv

brewery_name, employees, has_kitchen (yes or no), locations_count, known_for (semicolon separated), barrels_estimate, revenue_estimate_usd, revenue_low_usd, revenue_high_usd, source, verified (yes or no), notes. Tracked brewery facts that a local deep dive in breweries/ would otherwise supply; breweries/ is ignored by git, and a local deep dive wins when both exist. Barrels and revenue here are estimates (E).

## reference-beer-abv-overrides-csv

competition, year, brewery_name, beer_name, abv, source. Lets a beer's actual ABV replace the style range in the explorer's ABV band.

## reference-brewery-overrides-csv

brewery_name, brewery_location (blank for the headquarters record), open_brewery_db_id, address, city, state, postal_code, latitude, longitude, website, brewery_type, notes.

## brewery-profile-frontmatter

Canonical keys first (domain, category, sub-category, topics, types, date-created, date-revised, status, aliases, tags), then A to Z: barrels-estimate, brewery (must match the printed name so the key resolves), brewery-type, distribution-channel, employees, founded, has-kitchen, hq-city, hq-state, known-for (list), locations (list of name, address, city, state, postal-code, opened, kitchen, notes), revenue-estimate-usd, revenue-high-usd, revenue-low-usd, website.

## enriched-breweries-json

Keyed by brewery_key: name, best (the headquarters record: address_1, city, state, postal_code, latitude, longitude, website_url, brewery_type, source), locations (each candidate location with source openbrewerydb or override), obdb_queried_at, obdb_candidates, error.

## site-data-exports

dist/data/results.json (decorated rows), meta.json (years, coverage, summary, states, bands, brewery types, ownership map, distribution map, categories), breweries.json (including trend, estimate, and financials per brewery), categories.json, and dist/data/csv/ copies of every source CSV.
