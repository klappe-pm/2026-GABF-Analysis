# Brewery detail

Brewery detail: one brewery's medals, profile, ownership, distribution, and estimated scale.

## `links`

Where: links above the title.

- `back`: All Breweries
- `dashboard`: Open in the Breweries Dashboard
- `website`: Website

## `pills`

Where: the pills under the title; type, ownership, and channel labels come from labels.yaml.

- `founded`: Founded {{year}}
- `streak`: {{count}} Year Medal Streak
- `owner_with_parent`: {{ownership}}: {{parent}}

## `stats`

Where: the summary tiles at the top of the page.

- `title`: Summary
- `medals`: Medals in View
- `medal_split`: Gold, Silver, Bronze
- `first_medal`: First Medal in View
- `first_medal_none`: None
- `categories`: Categories Medaled
- `categories_note`: {{count}} in special categories
- `barrels`: Estimated Barrels per Year
- `barrels_note_reported`: Reported
- `barrels_note_estimate`: Estimate (E)
- `arr`: Estimated ARR
- `arr_note`: EBITDA {{ebitda}} at {{margin}} (E)

## `charts`

Where: the charts beside the profile card.

- `by_year_title`: Medals by Year
- `by_year_subtitle`: {{brewery_name}}, {{first_year}} to {{last_year}}
- `by_year_note`: Notes under a year: not founded, not loaded, partial, or no results.
- `by_family_title`: Medals by Style Family
- `by_location_title`: Medals by Location Credited
- `by_location_subtitle`: As Printed in the Winners List
- `by_category_title`: Medals by Category
- `table_status`: Status

## `history`

Where: the medal history table.

- `title`: Medal History
- `note`: Field is the number of entries in the category that year. Entries per medal divides the field by the medals awarded.
- `empty`: No medals in the record.

## `recent`

Where: the recent years list.

- `title`: Recent Years
- `line`: {{count}} medals: {{split}}
- `line_one`: 1 medal: {{split}}
- `split_gold`: {{count}} gold
- `split_silver`: {{count}} silver
- `split_bronze`: {{count}} bronze
- `no_medal`: No Medal in View

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
- `locations_missing`: {{count}} locations in the results. Addresses: {{not_found}}.
- `locations_missing_one`: 1 location in the results. Address: {{not_found}}.
- `known_for`: Known for
- `known_for_missing`: Not Found
- `missing`: Not Found

## `ownership`

Where: the profile card, ownership block.

- `title`: Ownership and Investors
- `type`: Ownership
- `parent`: Parent
- `investors`: Investors
- `stake`: Stake
- `stake_value`: {{stake}}, {{year}}
- `ba_independent`: Independent (Brewers Association Definition)
- `status`: Status
- `source`: Source
- `unverified`: Curated from public announcements; not checked against a primary source.
- `missing`: Not Found
- `missing_note`: Breweries without ownership research are not counted as independent.

## `distribution`

Where: the profile card, distribution block.

- `title`: Distribution
- `channel_fallback`: Channel
- `since`: since {{year}}
- `unverified_pill`: Not Checked
- `source`: Source: {{source}}
- `missing`: Not Found

## `scale`

Where: the profile card, estimated scale block. Every figure here is an estimate unless marked reported.

- `title`: Estimated Scale
- `barrels`: Barrels per Year
- `barrels_note`: ({{basis}}, {{confidence}})
- `equivalent`: Equivalent
- `equivalent_value`: {{gallons}} gallons, or {{cases}} cases of 24 twelve ounce cans. About {{cans}} sixteen ounce cans packaged (assuming {{packaged_share}} packaged) and {{pints}} pints on draft.
- `revenue`: Revenue (ARR)
- `revenue_note`: (range {{low}} to {{high}}, E)
- `gross_margin`: Gross Margin
- `gross_margin_note`: (gross profit {{gross_profit}}, E)
- `ebitda`: EBITDA
- `ebitda_value`: {{ebitda}} at {{margin}}
- `ebitda_note`: (range {{margin_low}} to {{margin_high}}, {{low}} to {{high}}, E)
- `per_barrel`: Revenue per Barrel
- `per_barrel_note`: (cost of goods assumed at {{cogs}} per barrel, E)
- `per_location`: Revenue per Location
- `per_location_note`: across {{count}} locations, E
- `per_location_note_kitchen`: across {{count}} locations with kitchens, E
- `per_employee`: Revenue per Employee
- `per_location_note_one`: for its one location, E
- `per_location_note_kitchen_one`: for its one location, which has a kitchen, E
- `method_link`: How These Estimates Are Made
- `assumed_note`: No brewery type was found, so these estimates use an assumed generic type.

## `other_competitions`

Where: the other competitions section, when the brewery has medals outside this competition.

- `title`: Other Competitions
- `note`: World Beer Cup and other competitions, as recorded. Filters cover Great American Beer Festival medals only.

## `deep_dive`

Where: the deep dive section at the bottom of the page, shown only when a deep dive exists.

- `title`: Deep Dive
- `missing`: No deep dive yet.
- `record_title`: Research Record
- `record_link`: Open the Tracked Research File for This Brewery

## `trend`

Where: the ten year trend table under the medal chart.

- `title`: Ten Year Trend
- `note`: Each year says whether the brewery medaled. When it did not, the status says why there is nothing to count, including years before the brewery opened.
- `year`: Year
- `status`: Status
- `medals`: Medals
- `split`: Gold / Silver / Bronze
- `caption`: Medals and status of {{brewery_name}} in the last ten years.

## `chart`

Where: the medals by year chart.

- `aria`: Stacked bar chart of the medals {{brewery_name}} won each year, gold, silver, and bronze.
- `series_total`: All Medals

## `tables`

Where: the table views of the charts and the medal history table.

- `category_caption`: Medals of {{brewery_name}} by category.
- `location_caption`: Medals of {{brewery_name}} by location credited.
- `family_caption`: Medals of {{brewery_name}} by style family.
- `history_caption`: Every Great American Beer Festival medal of {{brewery_name}} in view.
- `other_caption`: Medals of {{brewery_name}} in other competitions.
- `ibu`: IBU
- `beer_profile`: Beer Profile
- `open_profile`: Full Profile
- `medals`: Medals

## `hops`

Where: the hops used section.

- `caption`: Hops in the medal beers of {{brewery_name}}.

## `farms`

Where: the hop farms section, which keeps the two kinds of link apart.

- `title`: Hop Farms Reached Through These Hops
- `note`: A farm the brewery named is a direct statement in a beer profile. A farm that grows one of these hops is published as growing it, and it does not mean the beer used hops from that farm.
- `named_label`: Brewery Named This Farm
- `named_empty`: No beer profile of this brewery names a farm.
- `named_caption`: Hop farms named by {{brewery_name}} for a hop in a beer profile.
- `grown_label`: Grown by
- `grown_empty`: No farm is published as growing a hop this brewery uses.
- `grown_caption`: Hop farms published as growing a hop that {{brewery_name}} uses.
- `farm`: Farm
- `hops`: Hops

## `beers`

Where: the beer profile cards of the latest year.

- `title`: {{year}} Medal Beers

## `partial`

Where: a brewery whose medals all fall in partial years, which the default view hides.

- `title`: No medals in view.

## `profile_extra`

Where: the profile card, extra rows.

- `kitchen`: Kitchen
- `links`: Links
- `link_instagram`: Instagram
- `link_untappd`: Untappd
- `link_beeradvocate`: BeerAdvocate
- `links_checked`: Checked {{date}}
- `source_line`: Source: {{source}}
- `source_profile`: Brewery Profile
- `source_override`: Hand Checked Correction
- `source_open_brewery_db`: Open Brewery DB
- `current_beers`: Current Beers
- `current_beers_line`: As of {{date}}, from {{source}}.
- `current_beer_detail`: ({{detail}})
- `abv_suffix`: {{abv}}% ABV
- `parent_type`: ({{type}})
- `location_none`: Not Found

## `estimates`

Where: the text inside every estimate tooltip. Tokens in braces are filled from the brewery's figures.

- `mark_label`: Estimate. How the {{metric}} estimate was made
- `foot`: Estimate, not reported.
- `metric_barrels`: barrels per year
- `metric_arr`: annual revenue (ARR)
- `metric_gross_margin`: gross margin
- `metric_ebitda`: EBITDA
- `metric_per_barrel`: revenue per barrel
- `metric_per_location`: revenue per location
- `metric_per_employee`: revenue per employee
- `type_phrase_known`: its brewery type ({{type}})
- `type_phrase_assumed`: an assumed generic type, because no brewery type was found
- `barrels_reported`: Reported by the brewery: {{barrels}} barrels.
- `barrels_reported_year`: Reported by the brewery for {{year}}: {{barrels}} barrels.
- `barrels_bracket`: The midpoint of the Brewery of the Year size bracket it competed in ({{min}} to {{max}} barrels): {{barrels}} barrels.
- `barrels_bracket_open`: 1.25 times the floor of the open Brewery of the Year size bracket it competed in (over {{floor}} barrels): {{barrels}} barrels.
- `barrels_researched`: A researched estimate from published reporting on this brewery ({{confidence}}): {{barrels}} barrels.
- `barrels_typical`: No production figure is published, so this uses the typical volume for {{type_phrase}}: {{per_type}} barrels.
- `barrels_locations`: Each location after the first adds {{extra}} barrels, and this brewery has {{more}} more.
- `barrels_total`: Estimated total: {{barrels}} barrels.
- `arr_profile`: A researched revenue estimate for this brewery of {{revenue}}, with a range of {{low}} to {{high}}.
- `arr_computed`: {{barrels}} barrels times {{per_barrel}} per barrel, the benchmark price for {{type_phrase}}, gives {{total}} a year. The range shown is {{low_multiplier}} to {{high_multiplier}} times that.
- `arr_food`: Kitchen revenue adds {{food_total}}: {{per_location}} multiplied by {{count}} for the number of locations.
- `gross_margin`: Annual revenue ({{arr}}) times a {{margin}} gross margin, typical for {{type_phrase}}, gives {{profit}} of gross profit.
- `ebitda`: Annual revenue ({{arr}}) times a {{margin}} EBITDA margin, typical for {{type_phrase}}, gives {{ebitda}}. The range uses {{low_margin}} to {{high_margin}}, typical for {{channel_phrase}}.
- `per_barrel`: Annual revenue ({{arr}}) divided by {{barrels}} barrels.
- `per_location`: Annual revenue ({{arr}}) divided by the number of locations ({{count}}).
- `per_employee`: Annual revenue ({{arr}}) divided by the number of employees ({{employees}}).
- `channel_taproom`: breweries that sell in their own taproom
- `channel_self_distribution`: self distributed breweries
- `channel_distributor`: breweries that sell through a distributor
- `channel_default`: similar breweries
- `inputs`: Inputs: {{items}}.
- `input_item`: {{label}}: {{value}}
- `input_barrels`: Barrels
- `input_type`: Brewery Type
- `input_locations`: Locations
- `input_kitchen`: Kitchen
- `input_distribution`: Distribution
- `input_employees`: Employees
- `value_barrels`: {{barrels}} ({{basis}})
- `value_type_assumed`: {{not_found}}, So an Assumed Generic Type Is Used
- `value_kitchen_unknown`: {{not_found}}, So No Food Revenue Is Added
