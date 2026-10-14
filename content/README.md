# Site content

This folder holds every word the site shows: page titles, ledes, headings, chart titles, table headers, buttons, filter labels, notices, and empty, loading, and error states. It is the only place copy lives. The site build reads it; code never carries its own visible text.

## How it is organized

- `voice.md`: the voice and style rules every string follows.
- `global/`: copy shared by every page.
  - `site.yaml`: site name, tagline, header chrome, footer, and the independence notice.
  - `navigation.yaml`: header and footer navigation, breadcrumbs, browser tab titles, and search descriptions.
  - `filters.yaml`: the one Filters control: button, panel, groups, dimension labels, search, chips, and keyboard help.
  - `labels.yaml`: the one label dictionary for every value stored in the data (medals, ownership, distribution, brewery types, regions, style families, coverage and year status, estimate basis, Fed districts, demographic controls).
  - `states.yaml`: shared empty, loading, error, partial data, Not defined, and Not published states.
  - `tables.yaml`: column headers and table controls shared by many pages.
  - `charts.yaml`: chart toolbox, table view, tooltips, units, and legends.
  - `formats.yaml`: how numbers, money, rates, dates, and ranges are written, with examples.
- `pages/`: one file per page type. Each holds that page's title, lede, sections, chart titles, table columns, notes, links, and its own empty and error states.
  - `home.yaml`, `results-by-year.yaml`, `results-by-category.yaml`, `category-detail.yaml`
  - `breweries-index.yaml`, `brewery-detail.yaml`
  - `beers-index.yaml`, `beer-detail.yaml`, `first-time-medalists.yaml`
  - `analysis-index.yaml`, `analysis-report.yaml` (the eight ready made reports, one group each)
  - `saved-views.yaml`, `method.yaml`, `about.yaml`, `not-found.yaml`
  - `dashboards.yaml` (the current dashboards and the single file dashboard) and `explorer.yaml` (the research explorer); both depend on open decisions below.
- `analysis/`: one markdown file per written finding, with a title and summary in the frontmatter and a short body.
- `inventory.csv`: every string found on the current site, where it appears, and the key it became.

## How to edit

- Change only the text inside the quotes. Keep every key, and keep the quotes.
- In `labels.yaml`, the key on the left is the raw value in the data. Never change it; change only the label on the right.
- Keep `{{tokens}}` exactly as written. The build fills each one with a value from the data. Move a token within a sentence freely, but do not rename or remove it unless the page no longer needs that value.
- Lines starting with `# where:` say where a group appears on the page. They are notes, not copy.
- Follow `voice.md`. In short: sentence case, the finding before the evidence, no dash as punctuation, no file names or developer instructions, "Not defined" for values the data does not hold, and "Not published" for values no source publishes.

## How keys are named

A key is the file path with dots, then the path inside the file. `pages.brewery-detail.ownership.missing` is the `missing` entry under `ownership` in `pages/brewery-detail.yaml`. `global.labels.ownership_type.unlisted` is the label for the raw value `unlisted`.

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

These need a choice before the rebuild. The files hold a working answer for each.

1. Page names. The new navigation reads Results, Breweries, Beers, Analysis, and Saved views. The current site says Dashboards, Categories, Reports, and "2026 winners". The files use the new names.
2. Dashboards. Whether the five dashboards stay as their own section or fold into Results and Analysis. Their copy is kept in `pages/dashboards.yaml` either way.
3. Explorer. It is not in the new navigation, and its style grouping differs from the site's style families. Keep it, fold it in, or drop it. Its copy is in `pages/explorer.yaml`.
4. Footer credit. The current footer says "Charts by Apache ECharts", which conflicts with crediting no tools. The draft moves it to the license notice under About, Attribution.
5. Developer notes on About. The GitHub Pages privacy section and the sentence about an agent lookup server are dropped from public copy.
6. Terms. "BA independent" is spelled out as "Independent (Brewers Association definition)". ARR and EBITDA are kept as terms; decide whether to spell them out.
7. Unlisted ownership. It now reads "Not defined", and the ownership report says such breweries count as independent in totals. Confirm that treatment.
8. Planned pages. Home, results by year, saved views, and not found are new. Their copy claims only what the product brief states.
