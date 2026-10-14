# Analysis report

Analysis reports: the ready made report pages, one group per report. Titles and list descriptions live in analysis-index.yaml.

## `common`

Where: link above every report title.

- `back`: All Analysis

## `top_breweries`

Where: the top breweries report.

- `lede`: Points weight gold 3, silver 2, bronze 1. Rankings use the medals in view. Partial years count only when you include them in Filters.
- `chart_title`: Top 15 Breweries by Points
- `chart_subtitle`: Medals in View
- `streaks_title`: Longest Active Streaks
- `streaks_note`: Consecutive years with a medal, through {{year}}. A streak needs every year, so it uses the full record and ignores Filters.
- `streak_item`: {{brewery_name}}: {{count}} years
- `streaks_empty`: No streak longer than one year.
- `first_time_line`: Breweries whose first medal came in {{year}}: see the first time medalists.
- `first_time_link`: first time medalists
- `table_title`: Top 50 in View
- `year_heading`: {{year}}

## `top_categories`

Where: the top categories report.

- `lede`: Entry counts come from the official list and show where competition is fiercest. Entries per medal reads each category as odds: how many entries each medal had to beat. Special categories are marked.
- `most_entered_title`: Most Entered Categories
- `most_entered_subtitle`: Latest Year in View with Entry Counts
- `most_entered_empty`: No entry counts in view.
- `special_suffix`: (Special)
- `families_title`: Medals by Style Family
- `odds_title`: Hardest Categories to Medal in
- `odds_subtitle`: Entries per Medal, Highest First
- `odds_note`: Entries divided by medals awarded in the category, pooled over the years in view.
- `odds_missing_one`: 1 medal in view has no published entry count and is left out.
- `odds_missing_many`: {{count}} medals in view have no published entry count and are left out.
- `table_title`: All Categories in View

### `odds_columns`

- `category`: Category
- `entries_per_medal`: Entries per Medal
- `entries`: Entries
- `medals_awarded`: Medals Awarded
- `years`: Years

## `by_state`

Where: the by state report.

- `lede`: Medals by state, adjusted for population and economy. Each medal counts against its own year's Census population and real GDP; {{latest_year}} medals use {{data_year}}, the latest published year.
- `map_title`: Medals by State
- `map_subtitle`: Medals in View
- `map_tooltip`: {{state}}: {{count}} medals
- `bars_title`: Medals by State
- `bars_subtitle`: Top 20
- `per_capita_title`: Medals per Million Residents
- `per_capita_subtitle`: Top 20, by Each Year's Population
- `table_title`: All States in View

## `by_region`

Where: the by region report.

- `lede`: Medals by Census region (Northeast, Midwest, South, West) and division. Per million residents uses each medal year's Census population.
- `regions_title`: Medals by Region
- `divisions_title`: Medals by Division

## `ownership`

Where: the ownership report.

- `lede`: Who owns the medal winners. The Brewers Association counts a brewer as independent when less than 25 percent is owned or controlled by an alcohol company that is not a craft brewer. Ownership here is curated from public deal announcements, and each row says whether it has been checked against a primary source. Breweries without ownership research count as independent.
- `stat_independent`: Medals to Independent Breweries
- `stat_independent_note`: {{count}} of {{total}} medals in view; breweries without ownership research count as independent
- `stat_listed`: Medalists with Ownership Research
- `stat_owned`: Medalists Owned by a Large Brewer or Other Company
- `by_type_title`: Medals by Ownership
- `parents_title`: Medals by Parent Company
- `parents_subtitle`: Owners That Are Not Independent
- `parents_empty`: No medalist in view is owned by a large brewer or other company.
- `table_title`: Ownership Research
- `table_note`: Every researched brewery, whether or not it medaled in the years in view. Filters do not narrow this table.

### `columns`

- `brewery`: Brewery
- `hq`: Headquarters
- `type`: Ownership
- `parent`: Parent
- `investors`: Investors
- `stake`: Stake
- `year`: Deal Year
- `ba_independent`: Independent (Brewers Association)
- `status`: Status
- `verified`: Checked

## `economics`

Where: the economics report.

- `lede`: Estimated economics for every medalist in view: barrels, annual revenue (ARR), gross margin, EBITDA with a range by sales channel, and distribution. Every figure is an estimate (E) unless a reported production figure exists. See Method for how each is made.
- `chart_title`: Estimated ARR by Brewery (E)
- `chart_subtitle`: Top 15 Medalists in View
- `table_title`: All Medalists in View
- `estimate_loading`: Loading how this estimate was made.
- `estimate_failed`: The estimate details could not be loaded. Try again later.

### `columns`

- `brewery`: Brewery
- `type`: Type
- `locations`: Locations
- `barrels`: Barrels (E)
- `basis`: Volume Basis
- `cases`: Case Equivalents
- `arr`: ARR (E)
- `gross_margin`: Gross Margin (E)
- `ebitda`: EBITDA (E)
- `ebitda_range`: EBITDA Margin Range (E)
- `distribution`: Distribution
- `ownership`: Ownership

## `trends`

Where: the trends report.

- `lede`: Competition scale from the Brewers Association's annual announcements, plus style family share and the biggest movers from the record. A blank cell is a figure the announcement did not state.
- `fixed_note`: The first two charts and the scale table are totals for the whole competition, so Filters do not change them. The style family chart and the movers follow Filters.
- `entries_title`: Entries Judged
- `medals_title`: Medals Awarded and Breweries Entering
- `scale_title`: Competition Scale by Year
- `families_section`: Style Families and Movers
- `families_title`: Medals by Style Family and Year
- `families_subtitle`: Top Seven Families in View, Plus Other
- `movers_title`: Movers, {{previous_year}} to {{year}}
- `gained`: Gained
- `lost`: Lost
- `movers_empty`: Movers appear when two complete years are in view.

### `scale_columns`

- `year`: Year
- `date`: Awards Date
- `venue`: Venue
- `entries`: Entries
- `breweries_entering`: Breweries Entering
- `medals`: Medals
- `winning_breweries`: Winning Breweries
- `categories`: Categories
- `loaded`: Coverage
- `notes`: Notes

## `brewery_of_the_year`

Where: the Brewery of the Year report.

- `lede`: Brewery and Brewer of the Year awards by production bracket. From 2026, the bracket counts a company's total production across all locations, and a new bracket above 100,000 barrels replaces the former Brewery Group award.
- `note`: These are awards, not medals, so Filters do not narrow this list.
- `partial`: Only the awards confirmed so far are listed.

### `columns`

- `year`: Year
- `award`: Award
- `bracket`: Bracket
- `brewery`: Brewery
- `city`: City
- `source`: Source
