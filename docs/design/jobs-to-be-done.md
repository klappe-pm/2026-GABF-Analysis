# jobs-to-be-done

The jobs the GABF Analysis site exists to finish, taken from [PRODUCT.md](../../PRODUCT.md): brewers and brewery owners are the primary readers, and they come to benchmark their brewery against the field, decide which categories to enter, and study the beers that won. The fourth job comes from the product principles: data honesty first, and every page a destination that can be shared by its link.

The design control plane reads the table below. Each job is a journey in [design-nodes.json](design-nodes.json), and every screen in [interaction-spec](interaction-spec.md) belongs to exactly one of them.

## the-jobs

| Id | When | I want to | So that | Scenarios |
| --- | --- | --- | --- | --- |
| JOB-1 | I run a brewery and want to know where it stands against the field | see my medal record across years beside breweries like mine, by state, region, size, and ownership | I know where I stand and who I am competing with | CASE-01 |
| JOB-2 | I am deciding which GABF categories to enter | see how crowded each category is, the entries per medal, and who has won it | I enter where my beer has a real chance | CASE-02 |
| JOB-3 | I am designing or refining a beer to compete in a style | see the beers that won, with their style, ABV, IBU, hops, malts, yeast, and adjuncts | I know what a winning beer in that style looks like | CASE-03 |
| JOB-4 | I am about to rely on a figure or send a page to someone | see which years are complete, which numbers are estimates and how they were made, and keep my filter in the link | the answer I act on or share is one I can defend | CASE-04, CASE-05 |

## the-journeys

JOB-1 enters on the overview dashboard or on a shared brewery link, narrows with Filters to a state or a year, and ends on the brewery page with its medal history, its estimates, and the breweries that medalled for the first time.

JOB-2 enters on the categories dashboard or a report, opens a category for its entrants by year and its medalists, and uses the Filters panel to narrow by style family, year, or place.

JOB-3 enters on the 2026 winners index, narrows by style family, and opens a beer for its published specs. The explorer carries the same question across years.

JOB-4 runs through the economics dashboard, where every financial figure is marked (E) and explains itself, and the About page, which states coverage by year and how estimates are made.

## the-scenarios

The scenarios are proposed, not accepted: they restate the story in the product brief and wait for the owner's review.

- CASE-01: a brewer finds their brewery and reads its medal record against the field.
- CASE-02: a brewer compares categories by entries per medal before choosing where to enter.
- CASE-03: a brewer reads the specs of the beers that won a style.
- CASE-04: a reader opens a shared link and sees the same filtered view.
- CASE-05: a reader sees which figures are estimates and how each was made.
