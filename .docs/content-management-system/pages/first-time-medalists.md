# First time medalists

First time medalists: breweries whose first medal in the record came in the latest year.

## `header`

Where: top of the page.

- `title`: First Time Medalists, {{year}}
- `lede`: {{count}} breweries won their first medal in the record in {{year}}. Each of their {{year}} medals is listed with the field it beat.

## `definition`

Where: the definition card under the lede.

- `title`: How First Time Is Defined
- `range`: The record runs {{first_year}} to {{last_year}}.
- `partial`: {{partial_years}} hold only a sample of medals from secondary sources.
- `missing`: {{missing_years}} has no results loaded.
- `rule`: A first time medalist has no medal in any loaded year before {{year}}. A medal in a year that is not loaded cannot be seen, so a brewery whose earlier medals all fall in such a year counts here.
- `matching`: Breweries are matched on a normalized name, so renamed printings and location suffixes such as "(Costa Mesa)" roll up to one brewery.
- `complete_record`: A brewery whose only earlier medals fall in partial years is listed separately, as first in the complete record ({{complete_range}}).
- `totals`: Before any filter: {{new_count}} first time medalists and {{complete_count}} first in the complete record.

## `stats`

Where: the summary tiles.

- `breweries`: First Time Medalists
- `breweries_note`: No medal in the record before {{year}}
- `share`: Share of {{year}} Medals in View
- `share_note`: {{count}} of {{total}} medals
- `golds`: Golds Among Them
- `golds_note`: {{share}} of their medals
- `split`: Their Gold, Silver, Bronze
- `title`: Summary
- `complete`: First in the Complete Record
- `complete_note`: Earlier medals only in partial years

## `charts`

Where: the four breakdowns.

- `by_state_title`: By State
- `by_state_subtitle`: Medals Won by First Time Medalists, Top 20
- `by_district_title`: By Fed District
- `by_district_subtitle`: Federal Reserve District of the Medal City
- `by_family_title`: By Style Family
- `by_medal_title`: By Medal

## `table`

Where: the medal tables.

- `title`: First Time Medalists
- `brewery`: Brewery
- `medal`: Medal
- `beer`: Beer
- `category`: Category
- `entries_beaten`: Entries Beaten
- `empty`: No first time medalist in view.
- `abv`: ABV
- `ibu`: IBU
- `beer_profile`: Beer Profile
- `open_profile`: Full Profile
- `caption`: Medals of first time medalists in {{year}}, grouped by brewery.
- `sort_hint`: Select a column header to sort.

## `complete_record`

Where: the second table.

- `title`: First in the Complete Record
- `note`: These breweries medaled in {{year}} and earlier only in partial years ({{partial_years}}), which hold a sample of medals, not the official lists. Counting only the complete lists ({{complete_range}}), they are first time medalists.
- `empty`: None in view.
- `caption`: Medals of breweries that are first in the complete record in {{year}}.

## `names_to_check`

Where: the names to check section at the bottom.

- `title`: Names to Check
- `note`: Each of these first time medalists shares a city and a name word with an earlier medalist, or one name contains the other. They stay separate because nothing in the data shows they are the same brewery. Check them before relying on the count.
- `first_time`: First Time Medalist
- `earlier`: Earlier Medalist to Compare
- `earlier_value`: {{name}} ({{city}}, {{state}}; {{years}})
- `empty`: No first time medalist shares a city and a name with an earlier medalist.
- `caption`: First time medalists next to the earlier medalists they may be the same as.
