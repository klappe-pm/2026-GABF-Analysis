# Method

Method: where the data comes from, what each year covers, and how estimates and rates are made. Linked from the footer.

## `header`

Where: top of the page.

- `title`: Method
- `lede`: Where every number comes from. Official winners lists come first; anything else is labeled, and every estimate is marked (E).

## `coverage`

Where: the coverage section. Status labels and meanings come from labels.yaml (coverage, coverage_meaning).

- `title`: Coverage by Year
- `lede`: The record runs {{first_year}} to {{last_year}}. Complete official lists cover {{complete_range}}.

### `columns`

- `year`: Year
- `status`: Status
- `rows`: Medals Loaded
- `sources`: Sources

## `sources`

Where: the data sources section, one item per source.

- `title`: Data Sources
- `results`: Results: the official Great American Beer Festival winners lists, published by the Brewers Association. Category names and entry counts come from the same lists. Before a list is posted, medals can be drafted from the awards ceremony broadcast; those rows are marked draft until the list replaces them.
- `breweries`: Brewery locations, coordinates, types, and websites: Open Brewery DB, an open database, with curated corrections.
- `styles`: Style definitions and ABV, IBU, and SRM ranges: the Brewers Association Beer Style Guidelines. Special categories are flagged by a naming rule and a setting for each category.
- `ownership`: Ownership, investors, and distributors: curated from public announcements, including company releases, Brewbound, trade press, and state license lookups. Each row says whether it has been checked against a primary source.
- `population`: Population and economy: Census Bureau annual population estimates (July 1; Vintage 2020 for 2018 and 2019, Vintage 2025 for 2020 to 2025) and Bureau of Economic Analysis real GDP in 2017 dollars and nominal GDP, by state and county. {{latest_year}} medals use {{data_year}} figures, the latest published.
- `demographics`: Demographic controls: American Community Survey 2024 one year estimates (age, race and Hispanic origin, education, median household income, poverty), the 2020 Census urban share, modeled literacy from the PIAAC survey (2012, 2014, and 2017 pooled), and 2022 state life expectancy from the National Center for Health Statistics. Census regions and divisions follow the Census Bureau.
- `fed_districts`: Federal Reserve districts: the Board of Governors' district descriptions and the Reserve Banks' county lists (St. Louis, Minneapolis, Dallas, Philadelphia), with counts checked against Cleveland Fed and FRASER figures.
- `totals`: Competition totals: the Brewers Association's annual announcements and same day coverage of each.
- `winning_beers`: Winning beer specs: the brewery's own pages and the sources cited on each beer page. A spec no source publishes reads Not published; nothing is estimated.

## `rates`

Where: the rates section.

- `title`: Medals per Resident and per Dollar of GDP
- `body`: Each medal counts against its own year. Medals per million residents adds, for every medal, one million divided by its place's population that year. Medals per $100 billion of real GDP does the same with real GDP. A year with no published figure uses the nearest published year.

## `fed_districts`

Where: the Fed district section.

- `title`: Placing Medals in Fed Districts
- `body`: Most states sit in one district. In a split state, a medal is placed by the county of the medal city. West Virginia has no published county list, so it is assigned whole to the Richmond district as an approximation. District GDP for split states is apportioned by county GDP shares (E).

## `estimates`

Where: the estimates section. Linked from every (E).

- `title`: Estimates
- `intro`: Production, volume, revenue, and margin figures marked (E) are estimates.
- `volume`: Volume uses the best source available, in this order: a reported figure, the midpoint of a Brewery of the Year size bracket, a curated estimate or brewery profile, then an estimate from brewery type and number of locations.
- `conversions`: Conversions use the US beer barrel of 31 gallons: 13.78 cases of 24 twelve ounce containers, 248 sixteen ounce cans or pints, or 330.7 twelve ounce cans.
- `revenue`: Revenue uses Brewers Association benchmark revenue per barrel by sales channel ({{direct_revenue_per_barrel}} direct to consumer, {{distributed_revenue_per_barrel}} distributed, blended by brewery type), plus food revenue for each location with a kitchen. ARR is annual revenue at the current run rate.
- `margins`: Gross margin and EBITDA margin are point estimates by brewery type, with ranges by channel: taproom {{taproom_margin_range}}, self distribution {{self_margin_range}}, distributor {{distributor_margin_range}}.

## `year_status`

Where: the year status section, which explains the notes on brewery charts.

- `title`: Year Status on Brewery Pages
- `body`: Each year on a brewery page has one status: medaled, no medal, not yet founded, closed, results not loaded, partial year, or no results for this year. A partial year is never counted as a miss.

## `first_time`

Where: the first time medalists section.

- `title`: First Time Medalists
- `body`: A first time medalist has no medal in any loaded year before the year shown. Years that are not loaded cannot count against a brewery, so first always means first in the record.

## `keyboard`

Where: the keyboard section.

- `title`: Keyboard
