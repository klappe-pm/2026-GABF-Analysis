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
- `economics`: Ownership and economics
- `economics_description`: Ownership, parent companies, and estimated revenue, margins, and distribution.

## `coverage`

Where: the row of year chips under the tabs on every dashboard. Each links to the Method page.

- `label`: Coverage by year
- `chip`: {{year}}, {{status}}

## `overview`

Where: the overview dashboard.

- `title`: Great American Beer Festival results
- `lede`: Which states, styles, and breweries keep winning. Start with medals by year, then see where they land on the map, which style families win most, and which breweries lead on points. Select a bar, column, or state to filter by it.
- `results_title`: Medal Winners
- `deep_dives_title`: Brewery deep dives
- `deep_dive_meta`: {{city}}, {{state}} · {{count}} medals in the record

## `geography`

Where: the geography dashboard.

- `title`: Geography
- `lede`: Where the medals go: by state, Census region and division, and Federal Reserve district, and per million residents and per $100 billion of real GDP in each medal's year. Select a state, region, or district to filter by it.
- `controls_title`: Controls by state and district
- `controls_rows`: Rows
- `controls_states`: States
- `controls_districts`: Federal Reserve districts
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

- `title`: Ownership and economics
- `lede`: Who owns the medalists and what they are worth: ownership, parent companies, and estimated revenue, ARR, gross margin, EBITDA, and distribution for each brewery. Every financial figure is an estimate (E); see Method.
- `table_title`: Financials by brewery

### `columns`

- `brewery`: Brewery
- `type`: Type
- `barrels`: Barrels (E)
- `arr`: ARR (E)
- `gross_margin`: Gross margin (E)
- `ebitda`: EBITDA (E)
- `ebitda_value`: {{ebitda}} ({{low}} to {{high}}%)
- `distribution`: Distribution
- `ownership`: Ownership
- `basis`: Volume basis

## `stats`

Where: the summary tiles on every dashboard.

- `medals`: Medals in view
- `breweries`: Breweries
- `states`: States
- `categories`: Categories in view
- `categories_note`: {{count}} medals in special categories
- `medal_split`: Gold, silver, bronze
- `entrants`: Entrants in these categories
- `entrants_note`: Sum of category entry counts
- `entrants_missing`: Not published

## `panels`

Where: the panels. Each has a title and, where set, a subtitle and a note under the chart.

### `medals_by_year`

- `title`: Medals by year
- `subtitle`: Stacked by medal. Select a column to filter by that year.
- `coverage_column`: Coverage

### `map`

- `title`: Medals by state
- `subtitle`: Select a state to filter by it.

### `map_ranked`

- `title`: States with the most medals
- `subtitle`: The 20 states with the most medals, colored by Census region. Select a state to filter by it.

### `by_family`

- `title`: Medals by style family
- `subtitle`: Area is medals, so the biggest families are the biggest blocks. Select a family to filter by it.
- `tip`: Categories: {{categories}}. Most medals: {{top}} ({{top_medals}}).

### `top_breweries`

- `title`: Top breweries
- `subtitle`: Ranked by points (gold 3, silver 2, bronze 1). Select a brewery to open it.
- `total`: {{count}} points

### `by_region`

- `title`: Medals by Census region

### `by_division`

- `title`: Medals by Census division

### `per_capita`

- `title`: Medals per million residents, by state
- `subtitle`: Each medal against its year's Census population; {{latest_year}} uses {{data_year}}.

### `per_gdp`

- `title`: Medals per $100 billion of real GDP, by state
- `subtitle`: Real GDP in 2017 dollars, in each medal's year; {{latest_year}} uses {{data_year}}.

### `by_fed_district`

- `title`: Medals by Federal Reserve district
- `subtitle`: Most medals first. Split states are placed by the medal city's county. Select a district to filter by it.
- `note_one`: 1 medal in view is in West Virginia, which is assigned whole to the Richmond district as an approximation.
- `note_many`: {{count}} medals in view are in West Virginia, which is assigned whole to the Richmond district as an approximation.

### `district_rates`

- `title`: Medals per million residents, by Fed district
- `subtitle`: District population from whole states plus split state counties, in each medal year.
- `note`: Medals per $100 billion of real GDP are in the table view. GDP for split states is apportioned by county GDP shares (E).

### `entrants`

- `title`: Entrants by category
- `subtitle`: Entries judged, most crowded first. Special categories are marked. Select a category to filter by it.
- `note`: Entry counts come from the official list. A partial year shows counts for its loaded medals only.

### `entry_odds`

- `title`: Hardest categories to medal in
- `subtitle`: Entries per medal, highest first. Select a category to filter by it.
- `note`: Entries divided by medals awarded in the category, pooled over the years in view.
- `missing_one`: 1 medal in view has no published entry count and is left out.
- `missing_many`: {{count}} medals in view have no published entry count and are left out.
- `empty`: No medal in view has a published entry count.

### `entry_odds_heat`

- `title`: Crowding by year
- `subtitle`: Entries per medal for each category in each year. A blank cell means the category was not offered.

### `special_share`

- `title`: Classic and special categories by year

### `entries_vs_breweries`

- `title`: Category size and medal spread
- `subtitle`: Entries judged against the number of breweries that medaled, across the years in view.

### `brewery_trend`

- `title`: Medals by year
- `subtitle`: {{brewery_name}}, every medal in the record

### `brewery_categories`

- `title`: Medals by category

### `brewery_locations`

- `title`: Medals by location credited

### `ownership_share`

- `title`: Medals by ownership

### `parents`

- `title`: Medals by parent company
- `subtitle`: Owners that are not independent
- `empty`: No medalist in view is owned by a large brewer or other company.

### `revenue`

- `title`: Estimated annual revenue by brewery (E)
- `subtitle`: Breweries in view. See Method for how revenue is estimated.
- `basis_column`: Basis

### `entries_trend`

- `title`: Entries judged by year
- `subtitle`: Brewers Association totals. A year with no published figure is blank.

### `medals_trend`

- `title`: Medals awarded and winning breweries
- `subtitle`: Brewers Association totals. A year with no published figure is blank.

## `chart`

Where: every dashboard chart.

- `aria`: {{title}}. The same values are in the table view under the chart.
- `loading`: Loading the medals…
- `bin_range`: {{min}} to {{max}}
- `bin_single`: {{min}}
- `bin_open`: {{min}} or more
- `ibu`: IBU

## `single_file`

Where: the single file dashboard (one HTML file that works offline).

- `title`: Great American Beer Festival results dashboard
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
- `economics`: Ownership and economics
- `data`: Data
- `about`: About
