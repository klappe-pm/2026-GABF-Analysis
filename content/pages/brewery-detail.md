# Brewery detail

Brewery detail: one brewery's medals, profile, ownership, distribution, and estimated scale.

## `links`

Where: links above the title.

- `back`: All breweries
- `dashboard`: Open in the breweries dashboard
- `website`: Website

## `pills`

Where: the pills under the title; type, ownership, and channel labels come from labels.yaml.

- `founded`: Founded {{year}}
- `streak`: {{count}} year medal streak
- `owner_with_parent`: {{ownership}}: {{parent}}

## `stats`

Where: the summary tiles at the top of the page.

- `medals`: Medals in view
- `medal_split`: Gold, silver, bronze
- `first_medal`: First medal in view
- `first_medal_none`: None
- `categories`: Categories medaled
- `categories_note`: {{count}} in special categories
- `barrels`: Estimated barrels per year
- `barrels_note_reported`: Reported
- `barrels_note_estimate`: Estimate (E)
- `arr`: Estimated ARR
- `arr_note`: EBITDA {{ebitda}} at {{margin}} (E)

## `charts`

Where: the charts beside the profile card.

- `by_year_title`: Medals by year
- `by_year_subtitle`: {{brewery_name}}, {{first_year}} to {{last_year}}
- `by_year_note`: Notes under a year: not founded, not loaded, partial, or no results.
- `by_family_title`: Medals by style family
- `by_location_title`: Medals by location credited
- `by_location_subtitle`: As printed in the winners list
- `by_category_title`: Medals by category
- `table_status`: Status

## `history`

Where: the medal history table.

- `title`: Medal history
- `note`: Field is the number of entries in the category that year. Entries per medal divides the field by the medals awarded.
- `empty`: No medals in the record.

## `recent`

Where: the recent years list.

- `title`: Recent years
- `line`: {{count}} medals: {{split}}
- `line_one`: 1 medal: {{split}}
- `split_gold`: {{count}} gold
- `split_silver`: {{count}} silver
- `split_bronze`: {{count}} bronze
- `no_medal`: No medal in view

## `profile`

Where: the profile card, first block.

- `title`: Profile
- `type`: Type
- `headquarters`: Headquarters
- `founded`: Founded
- `employees`: Employees
- `employees_value`: {{count}} (reported)
- `website`: Website
- `locations`: Locations
- `location_line`: {{name}}: {{address}}
- `location_opened`: opened {{year}}
- `location_kitchen`: kitchen
- `location_map`: Map
- `locations_missing`: {{count}} locations in the results. Addresses: Not defined.
- `known_for`: Known for
- `known_for_missing`: Not defined
- `missing`: Not defined

## `ownership`

Where: the profile card, ownership block.

- `title`: Ownership and investors
- `type`: Ownership
- `parent`: Parent
- `investors`: Investors
- `stake`: Stake
- `stake_value`: {{stake}}, {{year}}
- `ba_independent`: Independent (Brewers Association definition)
- `status`: Status
- `source`: Source
- `unverified`: Curated from public announcements; not checked against a primary source.
- `missing`: Not defined
- `missing_note`: Breweries without ownership research count as independent in totals.

## `distribution`

Where: the profile card, distribution block.

- `title`: Distribution
- `channel_fallback`: Channel
- `since`: since {{year}}
- `unverified_pill`: Not checked
- `source`: Source: {{source}}
- `missing`: Not defined

## `scale`

Where: the profile card, estimated scale block. Every figure here is an estimate unless marked reported.

- `title`: Estimated scale
- `barrels`: Barrels per year
- `barrels_note`: ({{basis}}, {{confidence}})
- `equivalent`: Equivalent
- `equivalent_value`: {{gallons}} gallons, or {{cases}} cases of 24 twelve ounce cans. About {{cans}} sixteen ounce cans packaged (assuming {{packaged_share}} packaged) and {{pints}} pints on draft.
- `revenue`: Revenue (ARR)
- `revenue_note`: (range {{low}} to {{high}}, E)
- `gross_margin`: Gross margin
- `gross_margin_note`: (gross profit {{gross_profit}}, E)
- `ebitda`: EBITDA
- `ebitda_value`: {{ebitda}} at {{margin}}
- `ebitda_note`: (range {{margin_low}} to {{margin_high}}, {{low}} to {{high}}, E)
- `per_barrel`: Revenue per barrel
- `per_barrel_note`: (cost of goods assumed at {{cogs}} per barrel, E)
- `per_location`: Revenue per location
- `per_location_note`: across {{count}} locations, E
- `per_location_note_kitchen`: across {{count}} locations with kitchens, E
- `per_employee`: Revenue per employee
- `method_link`: How these estimates are made

## `other_competitions`

Where: the other competitions section, when the brewery has medals outside this competition.

- `title`: Other competitions
- `note`: World Beer Cup and other competitions, as recorded. Filters cover Great American Beer Festival medals only.

## `deep_dive`

Where: the deep dive section at the bottom of the page.

- `title`: Deep dive
- `missing`: No deep dive yet.
