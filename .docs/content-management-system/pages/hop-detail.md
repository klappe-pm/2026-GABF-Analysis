# Hop detail

One hop variety: its data, aroma, US acreage by state, the medal beers that use it, and the farms that grow it.

## `links`

Where: links above the title.

- `back`: All hops
- `farms`: All hop farms

## `pills`

Where: the line under the hop name.

- `origin`: Origin: {{origin}}
- `breeder`: Bred by {{breeder}}
- `aliases`: Also published as {{aliases}}
- `medal_beers`: Medal beers in {{year}}: {{count}}

## `data`

Where: the variety data card.

- `title`: Variety data
- `breeder`: Breeder
- `origin`: Origin country
- `aliases`: Also published as
- `missing`: No variety data has been published for this hop yet.
- `range`: {{min}} to {{max}}

## `card`

Where: the hop profile card at the top of the page.

- `range_percent`: {{min}} to {{max}}%
- `oil_range`: {{min}} to {{max}} mL per 100 g
- `farm_line`: {{farm_name}}, {{state}}

## `table`

Where: every table on the page.

- `sort_hint`: Select a column header to sort.

## `aroma`

Where: the aroma section.

- `title`: Aroma descriptors
- `note`: Each descriptor is attributed to the source that published it.
- `descriptor`: Descriptor
- `source`: Source
- `missing`: No aroma descriptors have been published for this hop yet.

## `acreage`

Where: the US acreage section.

- `title`: US acreage by state
- `state`: State
- `year`: Year
- `acres`: Acres
- `production`: Production
- `source`: Source
- `missing`: No US acreage has been published for this hop yet.
- `chart_title`: US acres by year
- `chart_note`: The total of the states that reported acres for this hop in each year.
- `series`: Total reported acres
- `name_column`: Measure
- `table_summary`: Show the acreage as a table
- `chart_label`: Line chart of the US acres of {{name}} by year

## `beers`

Where: the medal beers section.

- `title`: {{year}} medal beers that use it
- `note`: The farm column shows only a farm the brewery itself named for this hop.
- `medal`: Medal
- `beer`: Beer
- `brewery`: Brewery
- `category`: Category
- `form`: Form
- `use`: Use
- `farm`: Farm named by the brewery
- `missing`: No {{year}} medal beer is on record for this hop.

## `farms`

Where: the farms section.

- `title`: Farms that grow it
- `label`: Grown by.
- `note`: These farms publish this variety as grown. It does not mean a medal beer used hops from that farm.
- `farm`: Farm
- `state`: State
- `published`: Published as
- `years`: Years
- `source`: Source
- `missing`: No farm has been published as growing this hop yet.

## `doc`

Where: the research notes under the farms section, when a research document exists for the hop.

- `title`: Research notes

## `meta`

Where: the search description of the page.

- `description`: {{name}}: data, aroma descriptors, US acreage, {{year}} medal beers, and the farms that grow it.

## `shared_views`

Where: the Hops column of the medal tables and the hops table on brewery pages.

- `column`: Hops
- `none`: Not defined
- `brewery_title`: Hops in these medal beers
- `brewery_note`: Each variety links to its page, with the farms that grow it.
- `brewery_variety`: Hop variety
- `brewery_beers`: Medal beers
