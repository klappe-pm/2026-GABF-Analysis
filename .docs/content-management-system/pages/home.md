# Home

Home: the landing page. Planned layout from the design direction: a scoresheet header for the latest year, a search field, a headline finding, and the category index.

## `hero`

Where: top of the page.

- `title`: {{year}} Great American Beer Festival results
- `lede`: Every medal from {{first_year}} to {{last_year}}, linked to its brewery, its category, and the winning beer. Filter any page by year, style, place, or ownership.

## `scoresheet`

Where: the scoresheet fields across the top of the page.

- `competition_year`: Competition and year
- `competition_value`: GABF {{year}}
- `entries_judged`: Entries judged
- `categories`: Categories in {{year}}
- `medals_awarded`: Medals awarded
- `not_published`: Not published

## `search`

Where: field 1, the primary search on the page.

- `label`: Find a brewery, beer, or category
- `placeholder`: Brewery, beer, or category
- `no_match`: Nothing matches "{{query}}".
- `results_label`: Search results
- `kind_brewery`: Brewery
- `kind_category`: Category
- `kind_beer`: Beer

## `finding`

Where: the margin note beside the scoresheet that states the year's headline finding.

- `label`: Finding
- `text`: {{headline_finding}}
- `link`: Read the analysis

## `category_index`

Where: the category index table below the scoresheet.

- `title`: Categories, {{year}}
- `note`: Entries per medal is the field each medal had to beat: the category's entries divided by the medals awarded.
- `empty`: No category entry counts are published for {{year}}.

### `columns`

- `category`: Category
- `entries`: Entries
- `odds`: Entries per medal
- `gold`: Gold
- `silver`: Silver
- `bronze`: Bronze

## `next_steps`

Where: links below the category index.

- `breweries`: Browse breweries
- `beers`: See the {{year}} winning beers
- `first_time`: Meet the {{year}} first time medalists
- `analysis`: Read the analysis
- `overview`: Open the overview dashboard

## `deep_dives`

Where: list of breweries with written deep dives.

- `title`: Brewery deep dives
- `item_meta`: {{city}}, {{state}} · {{count}} medals in the record
