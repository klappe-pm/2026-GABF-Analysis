# interaction-spec

## how-to-read-this

Every screen of the GABF Analysis site that the design control plane shows, what a reader can do on it, and where each action lands. A screen is a state of a surface: the surface is a page type with one route, and the screen is that page in one state, reached through the page's own URL hash, its route, or the way the review server serves its data. Nothing here is a mockup. Each screen is the built page, driven into the state below, so a review of the control plane is a review of the site.

Each screen lists its `Actions`, then `Goes to`, which pairs a destination with the action that reaches it, as in "S-02 on apply a state filter". `Stays` names the actions that act in place or leave the site (a table view, a sort, a PNG save, a brewery's own website) and keep the screen showing. The generator reads this file; the manifest in [design-nodes.json](design-nodes.json) says how each screen is reached and what it is made of.

## the-state-rules

**Complete years by default.** Partial years (2018 and 2019) are hidden until a reader includes them or picks a year, and the page says so when they are in view.

**Empty is never bare.** A filter that matches nothing names the active filters, offers to remove each one, and offers to include partial years when that would help.

**An error names the problem and the next step.** When the medal data does not load, the page says what it cannot do and what to try, in the site's own words.

**Loading keeps what is already written.** A data page shows its built HTML, dimmed, while the filtered view loads; a dashboard shows its panel frames.

**Estimates explain themselves.** Every (E) figure opens a note with its inputs and method, marked as an estimate and not reported.

## the-screen-inventory

| Id | Job | Screen | Path | Entry |
| --- | --- | --- | --- | --- |
| S-01 | JOB-1 | overview-default | happy | the home page, no filter |
| S-02 | JOB-1 | overview-filtered | happy | a state filter applied |
| S-03 | JOB-1 | overview-empty | empty | a pending year picked |
| S-04 | JOB-1 | overview-loading | loading | the medal data is on its way |
| S-05 | JOB-1 | overview-error | error | the medal data failed to load |
| S-06 | JOB-1 | overview-partial-years | happy | partial years included |
| S-07 | JOB-1 | overview-phone | happy | the home page on a phone |
| S-08 | JOB-1 | geography-default | happy | the geography dashboard |
| S-09 | JOB-1 | geography-filtered | happy | a state picked on the map |
| S-10 | JOB-1 | geography-phone | happy | the geography dashboard on a phone |
| S-11 | JOB-2 | categories-dashboard-default | happy | the categories dashboard |
| S-12 | JOB-2 | categories-dashboard-filtered | happy | a style family picked |
| S-13 | JOB-1 | breweries-dashboard-default | happy | the breweries dashboard |
| S-14 | JOB-1 | breweries-dashboard-picked | happy | a brewery picked |
| S-15 | JOB-4 | economics-default | happy | the ownership and economics dashboard |
| S-16 | JOB-4 | economics-estimate-open | happy | an estimate mark opened |
| S-17 | JOB-4 | economics-error | error | the dashboard data failed to load |
| S-18 | JOB-2 | reports-index | happy | the reports list |
| S-19 | JOB-2 | report-default | happy | the top breweries report |
| S-20 | JOB-2 | report-filtered | happy | the report narrowed to one year |
| S-21 | JOB-2 | report-empty | empty | the report narrowed to a pending year |
| S-22 | JOB-2 | category-default | happy | a category page |
| S-23 | JOB-2 | category-filtered | happy | the category narrowed to gold medals |
| S-24 | JOB-2 | category-partial-years | happy | partial years included on the category |
| S-25 | JOB-2 | category-empty | empty | the category narrowed to a pending year |
| S-26 | JOB-2 | category-phone | happy | a category page on a phone |
| S-27 | JOB-1 | brewery-default | happy | a brewery page |
| S-28 | JOB-1 | brewery-estimate-open | happy | an estimate mark opened |
| S-29 | JOB-1 | brewery-filtered | happy | the brewery narrowed to one year |
| S-30 | JOB-1 | brewery-partial-years | happy | partial years included on the brewery |
| S-31 | JOB-1 | brewery-empty | empty | the brewery narrowed to a pending year |
| S-32 | JOB-1 | brewery-loading | loading | the filtered view is loading |
| S-33 | JOB-1 | brewery-error | error | the filtered view failed to load |
| S-34 | JOB-1 | brewery-phone | happy | a brewery page on a phone |
| S-35 | JOB-3 | winners-default | happy | the 2026 winners index |
| S-36 | JOB-3 | winners-filtered | happy | the winners narrowed to a style family |
| S-37 | JOB-3 | winners-empty | empty | the winners narrowed to a pending year |
| S-38 | JOB-3 | winners-phone | happy | the winners index on a phone |
| S-39 | JOB-3 | beer-default | happy | a winning beer opened |
| S-40 | JOB-3 | beer-phone | happy | a winning beer on a phone |
| S-41 | JOB-1 | first-time-default | happy | the first time medalists of 2026 |
| S-42 | JOB-1 | first-time-filtered | happy | first time medalists in one state |
| S-43 | JOB-3 | explorer-default | happy | the explorer |
| S-44 | JOB-3 | explorer-phone | happy | the explorer on a phone |
| S-45 | JOB-4 | about-default | happy | the about page |
| S-46 | JOB-2 | filters-open | happy | the Filters panel opened |
| S-47 | JOB-2 | filters-open-applied | happy | the Filters panel with filters set |
| S-48 | JOB-2 | filters-partial-years | happy | the Filters panel with partial years included |
| S-49 | JOB-2 | filters-loading | loading | the Filters panel waiting for the medal data |
| S-50 | JOB-2 | filters-error | error | the Filters panel without its data |
| S-51 | JOB-2 | filters-phone | happy | the Filters panel on a phone |

## job-1-benchmark

### s-01-overview-default

The home page is the overview dashboard: medals by year, by state on the map, by style family, and the leading breweries by points, over complete years only. The Filters button in the header narrows every panel, and a click on a bar, column, or state focuses the rest.

Actions: apply a state filter, pick a pending year, include partial years, open Filters, open a brewery, view on a phone.

Goes to: S-02 on apply a state filter, S-03 on pick a pending year, S-06 on include partial years, S-46 on open Filters, S-27 on open a brewery, S-07 on view on a phone.

### s-02-overview-filtered

The overview with one state applied (Colorado). The chip under the header names the filter and removes it; every panel and the results table follow it.

Actions: remove the filter, open Filters.

Goes to: S-01 on remove the filter, S-46 on open Filters.

### s-03-overview-empty

A year with no results on the site (2020 is pending) is picked, so nothing matches. The panels give way to the empty state, which names the filter and offers to remove it.

Actions: remove the filter.

Goes to: S-01 on remove the filter.

### s-04-overview-loading

The overview before its medal data arrives. The review server holds the data files for this screen, so the panel frames stay empty and the page waits; nothing is invented while it does.

Actions: wait for the data.

Goes to: S-01 on wait for the data.

### s-05-overview-error

The medal data failed to load (the review server answers the data files with an error for this screen). The dashboard says it cannot draw and what to try.

Actions: reload the page.

Goes to: S-01 on reload the page.

### s-06-overview-partial-years

Partial years are included. The chip says so, and the counts for 2018 and 2019 join the panels, read as partial.

Actions: remove the partial years chip.

Goes to: S-01 on remove the partial years chip.

### s-07-overview-phone

The overview at phone width. The header collapses behind a Menu button and the panels stack in one column.

Actions: open the menu, open Filters.

Goes to: S-51 on open Filters.

Stays: open the menu.

### s-08-geography-default

The geography dashboard: the US map, Census regions and divisions, Federal Reserve districts, medals per million residents and per real GDP, and the demographic controls table.

Actions: pick a state on the map, open a table view, view on a phone.

Goes to: S-09 on pick a state on the map, S-10 on view on a phone.

Stays: open a table view.

### s-09-geography-filtered

A state is picked (Colorado), so the other panels focus on it and the chip names it.

Actions: remove the filter.

Goes to: S-08 on remove the filter.

### s-10-geography-phone

The geography dashboard at phone width, panels stacked, the map scaled to the column.

Actions: open the menu.

Stays: open the menu.

### s-13-breweries-dashboard-default

The breweries dashboard opens on its default brewery: a medal trend by year that marks years before the brewery opened and years not yet published, its categories, and its locations.

Actions: pick a brewery.

Goes to: S-14 on pick a brewery.

### s-14-breweries-dashboard-picked

A brewery is picked through the URL (Green Cheek Beer Co.), so the trend, categories, and locations follow it and the link carries the choice.

Actions: open the brewery page.

Goes to: S-27 on open the brewery page.

### s-27-brewery-default

A brewery page: its pills (type, place, founding, ownership, distribution, streak), estimated scale marked (E), its medal history by year, and its medals. Partial years are out of view until included.

Actions: open an estimate, narrow to one year, include partial years, pick a pending year, open the brewery website, view on a phone.

Goes to: S-28 on open an estimate, S-29 on narrow to one year, S-30 on include partial years, S-31 on pick a pending year, S-34 on view on a phone.

Stays: open the brewery website.

### s-28-brewery-estimate-open

An (E) mark is opened. The note names the figure, says how it was estimated with this brewery's inputs, marks it an estimate and not reported, and links to the method.

Actions: close the estimate, read the method.

Goes to: S-27 on close the estimate, S-45 on read the method.

### s-29-brewery-filtered

The brewery narrowed to one year (2026). The view redraws from the medal data and the chip names the year.

Actions: remove the filter.

Goes to: S-27 on remove the filter.

### s-30-brewery-partial-years

Partial years are included, so this brewery's 2018 and 2019 medals join the view under a notice that those years hold only a sample of medals.

Actions: remove the partial years chip.

Goes to: S-27 on remove the partial years chip.

### s-31-brewery-empty

The brewery narrowed to a pending year (2020), so nothing matches and the empty state offers to remove the filter.

Actions: remove the filter.

Goes to: S-27 on remove the filter.

### s-32-brewery-loading

The brewery narrowed to one year while its medal data is held back. The built view stays on screen, dimmed and marked busy, until the data arrives.

Actions: wait for the data.

Goes to: S-29 on wait for the data.

### s-33-brewery-error

The brewery narrowed to one year and the medal data failed to load. The view says it cannot follow the filter and what to try.

Actions: reload the page.

Goes to: S-27 on reload the page.

### s-34-brewery-phone

The brewery page at phone width: pills wrap, tables scroll inside their own frame, and the key value lists stack.

Actions: open an estimate.

Goes to: S-28 on open an estimate.

### s-41-first-time-default

The breweries whose first GABF medal in the loaded results came in 2026, each with its 2026 medals and the field each medal beat, and the names to check by hand where a first timer may be an earlier medalist under another name.

Actions: narrow to one state, open a brewery.

Goes to: S-42 on narrow to one state, S-27 on open a brewery.

### s-42-first-time-filtered

First time medalists narrowed to one state (Colorado), named in the chip.

Actions: remove the filter.

Goes to: S-41 on remove the filter.

## job-2-choose-categories

### s-11-categories-dashboard-default

The categories dashboard: total entrants by category from the official headers, special categories marked, the classic versus special split by year, and category size against how many breweries medal.

Actions: pick a style family, open a category.

Goes to: S-12 on pick a style family, S-22 on open a category.

### s-12-categories-dashboard-filtered

The categories dashboard narrowed to one style family (IPA).

Actions: remove the filter.

Goes to: S-11 on remove the filter.

### s-18-reports-index

The list of ready made reports over the loaded results, each following the Filters selection.

Actions: open a report.

Goes to: S-19 on open a report.

### s-19-report-default

The top breweries report: points weight gold 3, silver 2, bronze 1, over the medals in view.

Actions: narrow to one year, pick a pending year.

Goes to: S-20 on narrow to one year, S-21 on pick a pending year.

### s-20-report-filtered

The report narrowed to one year (2026), the chip naming it.

Actions: remove the filter.

Goes to: S-19 on remove the filter.

### s-21-report-empty

The report narrowed to a pending year (2020): the empty state names the filter and offers to remove it.

Actions: remove the filter.

Goes to: S-19 on remove the filter.

### s-22-category-default

A category page (American-Style India Pale Ale): its style reference and ABV, IBU, and SRM ranges, entrants by year, and its medalists over complete years.

Actions: narrow to gold medals, include partial years, pick a pending year, view on a phone.

Goes to: S-23 on narrow to gold medals, S-24 on include partial years, S-25 on pick a pending year, S-26 on view on a phone.

### s-23-category-filtered

The category narrowed to gold medals, named in the chip.

Actions: remove the filter.

Goes to: S-22 on remove the filter.

### s-24-category-partial-years

Partial years included, so the category's 2018 and 2019 medals join under the partial notice.

Actions: remove the partial years chip.

Goes to: S-22 on remove the partial years chip.

### s-25-category-empty

The category narrowed to a pending year (2020): nothing matches and the empty state says so.

Actions: remove the filter.

Goes to: S-22 on remove the filter.

### s-26-category-phone

The category page at phone width.

Actions: open the menu.

Stays: open the menu.

### s-46-filters-open

The Filters panel opened over the categories index: a search field and the When, What, Where, and Who groups, each option with its count, and the number of medals that match.

Actions: set filters, include partial years, close the panel.

Goes to: S-47 on set filters, S-48 on include partial years.

Stays: close the panel.

### s-47-filters-open-applied

The panel with a style family and a state set; the counts and the match total follow, and the chips behind the panel name both.

Actions: reset the filters.

Goes to: S-46 on reset the filters.

### s-48-filters-partial-years

The panel with Include partial years ticked, so 2018 and 2019 rows count in every option.

Actions: untick partial years.

Goes to: S-46 on untick partial years.

### s-49-filters-loading

The panel opened before the medal data has arrived; it says it is loading the medal data.

Actions: wait for the data.

Goes to: S-46 on wait for the data.

### s-50-filters-error

The panel opened and the medal data failed to load, so its options are unavailable and it says to reload.

Actions: reload the page.

Goes to: S-46 on reload the page.

### s-51-filters-phone

The Filters panel at phone width, taking the screen.

Actions: close the panel.

Stays: close the panel.

## job-3-study-winning-beers

### s-35-winners-default

Every 2026 medal with the beer's published specs: style, ABV, IBU, and named hops, malts, yeast, and adjuncts, each from the brewery or a cited source. Gaps are stated, never filled.

Actions: narrow to a style family, pick a pending year, open a beer, view on a phone.

Goes to: S-36 on narrow to a style family, S-37 on pick a pending year, S-39 on open a beer, S-38 on view on a phone.

### s-36-winners-filtered

The winners narrowed to one style family (IPA).

Actions: remove the filter, open a beer.

Goes to: S-35 on remove the filter, S-39 on open a beer.

### s-37-winners-empty

A pending year picked on a page scoped to 2026, so nothing matches; the empty state names the filter.

Actions: remove the filter.

Goes to: S-35 on remove the filter.

### s-38-winners-phone

The winners index at phone width.

Actions: open a beer.

Goes to: S-40 on open a beer.

### s-39-beer-default

One winning beer (Doom Sludge, gold in Specialty India Pale Ale): its spec card with sources, the brewery's own description, and its research notes.

Actions: open the brewery, open the category, view on a phone.

Goes to: S-27 on open the brewery, S-22 on open the category, S-40 on view on a phone.

### s-40-beer-phone

The beer page at phone width; the spec card moves above the notes.

Actions: open the brewery.

Goes to: S-27 on open the brewery.

### s-43-explorer-default

The explorer, a single page research dashboard over every loaded award, opening on what changed between years.

Actions: change the view, view on a phone.

Goes to: S-44 on view on a phone.

Stays: change the view.

### s-44-explorer-phone

The explorer at phone width.

Actions: change the view.

Stays: change the view.

## job-4-trust-and-share

### s-15-economics-default

The ownership and economics dashboard: ownership share, parent companies, and estimated revenue, ARR, gross margin, EBITDA, and distribution channel per brewery, every financial figure marked (E).

Actions: open an estimate, read the method.

Goes to: S-16 on open an estimate, S-45 on read the method.

### s-16-economics-estimate-open

An (E) mark in the financials table opened: the brewery's inputs and the method, marked an estimate and not reported.

Actions: close the estimate.

Goes to: S-15 on close the estimate.

### s-17-economics-error

The dashboard's data failed to load; it says it cannot draw and what to try.

Actions: reload the page.

Goes to: S-15 on reload the page.

### s-45-about-default

Coverage by year (complete, partial, pending), the data sources, how estimates are made, how to read a brewery trend, and attribution.

Actions: open the source and data.

Stays: open the source and data.
