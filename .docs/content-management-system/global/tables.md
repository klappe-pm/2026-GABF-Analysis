# Tables

Column headers and controls shared by tables on many pages. A page file sets only the columns that are unique to it.

## `medal_columns`

Where: the column headers of every medal table (results, brewery history, category medalists).

- `medal`: Medal
- `beer`: Beer
- `brewery`: Brewery
- `category`: Category
- `year`: Year
- `city`: City
- `state`: State
- `entrants`: Entrants

- `location_credited`: Location credited



- `field`: Field (entries)
- `entries_per_medal`: Entries per medal
- `style_family`: Style family
- `abv`: ABV
- `abv_style`: ABV (style range)
- `abv_style_value`: {{min}} to {{max}}% (style)
- `ownership`: Ownership
- `distribution`: Distribution
- `notes`: Notes
- `competition`: Competition

## `brewery_columns`

Where: the column headers of every brewery ranking table.

- `rank`: Rank
- `brewery`: Brewery
- `hq`: Headquarters
- `type`: Type
- `medals`: Medals
- `medal_split`: Gold / silver / bronze
- `points`: Points
- `first`: First medal
- `first_in_view`: First medal in view
- `latest`: Latest medal
- `streak`: Streak
- `ownership`: Ownership
- `distribution`: Distribution
- `arr`: ARR (E)

## `category_columns`

Where: the column headers of every category table.

- `category`: Category
- `type`: Type
- `style_family`: Style family
- `abv`: ABV (style range)
- `abv_value`: {{min}} to {{max}}%
- `latest_entrants`: Latest entrants
- `year`: Year
- `medals_in_view`: Medals in view
- `years`: Years

## `place_columns`

Where: the column headers of every state, region, or district table.

- `state`: State
- `region`: Region
- `division`: Division
- `district`: Fed district
- `name`: Name
- `medals`: Medals
- `gold`: Gold
- `breweries`: Breweries
- `states`: States
- `population`: Population, {{year}}
- `latest_year`: {{year}} medals
- `per_million`: Per million residents
- `per_100b_gdp`: Per $100B real GDP
- `per_100b_gdp_estimate`: Per $100B real GDP (E)

## `pager`

Where: below any long medal table.

- `showing`: Showing {{shown}} of {{total}} medals, newest first.
- `show_more`: Show {{count}} more
- `show_all`: Show all

## `sorting`

Where: sortable column headers, for screen readers.

- `hint`: Select a column header to sort.

## `download`

Where: above medal tables on results and dashboard pages.

- `button`: Download medals in view (CSV)
