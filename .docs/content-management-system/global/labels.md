# Labels

The one label dictionary. Each key is the raw value stored in the data; each value is the label people see. Change the value, never the key. A raw value missing here reads "Not Found".

- `not_found`: Not Found

## `medal`

Where: medal columns, chips, chart legends, and stat tiles.

- `Gold`: Gold
- `Silver`: Silver
- `Bronze`: Bronze
- `Honorable Mention`: Honorable Mention

## `section`

Where: the Competition Section filter and its chips.

- `main`: Main Competition
- `pro-am`: Pro-Am
- `collaboration`: Collaboration

## `characteristic`

Where: the Category Characteristic filter and its chips; each is found by words in the category name.

- `sour`: Sour or Wild Category
- `fruit`: Fruit Category
- `spice`: Herb or Spice Category
- `coffee`: Coffee Category
- `chocolate`: Chocolate Category
- `barrel_aged`: Wood or Barrel Category
- `non_alcoholic`: Nonalcoholic Category
- `gluten_free`: Gluten-Free Category

## `competition`

Where: competition column on brewery pages (other competitions table).

- `GABF`: Great American Beer Festival
- `WBC`: World Beer Cup

## `ownership_type`

Where: ownership pills, ownership columns, the Ownership filter, and the ownership charts.

- `independent`: Independent
- `employee-owned`: Employee Owned
- `public-company-owned`: Owned by a Public Company
- `large-brewer-owned`: Owned by a Large Brewer
- `private-equity-backed`: Backed by Private Equity
- `beverage-conglomerate-owned`: Owned by a Beverage Company
- `closed`: Closed
- `unlisted`: Not Found

## `distribution_channel`

Where: distribution pills, distribution columns, and the Distribution filter.

- `self-distribution`: Self Distributed
- `distributor`: Through a Distributor
- `taproom`: Taproom Only
- `unknown`: Not Found
- `(blank)`: Not Found

## `brewery_type`

Where: brewery type pills, type columns, and the Brewery type filter.

- `micro`: Microbrewery
- `nano`: Nanobrewery
- `brewpub`: Brewpub
- `regional`: Regional Brewery
- `large`: Large Brewery
- `contract`: Contract Brewer
- `proprietor`: Alternating Proprietor
- `planning`: In Planning
- `bar`: Bar
- `taproom`: Taproom
- `closed`: Closed

## `category_type`

Where: category type pills, columns, and the Category type filter.

- `classic`: Classic Style
- `special`: Special

## `category_pill`

Where: the pill beside a category name in medal tables and on category pages.

- `special_short`: Special
- `classic_short`: Classic
- `special_long`: Special Category
- `classic_long`: Classic Style Category

## `region`

Where: the Region filter, region columns, and the region charts. Census regions.

- `Northeast`: Northeast
- `Midwest`: Midwest
- `South`: South
- `West`: West
- `Territories`: Territories

## `division`

Where: division columns and the division charts. Census divisions.

- `New England`: New England
- `Middle Atlantic`: Middle Atlantic
- `East North Central`: East North Central
- `West North Central`: West North Central
- `South Atlantic`: South Atlantic
- `East South Central`: East South Central
- `West South Central`: West South Central
- `Mountain`: Mountain
- `Pacific`: Pacific
- `Puerto Rico`: Puerto Rico

## `style_family`

Where: the Style family filter, style family columns, and chart labels.

- `IPA`: IPA
- `Pale Ale`: Pale Ale
- `Lager`: Lager
- `Pilsner`: Pilsner
- `Wheat`: Wheat
- `Stout and Porter`: Stout and Porter
- `Belgian and French`: Belgian and French
- `Sour and Wild`: Sour and Wild
- `Strong and Barrel-Aged`: Strong and Barrel-Aged
- `Brown, Amber, and Red`: Brown, Amber, and Red
- `British and Irish`: British and Irish
- `German Ale`: German Ale
- `Fruit, Spice, and Specialty`: Fruit, Spice, and Specialty
- `Smoke and Wood`: Smoke and Wood
- `Gluten-Free and Non-Alcoholic`: Gluten-Free and Nonalcoholic
- `Cider and Mead`: Cider and Mead
- `Pro-Am and Collaboration`: Pro-Am and Collaboration
- `Other`: Other
- `Fruit`: Fruit
- `Brown`: Brown

## `abv_band`

Where: the ABV filter and chips.

- `under-4`: Under 4%
- `4-to-5`: 4.0% to 4.9%
- `5-to-6`: 5.0% to 5.9%
- `6-to-7`: 6.0% to 6.9%
- `7-to-8`: 7.0% to 7.9%
- `8-to-10`: 8.0% to 9.9%
- `10-plus`: 10% and Up

## `coverage`

Where: year pills, the coverage table, and chart notes under each year.

- `complete`: Complete
- `partial`: Partial
- `draft`: Draft
- `pending`: Not Loaded

## `coverage_meaning`

Where: method page and the tooltip on each year pill.

- `complete`: The official winners list is loaded.
- `partial`: Only a sample of medals from secondary sources is loaded.
- `draft`: Medals transcribed from the awards ceremony; the official list is not out yet.
- `pending`: The competition year is in range, but no results are loaded.

## `trend_status`

Where: a brewery's year by year status, in tables and the recent trend list.

- `medaled`: Medaled
- `no-medal`: No Medal
- `did-not-exist`: Not Yet Founded
- `closed`: Closed
- `not-yet-reported`: Results Not Loaded
- `no-data`: Partial Year
- `no-results`: No Results for This Year

## `trend_status_short`

Where: short note under the year on medal by year charts. Empty means no note.

- `did-not-exist`: Not Founded
- `not-yet-reported`: Not Loaded
- `no-data`: Partial
- `no-results`: No Results
- `closed`: Closed
- `medaled`:
- `no-medal`:

## `trend_status_glyph`

Where: the one character note under a year on narrow screens.

- `not-yet-reported`: …
- `no-data`: ·
- `draft`: ·
- `no-results`: ○
- `did-not-exist`: ×
- `closed`: ×

## `first_time`

Where: first time medalist tables and chips.

- `new`: First Medal in the Record
- `new-complete`: First Medal in the Complete Record

## `estimate_basis`

Where: the basis beside every barrel estimate.

- `reported`: Reported
- `boty-bracket`: Brewery of the Year Size Bracket (E)
- `bracket`: Size Bracket (E)
- `estimate`: Curated Estimate (E)
- `curated`: Curated Estimate (E)
- `profile estimate`: Brewery Profile Estimate (E)
- `type-heuristic`: Estimated from Brewery Type (E)
- `heuristic`: Estimated from Brewery Type (E)

## `confidence`

Where: the confidence beside every barrel estimate.

- `high`: High Confidence
- `medium`: Medium Confidence
- `low`: Low Confidence
- `approximate`: Approximate

## `yes_no`

Where: brewery ownership details and the ownership table.

- `yes`: Yes
- `no`: No

## `verified`

Where: the verified column of the ownership table and distributor details.

- `yes`: Checked Against a Primary Source
- `no`: Not Checked

## `fed_district`

Where: the Fed district filter, district charts, and district columns.

- `1`: Boston
- `2`: New York
- `3`: Philadelphia
- `4`: Cleveland
- `5`: Richmond
- `6`: Atlanta
- `7`: Chicago
- `8`: St. Louis
- `9`: Minneapolis
- `10`: Kansas City
- `11`: Dallas
- `12`: San Francisco
- `label_format`: {{number}} {{name}}

## `fed_district_method`

Where: method page and district tooltips; how a medal was placed in a district.

- `state`: Whole State in One District
- `county`: Placed by the Medal City's County
- `approximation`: Whole State Assigned to Its Main District (Approximation)
- `approximation (city not resolved)`: City not placed; assigned to the state's main district (approximation)

## `indicator`

Where: column headers of the state and district controls table on the geography dashboard.

- `gdp_per_capita_real`: Real GDP per Person (2017 Dollars)
- `gdp_per_capita_real_latest`: Real GDP per Person, {{year}} (2017 Dollars)
- `median_household_income`: Median Household Income (2024 Dollars)
- `median_age`: Median Age
- `share_21_plus`: Age 21 and Over (%)
- `share_bachelors_or_higher`: Bachelor's Degree or Higher (%)
- `share_hs_or_higher`: High School or Higher (%)
- `poverty_rate`: Poverty Rate (%)
- `share_nh_white`: White, Not Hispanic (%)
- `share_nh_black`: Black, Not Hispanic (%)
- `share_hispanic`: Hispanic or Latino (%)
- `share_nh_asian`: Asian, Not Hispanic (%)
- `urban_share`: Urban, 2020 (%)
- `literacy_level1_or_below`: Literacy at or Below Level 1 (%, Modeled)
- `life_expectancy`: Life Expectancy, 2022

## `points`

Where: medal points wherever points are explained.

- `explanation`: Points: gold 3, silver 2, bronze 1.
