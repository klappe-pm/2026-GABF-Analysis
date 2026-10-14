---
name: beer-award-dataset
description: Build or extend the beer award dataset (competitions, categories, medals, entrants, beers, ingredients, flavor, breweries, marketing) from official sources before any concentration analysis or chart.
---

# beer-award-dataset

Use this skill whenever a task needs award winners joined to what the beers are made of and how they are sold. It produces tidy tables under `data/` plus three documents that make the dataset auditable. The analysis skill (`beer-award-concentration-analysis`) and the chart skill (`beer-award-visualization`) both assume this dataset exists and follows these rules.

## when-to-use

- Adding a competition or year to the results tables.
- Attaching recipes, ingredients, or flavor descriptors to medal winners and to the entrant pool.
- Adding price, distribution, or label claims for medal winners and comparison beers.
- Any question of the form "do winners share X" where X lives below the medal list.

## schema

Every table carries `source` and `verified` columns. Keys are lowercase kebab-case slugs.

| table | grain | key columns |
|---|---|---|
| competitions | one competition year | competition_id, year, held, event_date, scope, type, style_guide, entries, entering_breweries, results_url |
| categories | one category in one competition year | competition_id, year, category_number, category_name, style_family, entries |
| awards | one medal | competition_id, year, category_number, medal, beer_id, brewery_id |
| entrants | one entered beer, medal or not | competition_id, year, category_number, beer_id, brewery_id |
| beers | one beer | beer_id, beer_name, brewery_id, style_declared, abv, ibu, srm, first_brewed |
| ingredients | one ingredient in one beer | beer_id, ingredient_type (malt, hop, yeast, adjunct, process), ingredient_name, ingredient_family, share_pct, disclosure (brewer, tech-sheet, label, inferred) |
| flavor | one descriptor score for one beer | beer_id, axis (bitter, sweet, roast, fruit, citrus, pine, dank, sour, funk, body), score_0_5, method |
| breweries | one brewery | brewery_id, brewery_name, city, state, founded, ownership, annual_bbl_band |
| marketing | one observation for one beer | beer_id, date, channel, price_per_oz, distribution_states, medal_on_label, claim_text |

`data/reference/us-beer-competitions.csv` is the competition registry: the frame of which competitions exist, which years they ran, and where their results live. Build `competitions` rows from it.

## sourcing-rules

- Official results lists win over press, social posts, and aggregators. A secondary source is allowed only with `verified=no` and the source named.
- Never fabricate a value. An empty cell is correct when the source is silent. Estimates are marked `(E)` in notes, never written as fact.
- Ingredients come from the brewer (tech sheet, website, label, direct reply). An ingredient inferred from style or name is `disclosure=inferred` and is excluded from any headline claim.
- Entrant lists are rare. When a competition publishes only winners, record that in the coverage report; enrichment analysis needs entrants, so that competition can support concentration measures but not ingredient enrichment.
- Marketing observations need a date. A price without a date cannot be placed before or after a medal and is dropped.

## normalization

- Brewery names: resolve to `brewery_id` through `data/reference/ownership.csv` and the printed name; keep `brewery_printed` verbatim.
- Beer identity: the same beer across years shares one `beer_id`; a renamed beer keeps its id and the old name goes in notes.
- Hops and malts: map trade names to one canonical name and a family (for example citrus forward American hops, noble hops, crystal malts, roasted malts) in a reference table, so similarity can be measured at both levels.
- Styles: store the declared category and a broader `style_family`, since guidelines differ between Brewers Association and BJCP competitions.

## outputs

- `docs/data-dictionary.md`: every table and column, type, allowed values, source.
- `reports/coverage-report.md`: by competition and year, share of medals with ingredients, with flavor, with marketing, and whether entrants exist. Pair it with the coverage heatmap chart.
- `docs/decisions-log.md`: one line per judgment call (alias merges, inferred values excluded, conflicts between sources and which one won).

## checks-before-handoff

- Medal counts per category match the official list.
- No `beer_id` without a `brewery_id`.
- Ingredient shares per beer sum to 100 or are left blank.
- Coverage report regenerated after every load.
