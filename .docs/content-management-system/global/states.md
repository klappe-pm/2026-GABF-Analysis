# States

Shared empty, loading, error, and data gap states. Pages reuse these unless their own file sets a page specific version.

## `gaps`

Where: any field whose value the data does not hold (founded year, website, parent, address).

- `not_defined`: Not Found
- `not_published`: Not Published
- `none`: None
- `none_in_view`: None in View

## `loading`

Where: any view while medal data loads.

- `data`: Loading medals…
- `chart`: Loading chart…

## `no_results`

Where: any view where the filters leave no medals.

- `title`: No medals match these filters.
- `remove_hint`: Remove a filter to see more.
- `partial_hint`: Some medals here are in partial years, which are hidden by default.
- `include_partial`: Include Partial Years

## `empty_scope`

Where: a data page whose own scope holds no medals at all (before any filter).

- `page`: No medals in the record for this page.
- `chart`: No data for this chart in view.

## `errors`

Where: shown in place of a view when the medal data fails to load.

- `data_load`: The medal data did not load. Check your connection and reload the page.
- `dashboard_load`: The dashboard could not load its data. Check your connection and reload the page.
- `file_open`: Open this site from its web address. Opened as a file, the browser blocks the medal data.

## `partial_notice`

Where: the notice at the top of any view that includes a partial year.

- `one`: {{years}} includes only a sample of medals from secondary sources. Complete official lists start in {{first_complete_year}}. Read {{years}} as partial.
- `many`: {{years}} include only a sample of medals from secondary sources. Complete official lists start in {{first_complete_year}}. Read those years as partial.

## `partial_brewery`

Where: a brewery page with medals from partial years.

- `notice`: Some of this brewery's medals come from secondary sources, not the official list. The official list replaces them when it is loaded.

## `estimates`

Where: every figure marked (E).

- `marker`: (E)
- `explanation`: (E) marks an estimate. See Method for how each estimate is made.
- `short`: Estimate
- `reported`: Reported
