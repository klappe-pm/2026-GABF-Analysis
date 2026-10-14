# Explorer

Explorer: the research workspace served at /explorer/. It is not in the new navigation; whether it stays is an open decision (see content/README.md). Its style family grouping differs from the site's (labels.yaml) and is kept here until that decision is made.

## `header`

Where: header of the explorer.

- `skip_link`: Skip to analysis
- `brand`: GABF Analysis
- `title`: Explorer
- `subtitle`: Awards Research Workspace
- `home_label`: Explorer Home
- `import`: Import CSV
- `save`: Save Dashboard

## `sidebar`

Where: the sidebar of filters.

- `label`: Filters
- `title`: Build a Filter
- `reset`: Reset
- `search`: Search Awards
- `search_placeholder`: Beer, brewery, city, or owner
- `combine_hint`: Choices within a field match any; choices across fields must all match.
- `more`: Ownership, ingredients, and more
- `more_note`: More filters appear as sourced research is added.
- `find_option`: Find an option…
- `find_field`: Find {{field}}
- `all`: All
- `show`: Show Filters
- `hide`: Hide Filters
- `count`: {{count}} of {{total}} Awards
- `years_loaded`: {{count}} of {{target}} Target Years Loaded
- `review_coverage`: Review Data Coverage
- `active_label`: Active Filters

## `coverage_banner`

Where: the coverage banner above the tabs.

- `years_loaded`: {{count}} of {{target}} target years loaded.
- `missing`: {{years}} are missing. Brewery, recipe, and ownership research is incomplete.
- `link`: Coverage and Sources

## `tabs`

Where: the tab row.

- `label`: Analysis Views
- `overview`: Overview
- `awards`: Award Explorer
- `breweries`: Breweries
- `compare`: Compare
- `trends`: Trends and Rankings
- `forecast`: Forecast
- `data`: Data and Methods

## `tab_intros`

Where: the title and lede of each tab.

- `overview_title`: Every Medal, in Context
- `overview_lede`: Follow the styles, breweries, and places behind the medals.
- `awards_title`: Explore the Awards
- `awards_lede`: Search the records, change the columns, and open an award to see its evidence.
- `breweries_title`: Compare Brewery Portfolios
- `breweries_lede`: Compare reported brewery locations, their medals, and their styles.
- `compare_title`: Start with the Breweries You Want to Compare
- `compare_lede`: Open Breweries and select up to four locations. Each comparison includes every loaded award for those locations.
- `compare_side_by_side`: Up to four brewery locations, side by side.
- `trends_title`: What Changed Between Years?
- `trends_lede`: Compare medal patterns and see how past winners did in a later year.
- `forecast_title`: Explore the Next Award Cycle
- `forecast_lede`: Adjust a medal trend scenario by style, brewery location, state, or city.
- `data_title`: Know What Is in the Data
- `data_lede`: Coverage, sources, definitions, and the path to five years of results.

## `trends`

Where: the trends tab.

- `year_hint`: Use the year controls below for this view. Every other sidebar filter applies; the sidebar year filter does not.
- `window_title`: Five Years, with Gaps Shown
- `window_note`: A missing year is not a year without medals.
- `missing`: Missing
- `not_loaded`: Not Loaded
- `not_loaded_option`: {{year}} (Not Loaded)
- `compare_title`: Compare the Distribution
- `compare_note`: Changes describe the winner records loaded, not beer demand or entry success rates.
- `earlier_year`: Earlier Year
- `later_year`: Later Year
- `compare_by`: Compare by
- `export_changes`: Export Changes
- `export_selection`: Export Selection
- `table_note`: Showing up to 30 groups by size of change in medal count. The export includes every group. Shares use all selected medals in each year.
- `columns_medals`: {{year}} Medals
- `columns_share`: {{year}} Share
- `change`: Change
- `share_change`: Share Change
- `order_error`: Choose two loaded years in order, earlier first.
- `both_needed`: Load both years to compare them.
- `chart_label`: Medals by year. {{summary}}

## `recurrence`

Where: the recurrence ranking on the trends tab.

- `title`: Past Winners, Tested Against a Later Year
- `lede`: An exploratory ranking of brewery locations with an earlier medal.
- `held_out`: Held Out Year
- `candidates`: Candidates
- `top_10`: Top 10
- `top_20`: Top 20
- `top_50`: Top 50
- `export`: Export Rankings
- `score_note`: Score: earlier medal points (gold 3, silver 2, bronze 1), halved for each year of age. The held out year only shows what happened next.
- `partial_title`: Partial history.
- `partial_body`: The four year window is missing {{years}}. This is a recurrence test, not a calibrated forecast of winners.
- `earlier_years`: Earlier Years Used
- `prior_locations`: Prior Winning Locations
- `later_medal`: Top Candidates with a Later Medal
- `observed`: Share of Candidates That Medaled Again
- `ties_note`: Ties are ordered by brewery name and location. This is not a win probability: breweries that entered without medaling, and their entry counts, are not in the data. Some filters may use information that did not exist in the earlier year.

### `columns`

- `rank`: Rank
- `location`: Brewery and Location
- `prior_score`: Prior Score
- `earlier_medals`: Earlier Medals
- `later_medals`: {{year}} Medals

## `forecast`

Where: the forecast tab.

- `disclaimer`: A scenario based on share trends, not a probability of winning.
- `points_research`: Research Points (3 / 2 / 1)
- `points_gabf`: GABF Point Weights (6 / 5 / 4)
- `no_change`: No change modeled.
- `empty`: No forecast is available for this selection.
- `empty_hint`: Clear a filter to bring award records into the forecast.
- `no_history`: No earlier records for this scenario.
- `no_latest`: No medals in the latest loaded year.

## `empty`

Where: empty states across the tabs.

- `awards`: No awards match these filters.
- `awards_hint`: Remove a filter or try a shorter search. Every word you enter must match.
- `no_matching`: No Matching Awards
- `breweries`: No brewery locations in this selection.
- `location_hint`: Try removing a location, category, or year filter.
- `one_column`: Keep at least one column visible.

## `fields`

Where: field names in tables, filters, and the award details panel.

- `year`: Year
- `medal`: Medal
- `beer`: Beer or Cider
- `brewery`: Brewery
- `state`: State
- `city`: City
- `fed_district`: Fed District
- `metro_area`: Metro Area
- `category`: Award Category
- `style_family`: Style Family
- `fermentation`: Fermentation
- `beverage`: Beverage
- `competition`: Competition
- `hops`: Confirmed Hops
- `hop_clues`: Hops Named in the Beer's Name
- `owner`: Owner
- `investors`: Investors
- `brewery_type`: Brewery Type
- `association`: Brewers Association Membership
- `zip`: ZIP Code
- `address`: Address
- `phone`: Phone
- `website`: Website
- `beer_page`: Beer Page
- `brewer`: Brewer
- `abv`: ABV (%)
- `ibu`: IBU
- `entries`: Category Entries
- `subcategory`: Subcategory
- `evidence`: Evidence
- `award_id`: Award ID
- `beer_id`: Beer ID
- `location_id`: Brewery Location ID
- `reference`: Award Reference
- `import_source`: Import Source
- `not_researched`: Not Found
- `not_established`: Not Found

## `characteristics`

Where: category characteristic filters.

- `all`: All Characteristics
- `sour`: Sour or Wild Category
- `fruit`: Fruit Category
- `spice`: Herb or Spice Category
- `coffee`: Coffee Category
- `chocolate`: Chocolate Category
- `barrel_aged`: Wood or Barrel Category
- `non_alcoholic`: Nonalcoholic Category
- `gluten_free`: Gluten-Free Category
- `none_found`: No Characteristic in the Category Name

## `taxonomy`

Where: the explorer's own grouping of categories. It differs from the site's style families.

- `specialty_mixed`: Specialty or Mixed
- `special_competition`: Special Competition
- `cider_perry`: Cider or Perry
- `dark_ale_stout`: Dark Ale or Stout
- `sour_wild`: Sour or Wild
- `hoppy_lager`: Hoppy Lager or Cold IPA
- `ipa`: IPA
- `stout`: Stout
- `porter`: Porter
- `pilsener`: Pilsener
- `bock`: Bock
- `kolsch`: Kölsch
- `altbier`: Altbier
- `lager`: Lager
- `wheat`: Wheat Beer
- `belgian`: Belgian or Farmhouse
- `brown_ale`: Brown Ale
- `strong_ale`: Strong Ale
- `pale_ale`: Pale Ale
- `other_ale`: Other Ale
- `non_alcoholic`: Nonalcoholic
- `fermentation_ale`: Ale
- `fermentation_lager`: Lager
- `fermentation_mixed`: Ale or Lager
- `fermentation_fruit`: Fruit Fermentation
- `fermentation_sour`: Sour or Mixed
- `fermentation_unspecified`: Mixed or Unspecified
- `unspecified`: Not Found
- `beverage_beer`: Beer
- `beverage_cider`: Cider or Perry
- `competition_main`: Main Competition
- `competition_pro_am`: Pro-Am
- `competition_collaboration`: Collaboration

## `details`

Where: the award details panel.

- `title`: Award Details
- `close`: Close
- `open_reference`: Open Reference
- `map_address`: Map Address
- `search_beer`: Search for the Beer
- `search_map`: Search the Map
- `supplied_unvalidated`: Supplied record; not checked against a primary source.
- `imported_note`: Imported record. Check its evidence.
- `reference_found`: Reference found; award records not imported.
- `supplied_2026`: Records came from a CSV labeled {{year}}. Rows have not been checked against the live reference.

## `compare`

Where: the comparison tray.

- `add`: Add to Comparison
- `added`: Brewery location added to comparison.
- `in_comparison`: In Comparison
- `choose`: Choose Breweries
- `compare_one`: Compare {{brewery_name}} in {{city}}

## `stats`

Where: summary tiles in the explorer.

- `total_medals`: Total Medals
- `gold_medals`: Gold Medals
- `medal_split`: Gold, Silver, Bronze
- `medal_count`: Medal Count
- `award_rows`: Award Rows
- `distinct_beers`: Distinct Beers
- `locations`: Brewery Locations
- `style_families`: Style Families

## `import`

Where: the import dialog.

- `title`: Import Data
- `close`: Close
- `lede`: Add past awards, or match sourced brewery and beer details to existing records. Changes stay in this browser until you save a new dashboard.
- `kind_label`: Data to Import
- `kind_awards`: Awards: Add Missing Records
- `kind_breweries`: Brewery Details: Match by Brewery Location ID
- `kind_beers`: Beer Details: Match by Beer ID
- `kind_award_details`: Award Details: Match by Award ID
- `template`: Download CSV Template
- `choose_file`: Choose a CSV File
- `apply`: Apply Import
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

- `title`: Share This Workspace
- `close`: Close
- `lede`: Download one HTML file with the data and your current filters. Anyone can open it in a browser; no account or installation needed.
- `summary`: {{count}} award records · {{years}}
- `segment`: {{count}} in the current selection · {{tab}}
- `download`: Download Shareable HTML
- `note`: Source links need an internet connection. Imported records are included. This makes a file, not a public web address.
- `saved`: Saved a self contained dashboard with your current data and view.

## `footer`

Where: the explorer footer.

- `edition`: GABF Analysis Explorer · Research Edition
- `promise`: Data built in · Works offline · No tracking
