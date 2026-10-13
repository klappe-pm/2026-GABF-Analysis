---
domain: beer
category: gabf-analysis
sub-category: docs
topics:
  - data-sources
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

# data-sources

## results

- Official winners lists, Brewers Association. Published as a PDF the day of the awards. Known locations: 2021 at https://www.greatamericanbeerfestival.com/wp-content/uploads/2021/10/GABF21-Winners-List-2.pdf, 2024 at https://cdn.greatamericanbeerfestival.com/wp-content/uploads/GABF24-Winners-List.pdf, 2025 at https://cdn.brewersassociation.org/wp-content/uploads/2025/10/11090251/GABF25-Winners-List.pdf. The 2022 and 2023 lists are linked from the Brewers Association press releases (The Nation's Best Beers of 2023 at https://www.brewersassociation.org/press-releases/the-nations-best-beers-of-2023/). `scripts/fetch-winners.mjs` tries these patterns and accepts `--url`.
- Format: `Category N: Name - N Entries` headers followed by `Gold:`, `Silver:`, and `Bronze:` lines of the form beer, brewery, city, state. Multi-location breweries are printed with a location suffix. Brewery and Brewer of the Year lines follow the categories; Pro-Am and Collaboration sections appear in some years.
- Competition totals: Brewers Association releases (2020: 272 medals, 240 breweries, 91 categories, 8,806 entries, 1,720 breweries; 2021: 290 medals, 265 breweries, 97 categories, 9,680 entries, 2,192 breweries; 2022: 300 medals, 268 breweries, 98 categories, 9,904 entries; 2025: 347 medals, 273 breweries and cideries, 8,315 entries, 1,555 breweries). 2023 and 2024 totals are filled by the ingest.
- 2026 results: announced October 11, 2026. Forbes (Don Tse, The Best Beers In America, According To The 2026 Great American Beer Festival, https://www.forbes.com/sites/dontse/2026/10/11/the-best-beers-in-america-according-to-the-2026-great-american-beer-festival/) carries a category-by-category list with entry counts and the totals (336 medals, 243 breweries and cideries, 7,267 entries from 49 states plus DC and Puerto Rico); San Diego Beer News (https://sandiegobeer.news/gabf-2026-winners/) covers Southern California winners including Green Cheek and the Craft Coast Brewery of the Year award, and cites 225 judges. The awards ceremony stream is at https://www.youtube.com/live/EhJtEzE5wbg; its captions feed scripts/import-ceremony-transcript.mjs.
- 2026 competition changes (greatamericanbeerfestival.com, What's New for the 2026 GABF Competition): Rice Lager, Hop Water, and a one-time Craft Malt category added; Multi-Adjunct Beer and Hybrid or Crossover Beer added as Specialty subcategories; Gluten-Free split into three categories; Brewery of the Year judged on total company production across all locations with a new bracket above 100,000 barrels replacing the Brewery Group award. The festival ran October 10 to 11, 2026 at Levitt Pavilion in Denver with the awards at the opening Sunday session.

## breweries

- Open Brewery DB, https://www.openbrewerydb.org, free API with no key: `GET https://api.openbrewerydb.org/v1/breweries?by_name=<name>&by_state=<state>&per_page=50`. Fields used: id, name, brewery_type (micro, nano, regional, brewpub, large, planning, bar, contract, proprietor, closed), address_1, city, state_province or state, postal_code, latitude, longitude, website_url, phone.
- Curated overrides: data/reference/brewery-overrides.csv for addresses, coordinates, and types the API lacks (Green Cheek's four locations are seeded).
- Deep dives: breweries/*.md, researched from company sites, Brewbound profiles, local press, Untappd, and the medal record.

## styles

- Brewers Association Beer Style Guidelines, updated each spring (the 2026 edition added Rice Lager and revised Belgian and German styles). Download from https://www.brewersassociation.org/educational-publications/beer-styles/ and import with `scripts/import-style-guidelines.mjs`. The BA grants free use with attribution for non-commercial purposes.
- Until imported, data/reference/categories.csv carries approximate ranges and short descriptions marked "approximate".
- BJCP guidelines are an alternative reference for homebrew-oriented style definitions but GABF judges to the BA guidelines, so the BA document is canonical here.

## ownership-and-investors

- data/reference/ownership.csv is curated from public announcements: AB InBev's Brewers Collective and its 2023 sale of eight brands to Tilray; Molson Coors' Tenth and Blake and its 2024 sale of four craft brands to Tilray; Heineken (Lagunitas); Lion Little World Beverages, a Kirin company (New Belgium, Bell's); Sapporo (Stone, Anchor); Mahou San Miguel (Founders, Avery); Duvel Moortgat (Boulevard, Ommegang, Firestone Walker); Monster Beverage (CANarchy); Artisanal Brewing Ventures; Boston Beer (Dogfish Head); employee-owned breweries; and reversals such as Ballast Point and Funky Buddha returning to independent hands.
- Each row has `verified: no` until a primary source is checked. Brewbound (https://www.brewbound.com) and company press releases are the places to confirm; Nombase and Crunchbase for funding rounds.
- The Brewers Association independence test: under 25 percent owned or controlled by an alcohol industry member that is not itself a craft brewer, with production of six million barrels or less.

## distributors

- data/reference/distributors.csv records each brewery's channel (self-distribution or wholesaler), distributor, territory, and source with a verified flag. Sources: company beer finders, state alcohol regulator license lookups (the California ABC license query shows self-distribution rights), distributor portfolio pages, Untappd venue footprints, and launch press. See docs/research-playbook-brewery.md.

## mcp-servers

- No MCP server exists for GABF results, Untappd (closed API), or BeerAdvocate. The unofficial Open Brewery DB MCP server (`@jimbuck/open-brewery-db-mcp` on npm) wraps the same free API this pipeline calls and is configured in .mcp.json for agent sessions in this repository.

## demographics

- data/reference/states.csv keeps the 2020 Census resident population with Census regions (Northeast, Midwest, South, West) and divisions; its columns are unchanged. Rates now use the annual series in data/reference/state-indicators.csv below.
- data/reference/state-indicators.csv is long format (state, year, indicator, value, unit, source, source_url, verified) and is written only by `node scripts/fetch-state-indicators.mjs` (add `--refresh` to redownload; files cache in data/cache). No API key is used: the Census data API now refuses keyless calls, so the script reads the Census bulk files instead.

| indicator | source | year |
|---|---|---|
| population | Census Bureau county and state population estimates, July 1: Vintage 2020 (co-est2020-alldata.csv) for 2018 and 2019, Vintage 2025 (co-est2025-alldata.csv) for 2020 to 2025 | 2018 to 2025; 2026 rows carry the 2025 value and say so |
| gdp_real | BEA SAGDP1 line 1, real GDP in millions of chained 2017 dollars (https://apps.bea.gov/regional/zip/SAGDP.zip) | 2018 to 2025; 2026 uses 2025 |
| gdp_nominal | BEA SAGDP1 line 3, current-dollar GDP in millions | 2018 to 2025; 2026 uses 2025 |
| gdp_per_capita_real | derived: real GDP divided by population, verified `derived` | 2018 to 2026 |
| median_age, share_21_plus, race and Hispanic origin shares (share_hispanic and share_nh_* for not Hispanic white, Black, American Indian and Alaska Native, Asian, Native Hawaiian and Pacific Islander, some other race, two or more), share_hs_or_higher, share_bachelors_or_higher, median_household_income, poverty_rate | ACS 1-year estimates from the table-based summary file, tables B01002, B01001, B03002, B15003, B19013, B17001; line labels are checked against the published table shells at run time | 2024 (the 2025 1-year files were not open for keyless download on 2026-10-13) |
| urban_share | 2020 Census urban and rural state table (State_Urban_Rural_Pop_2020_2010.xlsx) | 2020 |
| literacy_level1_or_below, literacy_mean_score | NCES PIAAC state and county model-based (small area) estimates, Skills Map data file; adults 16 to 74; pooled 2012, 2014, and 2017 survey data; modeled, not measured, and the Census does not measure literacy | stored as 2017 |
| life_expectancy | NCHS U.S. State Life Tables, 2022 (NVSR vol. 74 no. 12, Table A), the latest state tables published; the data.cdc.gov series stops at 2021 | 2022 |

- Puerto Rico has ACS and urban rows only: the state population estimates file, BEA state GDP, PIAAC, and the NCHS tables do not cover it. No medal in the loaded years comes from Puerto Rico.

## federal-reserve-districts

- data/reference/fed-districts.csv (state, district_number, district_name, split, secondary_districts, source, verified) covers the 50 states, DC, Puerto Rico, and the other territories the Board names. Whole states come from the Board of Governors district descriptions (https://www.federalreserve.gov/boarddocs/rptcongress/budgetrev10/maps/districts.htm); DC from the Richmond Fed (https://www.richmondfed.org/about_us). For a split state, district_number is the district holding the larger share of the state's Census Vintage 2020 county population and secondary_districts the other.
- Split states, checked against the Board's descriptions: CT, NJ, PA, KY, WV, IL, IN, MI, WI, MO, TN, MS, LA, NM. The list in the task matched; no other state is split.
- data/reference/fed-district-counties.csv lists every county of the 13 split states with a published county list, its district, and `basis`: `named` when the county appears in a Reserve Bank list, `complement` when it is the rest of the state. Lists: St. Louis Fed district map PDF (https://www.stlouisfed.org/~/media/Files/PDFs/About-Us/8Dmap.pdf) for IL, IN, KY, MS, MO, TN; Minneapolis Fed (https://www.minneapolisfed.org/about-us/the-ninth-district) for WI and MI; Dallas Fed (https://www.dallasfed.org/fed/counties) for LA and NM; the Philadelphia Fed Third District map (Cascade Focus, December 2012, on FRASER) for PA and NJ; the Board for Fairfield County CT. Counts are enforced by `scripts/build-fed-districts.mjs` and the tests: PA 48 and 19 (Cleveland Fed), NJ 9 and 12 (Board), KY 64 and 56 (Cleveland Fed), IL 44, IN 24, MS 39, MO 71 plus St. Louis city, TN 21 (FRASER), WI 26, MI 15, LA 26, NM 18. The St. Louis map prints the Illinois label Wayne out of reading order; its position on the page and the count of 44 place it in Illinois.
- West Virginia: the Cleveland Fed publishes only a count (six northern panhandle counties) and no primary source found names them, so the whole state is assigned to the Richmond district (which the Board describes as covering most of West Virginia) and marked `verified: no` with the word Approximation in the source. Medals there (Elkins) are labeled approximation in the data and on the dashboard; the Fourth District's population and GDP omit the panhandle.
- data/reference/medal-city-counties.csv (state, city, county_fips, county_name, district_number, source, verified, note) resolves every medal city in a split state to its county from the Census 2020 place by county and county subdivision files (https://www2.census.gov/geo/docs/reference/codes2020/). A city spanning several counties keeps all of them when they share a district. Where a name is missing or matches counties in different districts, the Census Geocoder is run on the brewery's Open Brewery DB coordinates (Bucyrus MO, Nashville TN, and Ocean NJ, where Kane Brewing's address places it in Monmouth County). No city is unresolved; a future unresolved city falls back to the state's majority district and is labeled `approximation (city not resolved)`.
- data/reference/district-indicators.csv gives district population, real and nominal GDP, and real GDP per capita for 2018 to 2026. Population sums whole-state estimates and split-state county estimates (Connecticut's Fairfield County is rebuilt for 2020 onward from its 23 town estimates because Census now publishes Connecticut by planning region). Split-state GDP is apportioned and marked (E); see docs/estimation-method.md.
- Rebuild order after a new year or a source revision: `node scripts/build-fed-districts.mjs`, then `node scripts/fetch-state-indicators.mjs`, then the site.

## production-and-revenue

- Reported production is rare for small breweries. Sources when available: Brewers Association top 50 craft brewing companies, local press, company statements, TTB.
- Brewery of the Year brackets from the official list bound a winner's production for that year (basis boty-bracket).
- Everything else is an estimate under docs/estimation-method.md.

## green-cheek-beer-co-sources

Listed at the end of breweries/green-cheek-beer-co.md; the medal rows for 2018, 2019, 2024, and 2025 cite CraftBeer.com, OC Beer Blog, San Diego Beer News, Gear Patrol, Orange Coast, and Craft Beer and Brewing, pending replacement by the official lists.
