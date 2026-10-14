# Explorer

Explorer: the research workspace served at /explorer/. It is not in the new navigation; whether it stays is an open decision (see content/README.md). Its style family grouping differs from the site's (labels.yaml) and is kept here until that decision is made.

## `header`

Where: header of the explorer.

- `skip_link`: Skip to analysis
- `brand`: GABF Analysis
- `title`: Explorer
- `subtitle`: Awards research workspace
- `home_label`: Explorer home
- `import`: Import CSV
- `save`: Save dashboard

## `sidebar`

Where: the sidebar of filters.

- `label`: Filters
- `title`: Build a filter
- `reset`: Reset
- `search`: Search awards
- `search_placeholder`: Beer, brewery, city, or owner
- `combine_hint`: Choices within a field match any; choices across fields must all match.
- `more`: Ownership, ingredients, and more
- `more_note`: More filters appear as sourced research is added.
- `find_option`: Find an option…
- `find_field`: Find {{field}}
- `all`: All
- `show`: Show filters
- `hide`: Hide filters
- `count`: {{count}} of {{total}} awards
- `years_loaded`: {{count}} of {{target}} target years loaded
- `review_coverage`: Review data coverage
- `active_label`: Active filters

## `coverage_banner`

Where: the coverage banner above the tabs.

- `years_loaded`: {{count}} of {{target}} target years loaded.
- `missing`: {{years}} are missing. Brewery, recipe, and ownership research is incomplete.
- `link`: Coverage and sources

## `tabs`

Where: the tab row.

- `label`: Analysis views
- `overview`: Overview
- `awards`: Award explorer
- `breweries`: Breweries
- `compare`: Compare
- `trends`: Trends and rankings
- `forecast`: Forecast
- `data`: Data and methods

## `tab_intros`

Where: the title and lede of each tab.

- `overview_title`: Every medal, in context
- `overview_lede`: Follow the styles, breweries, and places behind the medals.
- `awards_title`: Explore the awards
- `awards_lede`: Search the records, change the columns, and open an award to see its evidence.
- `breweries_title`: Compare brewery portfolios
- `breweries_lede`: Compare reported brewery locations, their medals, and their styles.
- `compare_title`: Start with the breweries you want to compare
- `compare_lede`: Open Breweries and select up to four locations. Each comparison includes every loaded award for those locations.
- `compare_side_by_side`: Up to four brewery locations, side by side.
- `trends_title`: What changed between years?
- `trends_lede`: Compare medal patterns and see how past winners did in a later year.
- `forecast_title`: Explore the next award cycle
- `forecast_lede`: Adjust a medal trend scenario by style, brewery location, state, or city.
- `data_title`: Know what is in the data
- `data_lede`: Coverage, sources, definitions, and the path to five years of results.

## `trends`

Where: the trends tab.

- `year_hint`: Use the year controls below for this view. Every other sidebar filter applies; the sidebar year filter does not.
- `window_title`: Five years, with gaps shown
- `window_note`: A missing year is not a year without medals.
- `missing`: Missing
- `not_loaded`: Not loaded
- `not_loaded_option`: {{year}} (not loaded)
- `compare_title`: Compare the distribution
- `compare_note`: Changes describe the winner records loaded, not beer demand or entry success rates.
- `earlier_year`: Earlier year
- `later_year`: Later year
- `compare_by`: Compare by
- `export_changes`: Export changes
- `export_selection`: Export selection
- `table_note`: Showing up to 30 groups by size of change in medal count. The export includes every group. Shares use all selected medals in each year.
- `columns_medals`: {{year}} medals
- `columns_share`: {{year}} share
- `change`: Change
- `share_change`: Share change
- `order_error`: Choose two loaded years in order, earlier first.
- `both_needed`: Load both years to compare them.
- `chart_label`: Medals by year. {{summary}}

## `recurrence`

Where: the recurrence ranking on the trends tab.

- `title`: Past winners, tested against a later year
- `lede`: An exploratory ranking of brewery locations with an earlier medal.
- `held_out`: Held out year
- `candidates`: Candidates
- `top_10`: Top 10
- `top_20`: Top 20
- `top_50`: Top 50
- `export`: Export rankings
- `score_note`: Score: earlier medal points (gold 3, silver 2, bronze 1), halved for each year of age. The held out year only shows what happened next.
- `partial_title`: Partial history.
- `partial_body`: The four year window is missing {{years}}. This is a recurrence test, not a calibrated forecast of winners.
- `earlier_years`: Earlier years used
- `prior_locations`: Prior winning locations
- `later_medal`: Top candidates with a later medal
- `observed`: Share of candidates that medaled again
- `ties_note`: Ties are ordered by brewery name and location. This is not a win probability: breweries that entered without medaling, and their entry counts, are not in the data. Some filters may use information that did not exist in the earlier year.

### `columns`

- `rank`: Rank
- `location`: Brewery and location
- `prior_score`: Prior score
- `earlier_medals`: Earlier medals
- `later_medals`: {{year}} medals

## `forecast`

Where: the forecast tab.

- `disclaimer`: A scenario based on share trends, not a probability of winning.
- `points_research`: Research points (3 / 2 / 1)
- `points_gabf`: GABF point weights (6 / 5 / 4)
- `no_change`: No change modeled.
- `empty`: No forecast is available for this selection.
- `empty_hint`: Clear a filter to bring award records into the forecast.
- `no_history`: No earlier records for this scenario.
- `no_latest`: No medals in the latest loaded year.

## `empty`

Where: empty states across the tabs.

- `awards`: No awards match these filters.
- `awards_hint`: Remove a filter or try a shorter search. Every word you enter must match.
- `no_matching`: No matching awards
- `breweries`: No brewery locations in this selection.
- `location_hint`: Try removing a location, category, or year filter.
- `one_column`: Keep at least one column visible.

## `fields`

Where: field names in tables, filters, and the award details panel.

- `year`: Year
- `medal`: Medal
- `beer`: Beer or cider
- `brewery`: Brewery
- `state`: State
- `city`: City
- `fed_district`: Fed district
- `metro_area`: Metro area
- `category`: Award category
- `style_family`: Style family
- `fermentation`: Fermentation
- `beverage`: Beverage
- `competition`: Competition
- `hops`: Confirmed hops
- `hop_clues`: Hops named in the beer's name
- `owner`: Owner
- `investors`: Investors
- `brewery_type`: Brewery type
- `association`: Brewers association membership
- `zip`: ZIP code
- `address`: Address
- `phone`: Phone
- `website`: Website
- `beer_page`: Beer page
- `brewer`: Brewer
- `abv`: ABV (%)
- `ibu`: IBU
- `entries`: Category entries
- `subcategory`: Subcategory
- `evidence`: Evidence
- `award_id`: Award ID
- `beer_id`: Beer ID
- `location_id`: Brewery location ID
- `reference`: Award reference
- `import_source`: Import source
- `not_researched`: Not defined
- `not_established`: Not defined

## `characteristics`

Where: category characteristic filters.

- `all`: All characteristics
- `sour`: Sour or wild category
- `fruit`: Fruit category
- `spice`: Herb or spice category
- `coffee`: Coffee category
- `chocolate`: Chocolate category
- `barrel_aged`: Wood or barrel category
- `non_alcoholic`: Nonalcoholic category
- `gluten_free`: Gluten-free category
- `none_found`: No characteristic in the category name

## `taxonomy`

Where: the explorer's own grouping of categories. It differs from the site's style families.

- `specialty_mixed`: Specialty or mixed
- `special_competition`: Special competition
- `cider_perry`: Cider or perry
- `dark_ale_stout`: Dark ale or stout
- `sour_wild`: Sour or wild
- `hoppy_lager`: Hoppy lager or cold IPA
- `ipa`: IPA
- `stout`: Stout
- `porter`: Porter
- `pilsener`: Pilsener
- `bock`: Bock
- `kolsch`: Kölsch
- `altbier`: Altbier
- `lager`: Lager
- `wheat`: Wheat beer
- `belgian`: Belgian or farmhouse
- `brown_ale`: Brown ale
- `strong_ale`: Strong ale
- `pale_ale`: Pale ale
- `other_ale`: Other ale
- `non_alcoholic`: Nonalcoholic
- `fermentation_ale`: Ale
- `fermentation_lager`: Lager
- `fermentation_mixed`: Ale or lager
- `fermentation_fruit`: Fruit fermentation
- `fermentation_sour`: Sour or mixed
- `fermentation_unspecified`: Mixed or unspecified
- `unspecified`: Not defined
- `beverage_beer`: Beer
- `beverage_cider`: Cider or perry
- `competition_main`: Main competition
- `competition_pro_am`: Pro-Am
- `competition_collaboration`: Collaboration

## `details`

Where: the award details panel.

- `title`: Award details
- `close`: Close
- `open_reference`: Open reference
- `map_address`: Map address
- `search_beer`: Search for the beer
- `search_map`: Search the map
- `supplied_unvalidated`: Supplied record; not checked against a primary source.
- `imported_note`: Imported record. Check its evidence.
- `reference_found`: Reference found; award records not imported.
- `supplied_2026`: Records came from a CSV labeled {{year}}. Rows have not been checked against the live reference.

## `compare`

Where: the comparison tray.

- `add`: Add to comparison
- `added`: Brewery location added to comparison.
- `in_comparison`: In comparison
- `choose`: Choose breweries
- `compare_one`: Compare {{brewery_name}} in {{city}}

## `stats`

Where: summary tiles in the explorer.

- `total_medals`: Total medals
- `gold_medals`: Gold medals
- `medal_split`: Gold, silver, bronze
- `medal_count`: Medal count
- `award_rows`: Award rows
- `distinct_beers`: Distinct beers
- `locations`: Brewery locations
- `style_families`: Style families

## `import`

Where: the import dialog.

- `title`: Import data
- `close`: Close
- `lede`: Add past awards, or match sourced brewery and beer details to existing records. Changes stay in this browser until you save a new dashboard.
- `kind_label`: Data to import
- `kind_awards`: Awards: add missing records
- `kind_breweries`: Brewery details: match by brewery location ID
- `kind_beers`: Beer details: match by beer ID
- `kind_award_details`: Award details: match by award ID
- `template`: Download CSV template
- `choose_file`: Choose a CSV file
- `apply`: Apply import
- `reading`: Reading and checking the CSV…
- `result`: Imported: {{added}} added, {{updated}} updated, {{skipped}} skipped.
- `exported`: Exported {{count}} rows.
- `restore_confirm`: Restore the data this file opened with? CSV imports you have not saved will be removed.
- `restored`: Restored the original data.
- `awards_help`: Required columns: year, medal, beer, brewery, city, state, and category. Identical award rows are skipped. New columns are kept.
- `details_help`: Required columns: the matching ID and an evidence link. Optional columns include address, metro area, phone, website, beer page, ownership, investors, brewery type, association, confirmed hops, brewer, ABV, and IBU.

### `errors`

- `unclosed_quote`: A quoted value in the CSV is never closed.
- `no_rows`: The CSV needs a header row and at least one data row.
- `duplicate_columns`: The CSV has two columns with the same name.
- `field_count`: Row {{row}} has {{count}} fields; the header has {{expected}}.
- `missing_column`: The CSV is missing a required column: {{column}}.
- `blank_required`: Row {{row}}: beer, brewery, and category cannot be blank.
- `bad_medal`: Row {{row}}: medal must be Gold, Silver, or Bronze.
- `bad_year`: Row {{row}}: year must be four digits between 1982 and 2100.
- `id_taken`: Row {{row}}: this award ID already belongs to another record.
- `needs_id`: Every row needs a {{column}}.
- `duplicate_id`: The file lists the same {{column}} twice.
- `needs_evidence`: Every row needs an evidence link that starts with http or https.
- `match_needed`: This import needs {{column}} to match existing records.
- `too_many_rows`: Import at most 20,000 rows at a time.
- `too_large`: CSV files can be up to 8 MB.

## `share`

Where: the save and share dialog.

- `title`: Share this workspace
- `close`: Close
- `lede`: Download one HTML file with the data and your current filters. Anyone can open it in a browser; no account or installation needed.
- `summary`: {{count}} award records · {{years}}
- `segment`: {{count}} in the current selection · {{tab}}
- `download`: Download shareable HTML
- `note`: Source links need an internet connection. Imported records are included. This makes a file, not a public web address.
- `saved`: Saved a self contained dashboard with your current data and view.

## `footer`

Where: the explorer footer.

- `edition`: GABF Analysis Explorer · Research edition
- `promise`: Data built in · Works offline · No tracking
