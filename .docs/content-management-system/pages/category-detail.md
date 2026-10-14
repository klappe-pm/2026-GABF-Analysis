# Category detail

Category detail: one category's definition, entries by year, and every medalist.

## `links`

Where: links above the title.

- `back`: All Categories
- `chart_this`: Chart This Category

## `pills`

Where: the pills under the title; type and family labels come from labels.yaml.

- `abv`: ABV {{min}} to {{max}}%
- `ibu`: IBU {{min}} to {{max}}
- `srm`: SRM {{min}} to {{max}}
- `entrants`: {{count}} entrants in {{year}}

## `definition`

Where: the definition card.

- `title`: Style Definition
- `special_note`: Special categories are judged on an added ingredient, a process, or a nonstandard base, not on one classic style.
- `classic_note`: Classic style categories are judged against one Brewers Association style description.
- `source`: Source: {{source}}
- `source_with_confidence`: Source: {{source}} ({{confidence}})
- `variant`: Listed there as {{variant_name}}.

## `ranges`

Where: the labels of the style range scales in the definition card. Each scale reads its summary from the pills above.

- `abv`: ABV
- `ibu`: IBU
- `srm`: SRM

## `entrants`

Where: the entrants chart, or the card that replaces it.

- `title`: Entrants by Year
- `subtitle`: How crowded the category is
- `series`: Entries
- `one_year`: {{count}} entries in {{year}}. A trend needs a second year with entry counts in view.
- `none`: No entry counts in view for this category.

## `medalists`

Where: the medalists section.

- `title`: Medalists by Year
- `year_heading`: {{year}}
- `year_heading_number`: {{year}} · Category {{number}}
- `year_heading_entrants`: {{year}} · Category {{number}} · {{count}} entrants

## `empty`

Where: in place of the medalists when this category has no medals in the record.

- `page`: No medals in the record for this category.
