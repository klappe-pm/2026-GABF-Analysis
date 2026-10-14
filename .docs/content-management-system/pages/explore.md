# Explore

Explore: every medal in one searchable table, with your own awards added from a CSV and a few more filters. It replaces the standalone explorer and sits under Analysis.

## `header`

Where: top of the page.

- `title`: Explore the awards
- `lede`: Search every award, add past awards from your own CSV, and narrow by competition section, investors, and category characteristics. The table also follows Filters.

## `search`

Where: the search field above the table.

- `label`: Search awards
- `placeholder`: Beer, brewery, city, or owner
- `hint`: Every word you enter must match.

## `filters`

Where: the extra filters beside the search field.

- `title`: More filters
- `reset`: Reset these filters
- `section`: Competition section
- `section_all`: All sections
- `investors`: Investors
- `investors_placeholder`: Part of an investor name
- `trait`: Category characteristic
- `trait_all`: All characteristics

### `sections`

Where: the competition section options; the keys are the values in the data.

- `main`: Main competition
- `pro-am`: Pro-Am
- `collaboration`: Collaboration

### `traits`

Where: the category characteristic options; each is found by words in the category name.

- `sour`: Sour or wild category
- `fruit`: Fruit category
- `spice`: Herb or spice category
- `coffee`: Coffee category
- `chocolate`: Chocolate category
- `barrel_aged`: Wood or barrel category
- `non_alcoholic`: Nonalcoholic category
- `gluten_free`: Gluten-free category

## `table`

Where: the award table.

- `title`: Awards
- `count`: {{count}} of {{total}} awards
- `sort_hint`: Select a column header to sort.
- `imported`: Imported
- `imported_count`: {{count}} imported

### `columns`

- `year`: Year
- `medal`: Medal
- `beer`: Beer
- `brewery`: Brewery
- `city`: City
- `category`: Award category
- `family`: Style family
- `owner`: Owner

## `import`

Where: the import card.

- `title`: Import awards from a CSV
- `privacy`: Your file is read in this browser and is never uploaded. Imported awards stay on this page until you leave it or remove them.
- `help`: Required columns: year, medal, beer, brewery, city, state, and category. Identical award rows are skipped. Other columns are ignored.
- `choose_file`: Choose a CSV file
- `result`: Imported: {{added}} added, {{skipped}} skipped.
- `remove`: Remove imported awards
- `removed`: Imported awards removed.
- `reading`: Reading and checking the CSV…

### `errors`

- `unclosed_quote`: A quoted value in the CSV is never closed.
- `no_rows`: The CSV needs a header row and at least one data row.
- `duplicate_columns`: The CSV has two columns with the same name.
- `field_count`: Row {{row}} has {{count}} fields; the header has {{expected}}.
- `missing_column`: The CSV is missing a required column: {{column}}.
- `blank_required`: Row {{row}}: beer, brewery, and category cannot be blank.
- `bad_medal`: Row {{row}}: medal must be Gold, Silver, or Bronze.
- `bad_year`: Row {{row}}: year must be four digits between 1982 and 2100.
- `too_many_rows`: Import at most 20,000 rows at a time.
- `too_large`: CSV files can be up to 8 MB.

## `links`

Where: the links under the header.

- `saved_views`: Keep this view in Saved views
- `back`: All analysis

## `empty`

Where: in place of the table when nothing matches.

- `awards`: No awards match these filters.
- `awards_hint`: Remove a filter or try a shorter search. Every word you enter must match.
