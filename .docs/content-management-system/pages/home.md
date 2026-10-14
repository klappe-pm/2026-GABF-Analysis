# Home

Home: the landing page. Planned layout from the design direction: a scoresheet header for the latest year, a search field, a headline finding, and the category index.

## `hero`

Where: top of the page.

- `title`: {{year}} Great American Beer Festival Results
- `lede`: Every medal from {{first_year}} to {{last_year}}, linked to its brewery, its category, and the winning beer. Filter any page by year, style, place, or ownership.

## `scoresheet`

Where: the scoresheet fields across the top of the page.

- `competition_year`: Competition and Year
- `competition_value`: Great American Beer Festival {{year}}
- `entries_judged`: Entries Judged
- `categories`: Categories
- `medals_awarded`: Medals Awarded
- `not_published`: Not Published

## `search`

Where: field 1, the primary search on the page.

- `label`: Find a Brewery, Beer, or Category
- `placeholder`: Brewery, beer, or category
- `no_match`: Nothing matches "{{query}}".
- `results_label`: Search Results
- `kind_brewery`: Brewery
- `kind_category`: Category
- `kind_beer`: Beer

## `finding`

Where: the margin note beside the scoresheet that states the year's headline finding.

- `label`: Finding
- `text`: {{headline_finding}}
- `link`: Read the Analysis

## `category_index`

Where: the category index table below the scoresheet.

- `title`: Categories, {{year}}
- `note`: Entries per medal is the field each medal had to beat: the category's entries divided by the medals awarded.
- `empty`: No category entry counts are published for {{year}}.

### `columns`

- `category`: Category
- `entries`: Entries
- `odds`: Entries per Medal
- `gold`: Gold
- `silver`: Silver
- `bronze`: Bronze

## `next_steps`

Where: links below the category index.

- `breweries`: Browse Breweries
- `beers`: See the {{year}} Winning Beers
- `first_time`: Meet the {{year}} First Time Medalists
- `analysis`: Read the Analysis
- `overview`: Open the Overview Dashboard

## `deep_dives`

Where: list of breweries with written deep dives.

- `title`: Brewery Deep Dives
- `item_meta`: {{city}}, {{state}} · {{count}} medals in the record
