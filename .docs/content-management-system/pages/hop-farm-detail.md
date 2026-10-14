# Hop farm detail

One hop farm: its data, its varieties, and the medal beers linked to it, in two separate tables.

## `links`

Where: links above the title.

- `back`: All Hop Farms
- `hops`: All Hops

## `pills`

Where: the line under the farm name.

- `varieties`: Varieties published: {{count}}

## `unfiltered`

Where: under the heading of a section that shows the whole record and does not change with the Filters.

- `note`: Whole record, not narrowed by the filters.

## `table`

Where: every table on the page.

- `sort_hint`: Select a column header to sort.

## `data`

Where: the farm data card.

- `title`: Farm Data
- `state`: State
- `aliases`: Also Published as

## `varieties`

Where: the varieties section.

- `title`: Varieties Grown Here
- `variety`: Hop Variety
- `published`: Published as
- `years`: Years
- `medal_beers`: Medal Beers in {{year}}
- `source`: Source
- `verified`: Verified
- `notes`: Notes
- `missing`: No variety has been published for this farm yet.

## `named`

Where: the section for medal beers whose brewery named this farm.

- `title`: {{year}} Medal Beers That Name This Farm
- `label`: Brewery Named This Farm.
- `note`: The brewery published this farm for the hop shown. This is a direct link with its own source.
- `hop`: Hop
- `published`: Published as
- `source`: Source
- `missing`: No brewery of a {{year}} medal beer has named this farm.

## `grown`

Where: the section for medal beers that use a variety this farm grows.

- `title`: {{year}} Medal Beers That Use Hops Grown Here
- `label`: Grown by.
- `note`: These beers use a hop variety this farm publishes as grown. It does not mean the brewery bought from this farm.
- `hops`: Hop Varieties
- `missing`: No {{year}} medal beer uses a variety this farm grows.

## `breweries`

Where: the breweries section.

- `title`: Breweries With a {{year}} Medal Beer Linked to This Farm
- `note`: Each brewery links to its page, with how the farm is linked.
- `brewery`: Brewery
- `link`: Link
- `named`: Named by the Brewery.
- `grown`: Grown Through a Variety the Brewery Uses.
- `beers`: Medal Beers
- `missing`: No brewery with a {{year}} medal beer is linked to this farm.

## `merchants`

Where: the merchants table, when merchants are on record for the farm.

- `title`: Hop Merchants

## `doc`

Where: the research notes under the tables, when a research document exists for the farm.

- `title`: Research Notes

## `meta`

Where: the search description of the page.

- `description`: {{name}}: farm data, the hop varieties it grows, and the medal beers linked to it.
