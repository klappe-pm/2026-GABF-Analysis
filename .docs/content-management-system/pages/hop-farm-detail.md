# Hop farm detail

One hop farm: its data, its varieties, and the medal beers linked to it, in two separate tables.

## `links`

Where: links above the title.

- `back`: All hop farms
- `hops`: All hops

## `pills`

Where: the line under the farm name.

- `varieties`: Varieties published: {{count}}

## `data`

Where: the farm data card.

- `title`: Farm data
- `state`: State
- `aliases`: Also published as

## `varieties`

Where: the varieties section.

- `title`: Varieties grown here
- `variety`: Hop variety
- `published`: Published as
- `years`: Years
- `medal_beers`: Medal beers in {{year}}
- `source`: Source
- `missing`: No variety has been published for this farm yet.

## `named`

Where: the section for medal beers whose brewery named this farm.

- `title`: {{year}} medal beers that name this farm
- `label`: Brewery named this farm.
- `note`: The brewery published this farm for the hop shown. This is a direct link with its own source.
- `hop`: Hop
- `published`: Published as
- `source`: Source
- `missing`: No brewery of a {{year}} medal beer has named this farm.

## `grown`

Where: the section for medal beers that use a variety this farm grows.

- `title`: {{year}} medal beers that use hops grown here
- `label`: Grown by.
- `note`: These beers use a hop variety this farm publishes as grown. It does not mean the brewery bought from this farm.
- `hops`: Hop varieties
- `missing`: No {{year}} medal beer uses a variety this farm grows.

## `merchants`

Where: the merchants table, when merchants are on record for the farm.

- `title`: Hop merchants

## `doc`

Where: the research notes under the tables, when a research document exists for the farm.

- `title`: Research notes

## `meta`

Where: the search description of the page.

- `description`: {{name}}: farm data, the hop varieties it grows, and the medal beers linked to it.
