# Filters

The one global Filters control: header button, panel, chips, and keyboard help.

## `trigger`

Where: the Filters button in the header, on every page.

- `label`: Filters
- `label_with_count`: Filters · {{count}}
- `accessible_label_with_count`: Filters, {{count}} active
- `tooltip`: Filter every page (press F)

## `panel`

Where: the filter panel that opens from the header button.

- `title`: Filter medals
- `close`: Close
- `reset`: Clear all
- `apply`: Show results
- `match_count_one`: 1 medal matches
- `match_count_many`: {{count}} medals match
- `match_count_scoped`: {{count}} medals match on this page ({{scope}})
- `loading`: Loading medals…
- `load_error`: Filters are unavailable because the medal data did not load. Reload the page to try again.

## `search`

Where: the search box at the top of the panel.

- `label`: Search
- `placeholder`: Beer, brewery, city, or hop

## `groups`

Where: the four groups of the panel, in order.

- `when`: When
- `what`: What
- `where`: Where
- `who`: Who

## `dimensions`

Where: the label above each dropdown in the panel, and the start of each chip.

- `year`: Year
- `medal`: Medal
- `category_type`: Category type
- `style_family`: Style family
- `category_name`: Category
- `abv_band`: ABV
- `region`: Region
- `state`: State
- `fed_district_name`: Fed district
- `brewery_type`: Brewery type
- `ownership_type`: Ownership
- `distribution_channel`: Distribution

## `options`

Where: options inside each dropdown.

- `all`: All
- `with_count`: {{label}} ({{count}})
- `not_in_view`: {{label}} (0)

## `partial_years`

Where: the When group, below the year dropdown.

- `include`: Include partial years ({{years}})
- `default_note`: Shows complete official lists by default.

## `chips`

Where: the chip bar under the header when a filter is active.

- `bar_label`: Active filters
- `chip`: {{dimension}}: {{value}}
- `search_chip`: Search: {{query}}
- `partial_chip`: Partial years included
- `fixed_tooltip`: This page is limited to this value
- `fixed_brewery`: Brewery: {{brewery_name}}
- `fixed_category`: Category: {{category_name}}
- `fixed_year`: Year: {{year}}
- `remove_label`: Remove filter {{chip}}
- `remove_hidden`: (remove)
- `clear_all`: Clear all

## `live_region`

Where: screen reader announcement after every filter change.

- `one`: 1 medal in view
- `many`: {{count}} medals in view

## `keyboard`

Where: keyboard help, in the trigger tooltip and on the method page.

- `open`: Press F to open filters.
- `close`: Press Escape to close.
- `sort`: Press Enter on a column header to sort.
