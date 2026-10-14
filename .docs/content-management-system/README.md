 # Site content

This folder holds every word the site shows: page titles, ledes, headings, chart titles, table headers, buttons, filter labels, notices, and empty, loading, and error states. It is the only place copy lives. The site build reads it; code never carries its own visible text.

## How it is organized

- `voice.md`: the voice and style rules every string follows.
- `global/`: copy shared by every page.
	- `site.md`: site name, tagline, header chrome, footer, and the independence notice.
	- `navigation.md`: header and footer navigation, breadcrumbs, browser tab titles, and search descriptions.
	- `filters.md`: the one Filters control: button, panel, groups, dimension labels, search, chips, and keyboard help.
	- `labels.md`: the one label dictionary for every value stored in the data (medals, ownership, distribution, brewery types, regions, style families, coverage and year status, estimate basis, Fed districts, demographic controls).
	- `states.md`: shared empty, loading, error, partial data, Not Found, and Not published states.
	- `tables.md`: column headers and table controls shared by many pages.
	- `charts.md`: chart toolbox, table view, tooltips, units, and legends.
	- `formats.md`: how numbers, money, rates, dates, and ranges are written, with examples.
- `pages/`: one file per page type. Each holds that page's title, lede, sections, chart titles, table columns, notes, links, and its own empty and error states.
	  - `home.md`
	  - `results-by-year.md`
	  - `results-by-category.md`
	  - `category-detail.md`
	  - `breweries-index.md`
	  - `brewery-detail.md`
	  - `beers-index.md`
	  - `beer-detail.md`
	  - `first-time-medalists.md`
	  - `analysis-index.md`
  - `analysis-report.md`: eight ready made reports, one group each
	  - `saved-views.md`
	  - `method.md`
	  - `about.md`
	  - `not-found.md`
  - `dashboards.md`: current dashboards and the single file dashboard
  - `explore.md`: the Explore page under Analysis
- `analysis/`: one markdown file per written finding, with a title and summary in the frontmatter and a short body.
- `inventory.csv`: every string found on the current site, where it appears, and the key it became.

## How to edit

- Every file is plain Markdown, so it opens and edits in Obsidian. Each string is one list line with its key in backticks, a colon, then the visible text. Change only the text after the colon. Keep the key exactly as it is.

```markdown
- `title`: The visible text
```

- Headings with a key in backticks (`` ## `hero` ``) are groups. Keep them; change only the strings under them.
- In `labels.md`, the key on the left is the raw value in the data. Never change it; change only the label on the right. `` `(blank)` `` is the label for a value that is empty in the data.
- A group whose lines are plain `- item` entries (in `formats.md`) is a list of examples; edit the items freely.
- Keep `{{tokens}}` exactly as written. The build fills each one with a value from the data. Move a token within a sentence freely, but do not rename or remove it unless the page no longer needs that value.
- Lines starting with `Where:` say where a group appears on the page, and the paragraph under each title describes the file. They are notes, not copy; the site never shows them.
- Follow `voice.md`. In short: title case for headings, labels, buttons, and column headers, the finding before the evidence, no dash as punctuation, no file names or developer instructions, "Not Found" for values the data does not hold, and "Not published" for values no source publishes.

## How keys are named

A key is the file path with dots, then the path inside the file. `pages.brewery-detail.ownership.missing` is the `missing` entry under `ownership` in `pages/brewery-detail.md`. `global.labels.ownership_type.unlisted` is the label for the raw value `unlisted`.

## Tokens

Tokens are placeholders the build fills in. The common ones:

- Years: `{{year}}`, `{{first_year}}`, `{{last_year}}`, `{{latest_year}}`, `{{previous_year}}`, `{{profile_year}}`, `{{data_year}}`, `{{first_complete_year}}`, `{{years}}`, `{{partial_years}}`, `{{missing_years}}`, `{{complete_range}}`, `{{year_range}}`.
- Counts and totals: `{{count}}`, `{{total}}`, `{{shown}}`, `{{medal_count}}`, `{{brewery_count}}`, `{{category_count}}`, `{{special_count}}`, `{{classic_count}}`, `{{row_count}}`, `{{year_count}}`, `{{new_count}}`, `{{complete_count}}`.
- Names: `{{brewery_name}}`, `{{beer_name}}`, `{{category_name}}`, `{{name}}`, `{{address}}`, `{{city}}`, `{{state}}`, `{{parent}}`, `{{source}}`, `{{variant_name}}`, `{{report_title}}`, `{{dashboard_title}}`, `{{page_title}}`.
- Values and ranges: `{{value}}`, `{{label}}`, `{{min}}`, `{{max}}`, `{{low}}`, `{{high}}`, `{{share}}`, `{{split}}`, `{{medal}}`, `{{number}}`, `{{coverage}}`, `{{coverage_meaning}}`, `{{basis}}`, `{{confidence}}`, `{{ownership}}`, `{{unit}}`, and `{{x}}` and `{{y}}` for scatter chart tooltips.
- Filters: `{{dimension}}`, `{{chip}}`, `{{query}}`, `{{scope}}`.
- Brewery estimates: `{{gallons}}`, `{{cases}}`, `{{cans}}`, `{{pints}}`, `{{packaged_share}}`, `{{ebitda}}`, `{{margin}}`, `{{margin_low}}`, `{{margin_high}}`, `{{gross_profit}}`, `{{cogs}}`, `{{stake}}`.
- Method parameters, read from the estimation parameters at build time: `{{direct_revenue_per_barrel}}`, `{{distributed_revenue_per_barrel}}`, `{{taproom_margin_range}}`, `{{self_margin_range}}`, `{{distributor_margin_range}}`.
- Findings: each file in `analysis/` lists its own tokens in its frontmatter. Home uses `{{headline_finding}}`.
- Explorer only: `{{field}}`, `{{target}}`, `{{tab}}`, `{{summary}}`, `{{row}}`, `{{column}}`, `{{expected}}`, `{{added}}`, `{{updated}}`, `{{skipped}}`.

## The inventory

`inventory.csv` has four columns: `page`, `location`, `current_text`, and `new_key`. Dynamic text is written as a template with tokens, not as one rendered example. A row marked "(main)" is the wording on the published site; unmarked rows match the newest work in progress. A `new_key` of `(removed)` means the string was developer text with no public equivalent. A `new_key` starting with `analysis.` points to a file in `analysis/`.

## Open decisions

Content decisions are recorded using `Content Design Records (CDR)`. Read README.MD for details. They are saved here: `/Users/kevinlappe/projects/active/gabf-analysis/.docs/cdr`. Update the metadata on the files to align with the project and ADR process. Ensure that all agent instructions file are updated with this poitner and how to apply it alongside adrs. 

These need a choice before the rebuild. The files hold a working answer for each.

1. 
2. Dashboards. Whether the five dashboards stay as their own section or fold into Results and Analysis. Their copy is kept in `pages/dashboards.md` either way.
3. Explorer. Decided: the standalone explorer is retired and its unique features live on Explore, whose copy is in `pages/explore.md`.
4. Footer credit. The current footer says "Charts by Apache ECharts", which conflicts with crediting no tools. The draft moves it to the license notice under About, Attribution.
5. Developer notes on About. The GitHub Pages privacy section and the sentence about an agent lookup server are dropped from public copy.
6. Terms. "BA independent" is spelled out as "Independent (Brewers Association definition)". ARR and EBITDA are kept as terms; decide whether to spell them out.
7. Unlisted ownership. It now reads "Not Found", and the ownership report says such breweries count as independent in totals. Confirm that treatment.
8. Planned pages. Home, results by year, saved views, and not found are new. Their copy claims only what the product brief states.
