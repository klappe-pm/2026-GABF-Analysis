# Dashboards

Dashboards: the interactive chart pages and the single file dashboard. Whether these stay as their own section under the new navigation is an open decision (see content/README.md).

## `index`

Where: the dashboards index page and the tab row at the top of every dashboard.

- `title`: Dashboards
- `overview`: Overview
- `overview_description`: Medals by year, state, style family, and brewery.
- `geography`: Geography
- `geography_description`: The US map, Census regions and divisions, Fed districts, medals per million residents and per dollar of real GDP, and demographic controls.
- `categories`: Categories
- `categories_description`: Entrants by category, the hardest categories to medal in, and classic versus special categories.
- `breweries`: Breweries
- `breweries_description`: Pick a brewery: medals by year, by category, and by location.
- `economics`: Ownership and Economics
- `economics_description`: Ownership, parent companies, and estimated revenue, margins, and distribution.

## `overview`

Where: the overview dashboard.

- `title`: Great American Beer Festival Results
- `lede`: Which states, styles, and breweries keep winning. Start with medals by year, then see where they land on the map, which style families win most, and which breweries lead on points. Select a bar, column, or state to filter by it.
- `results_title`: Medal Winners
- `deep_dives_title`: Brewery Deep Dives
- `deep_dive_meta`: {{city}}, {{state}} · {{count}} medals in the record

## `geography`

Where: the geography dashboard.

- `title`: Geography
- `lede`: Where the medals go: by state, Census region and division, and Federal Reserve district, and per million residents and per $100 billion of real GDP in each medal's year. Select a state, region, or district to filter by it.
- `controls_title`: Controls by State and District
- `controls_rows`: Rows
- `controls_states`: States
- `controls_districts`: Federal Reserve Districts
- `controls_note`: Rates count each medal against its own year's population and real GDP. Controls: American Community Survey 2024 (age, race and Hispanic origin, education, income, poverty), 2020 Census urban share, modeled literacy from the PIAAC survey (2012, 2014, and 2017 pooled), and 2022 life expectancy. District demographics are not compiled. District GDP for split states is apportioned (E), and West Virginia is assigned whole to the Richmond district (approximation). See Method.

## `categories`

Where: the categories dashboard.

- `title`: Categories
- `lede`: Entrants by category from the official list, the hardest categories to medal in, the classic and special split by year, and category size against how many breweries medal.
- `results_title`: Medal Winners

## `breweries`

Where: the breweries dashboard.

- `title`: Breweries
- `lede`: Pick a brewery to see its medals by year, its categories, and the locations credited. Years before it opened and years not loaded are marked. Filters still apply to the tiles and the table.
- `picker_label`: Brewery
- `picker_option`: {{brewery_name}} ({{count}})
- `picker_meta_founded`: founded {{year}}
- `picker_profile_link`: Open profile
- `pick_prompt`: Pick a brewery above.
- `results_title`: Medal Winners

## `economics`

Where: the ownership and economics dashboard.

- `title`: Ownership and Economics
- `lede`: Who owns the medalists and what they are worth: ownership, parent companies, and estimated revenue, ARR, gross margin, EBITDA, and distribution for each brewery. Every financial figure is an estimate (E); see Method.
- `table_title`: Financials by Brewery

### `columns`

- `brewery`: Brewery
- `type`: Type
- `barrels`: Barrels (E)
- `arr`: ARR (E)
- `gross_margin`: Gross Margin (E)
- `ebitda`: EBITDA (E)
- `ebitda_value`: {{ebitda}} ({{low}} to {{high}}%)
- `distribution`: Distribution
- `ownership`: Ownership
- `basis`: Volume Basis

## `stats`

Where: the summary tiles on every dashboard.

- `medals`: Medals in View
- `breweries`: Breweries
- `states`: States
- `categories`: Categories
- `categories_note`: {{count}} medals in special categories
- `medal_split`: Gold, Silver, Bronze
- `entrants`: Entrants in These Categories
- `entrants_note`: Sum of category entry counts
- `entrants_missing`: Not Published

## `panels`

Where: the panels. Each has a title and, where set, a subtitle and a note under the chart.

### `medals_by_year`

- `title`: Medals by Year
- `subtitle`: Stacked by medal. Select a column to filter by that year.
- `coverage_column`: Coverage

### `map`

- `title`: Medals by State
- `subtitle`: Select a state to filter by it.

### `by_family`

- `title`: Medals by Style Family
- `subtitle`: Select a family to filter by it.

### `top_breweries`

- `title`: Top Breweries
- `subtitle`: Ranked by points (gold 3, silver 2, bronze 1). Select a brewery to open it.

### `by_region`

- `title`: Medals by Census Region

### `by_division`

- `title`: Medals by Census Division

### `per_capita`

- `title`: Medals per Million Residents, by State
- `subtitle`: Each medal against its year's Census population; {{latest_year}} uses {{data_year}}.

### `per_gdp`

- `title`: Medals per $100 billion of real GDP, by state
- `subtitle`: Real GDP in 2017 dollars, in each medal's year; {{latest_year}} uses {{data_year}}.

### `by_fed_district`

- `title`: Medals by Federal Reserve District
- `subtitle`: Most medals first. Split states are placed by the medal city's county. Select a district to filter by it.
- `note_one`: 1 medal in view is in West Virginia, which is assigned whole to the Richmond district as an approximation.
- `note_many`: {{count}} medals in view are in West Virginia, which is assigned whole to the Richmond district as an approximation.

### `district_rates`

- `title`: Medals per Million Residents, by Fed District
- `subtitle`: District population from whole states plus split state counties, in each medal year.
- `note`: Medals per $100 billion of real GDP are in the table view. GDP for split states is apportioned by county GDP shares (E).

### `entrants`

- `title`: Entrants by Category
- `subtitle`: Entries judged, most crowded first. Special categories are marked. Select a category to filter by it.
- `note`: Entry counts come from the official list. A partial year shows counts for its loaded medals only.

### `entry_odds`

- `title`: Hardest Categories to Medal in
- `subtitle`: Entries per medal, highest first. Select a category to filter by it.

### `special_share`

- `title`: Classic and Special Categories by Year

### `entries_vs_breweries`

- `title`: Category Size and Medal Spread
- `subtitle`: Entries judged against the number of breweries that medaled, across the years in view.

### `brewery_trend`

- `title`: Medals by Year
- `subtitle`: {{brewery_name}}, Every Medal in the Record

### `brewery_categories`

- `title`: Medals by Category

### `brewery_locations`

- `title`: Medals by Location Credited

### `ownership_share`

- `title`: Medals by Ownership

### `parents`

- `title`: Medals by Parent Company
- `subtitle`: Owners That Are Not Independent
- `empty`: No medalist in view is owned by a large brewer or other company.

### `revenue`

- `title`: Estimated Annual Revenue by Brewery (E)
- `subtitle`: Breweries in view. See Method for how revenue is estimated.
- `basis_column`: Basis

### `entries_trend`

- `title`: Entries Judged by Year
- `subtitle`: Brewers Association totals. A year with no published figure is blank.

### `medals_trend`

- `title`: Medals Awarded and Winning Breweries
- `subtitle`: Brewers Association totals. A year with no published figure is blank.

## `single_file`

Where: the single file dashboard (one HTML file that works offline).

- `title`: Great American Beer Festival Results Dashboard
- `description`: Interactive Great American Beer Festival results dashboard in one file. Open it in any browser.
- `tab_tooltip`: Filter every tab (press F)
- `lede_file`: Every medal in the record, in one file that works offline. Filters apply to every tab, charts filter when you select a bar or state, each chart saves as a PNG, and the address bar keeps your filters so a view can be bookmarked.
- `lede_hosted`: Every medal in the record. Filters apply to every tab, charts filter when you select a bar or state, and each chart saves as a PNG. All data is in this page.
- `about_file`: All data is in this file as of its last build, so it works offline and nothing leaves your device.
- `about_hosted`: All data is in this page as of its last build, and the page makes no network requests.
- `results_title`: Medal Winners

### `tabs`

- `overview`: Overview
- `geography`: Geography
- `categories`: Categories
- `breweries`: Breweries
- `economics`: Ownership and Economics
- `data`: Data
- `about`: About
