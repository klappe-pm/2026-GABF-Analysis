---
domain: beer
category: gabf-analysis
sub-category: docs
topics:
  - data-sources
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

# data-sources

## results

- Official winners lists, Brewers Association. Published as a PDF the day of the awards. Known locations: 2021 at https://www.greatamericanbeerfestival.com/wp-content/uploads/2021/10/GABF21-Winners-List-2.pdf, 2024 at https://cdn.greatamericanbeerfestival.com/wp-content/uploads/GABF24-Winners-List.pdf, 2025 at https://cdn.brewersassociation.org/wp-content/uploads/2025/10/11090251/GABF25-Winners-List.pdf. The 2022 and 2023 lists are linked from the Brewers Association press releases (The Nation's Best Beers of 2023 at https://www.brewersassociation.org/press-releases/the-nations-best-beers-of-2023/). `scripts/fetch-winners.mjs` tries these patterns and accepts `--url`.
- Format: `Category N: Name - N Entries` headers followed by `Gold:`, `Silver:`, and `Bronze:` lines of the form beer, brewery, city, state. Multi-location breweries are printed with a location suffix. Brewery and Brewer of the Year lines follow the categories; Pro-Am and Collaboration sections appear in some years.
- Competition totals: Brewers Association releases (2020: 272 medals, 240 breweries, 91 categories, 8,806 entries, 1,720 breweries; 2021: 290 medals, 265 breweries, 97 categories, 9,680 entries, 2,192 breweries; 2022: 300 medals, 268 breweries, 98 categories, 9,904 entries; 2025: 347 medals, 273 breweries and cideries, 8,315 entries, 1,555 breweries). 2023 and 2024 totals are filled by the ingest.
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

## demographics

- US Census 2020 resident population by state, with Census regions (Northeast, Midwest, South, West) and divisions, in data/reference/states.csv. Used for medals per million residents.

## production-and-revenue

- Reported production is rare for small breweries. Sources when available: Brewers Association top 50 craft brewing companies, local press, company statements, TTB.
- Brewery of the Year brackets from the official list bound a winner's production for that year (basis boty-bracket).
- Everything else is an estimate under docs/estimation-method.md.

## green-cheek-beer-co-sources

Listed at the end of breweries/green-cheek-beer-co.md; the medal rows for 2018, 2019, 2024, and 2025 cite CraftBeer.com, OC Beer Blog, San Diego Beer News, Gear Patrol, Orange Coast, and Craft Beer and Brewing, pending replacement by the official lists.
