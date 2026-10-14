# Results by year

Results by year: every medal of one competition year, grouped by category.

## `header`

Where: top of the page.

- `title`: {{year}} Results
- `lede`: {{medal_count}} medals in {{category_count}} categories. Each row links to the brewery, the category, and, for {{profile_year}}, the winning beer.
- `year_picker`: Year

## `coverage`

Where: year pills under the title; the label is the coverage label from labels.yaml.

- `pill`: {{year}} · {{coverage}}
- `pill_tooltip`: {{coverage_meaning}}

## `stats`

Where: the summary tiles under the title.

- `medals`: Medals
- `breweries`: Breweries
- `states`: States
- `categories`: Categories
- `categories_note`: {{count}} medals in special categories
- `medal_split`: Gold, Silver, Bronze
- `entrants`: Entrants in These Categories
- `entrants_note`: Sum of category entry counts
- `entrants_missing`: Not Published

## `table`

Where: the medal table.

- `title`: All Medals
- `group_row`: {{number}}. {{category_name}}
- `group_entries`: {{count}} Entries

## `empty`

Where: in place of the table when the year has no medals loaded.

- `no_results`: No results are loaded for {{year}}.
- `partial`: {{year}} holds only a sample of medals from secondary sources.
