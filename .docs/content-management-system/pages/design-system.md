# Design system

Design system: the living style guide. It shows every token and every component of the site, filled with real medal data.

## `page`

Where: top of the page.

- `title`: Design System
- `lede`: The Material 3 settings and components every page of GABF Analysis is built from, shown with real medal data.
- `spec_link`: GitHub: {{name}} Spec
- `source_link`: Settings and specs
- `nav_label`: Sections
- `options_heading`: {{name}} Options

## `sections`

Where: the section headers of the page, in order.

- `color`: Color
- `type`: Type
- `space`: Space
- `rules`: Rules, Corners, and Depth
- `breakpoints`: Breakpoints
- `components`: Components
- `settings`: Settings
- `shape`: Shape
- `elevation`: Elevation

## `section_notes`

Where: the line under each section header.

- `color`: Material generates every color from one seed color. Ratios are computed from the generated scheme each time the page loads: text needs 4.5 to 1, outlines and chart marks need 3 to 1.
- `medals`: Gold, silver, and bronze appear only on medals. Each mark carries an ink ring and its initial, so the metal is never the only cue.
- `series`: Charts that are not about medals draw in colors from the scheme. Each series also has its own mark.
- `type`: Material's type scale. Public Sans sets headings, body text, and every figure, with tabular lining numerals. Archivo Narrow sets short labels.
- `space`: One scale, in quarter rem steps, for every gap and inset.
- `rules`: Structure comes from Material's outlines, dividers, and surface tones.
- `breakpoints`: Layouts start at phone width and add columns at each breakpoint.
- `settings`: The settings every page reads when it loads. Change one and the whole site follows on the next reload.
- `shape`: Material's corner scale. Each component picks a step; the corner shape setting scales every step.
- `elevation`: Material's six elevation levels, each a shadow on a surface.
- `components`: Stock Material components, or components drawn from Material's color, type, and shape. Each lists what can change in its spec.

## `columns`

Where: the column headers of the token tables.

- `role`: Role
- `token`: Token
- `on`: On
- `ratio`: Ratio
- `needs`: Needs
- `result`: Result
- `pass`: Meets AA
- `fail`: Fails
- `value`: Value
- `sample`: Sample
- `family`: Family
- `use`: Use
- `size`: Size
- `width`: Width
- `setting`: Setting
- `line_height`: Line height
- `weight`: Weight
- `level`: Level
- `radius`: Corner

## `type_roles`

Where: the role names in the type scale table.

- `h1`: Page Title
- `h2`: Section Header
- `h3`: Subsection
- `figure`: Field Figure
- `lead`: Lede
- `body`: Body
- `data`: Table and Control
- `label`: Field Label
- `micro`: Field Number and Stamp

## `rule_names`

Where: the rules, corners, and depth table.

- `hairline`: Hairline Rule
- `heavy`: Heavy Rule
- `radius`: Corner Radius
- `elevation`: Elevation
- `elevation_value`: Material's six levels
- `radius_value`: Material's corner scale

## `components`

Where: the heading of each component on the page.

- `page_header`: Page Header
- `breadcrumb`: Breadcrumb
- `section_header`: Section Header
- `stat_card`: Stat Card
- `data_table`: Data Table
- `medal_mark`: Medal Mark
- `medal_record`: Medal Record
- `range_scale`: Range Scale
- `callout`: Callout
- `status_chip`: Status Chip
- `filters_dialog`: Filters Dialog
- `filter_chips`: Filter Chips
- `button`: Button
- `text_link`: Link
- `select`: Select
- `checkbox`: Checkbox
- `search_field`: Search Field
- `estimate_tooltip`: Estimate tooltip
- `chart_card`: Chart Card
- `state_card`: State Card
- `icon`: Icons
- `beer_profile_card`: Beer Profile Card
- `hop_profile_card`: Hop Profile Card
- `spec_card`: Spec Card
- `navigation_rail`: Navigation Rail
- `navigation_drawer`: Navigation Drawer

## `states`

Where: the labels under each component state.

- `default`: Default
- `hover`: Hover
- `focus`: Focus
- `active`: Pressed
- `disabled`: Disabled
- `busy`: Busy
- `error`: Error
- `checked`: Checked
- `open`: Open
- `current`: Current Page
- `inside`: Inside the Range
- `outside`: Outside the Range
- `missing`: Not Published
- `split`: Split
- `tally`: Tally
- `value`: Value

## `samples`

Where: captions that say where a component's sample data comes from.

- `category_index`: The first categories of {{year}}, from the official winners list.
- `medal_record`: {{brewery_name}}, {{city}}, {{state}}: medals in the complete years, {{year_range}}.
- `beer`: {{beer_name}}, {{brewery_name}}: {{medal}} in {{category_name}}, {{year}}.
- `chart_title`: Medals by State, {{year_range}}
- `chart_note`: The five states with the most medals in the complete years.
- `chart_label`: Line chart of medals per year for {{states}}, {{year_range}}.
- `preset_line`: Line
- `preset_bar`: Bar
- `preset_stacked_bar`: Stacked Bar
- `preset_horizontal_bar`: Horizontal Bar
- `preset_stacked_horizontal_bar`: Stacked Horizontal Bar
- `preset_lollipop`: Lollipop
- `preset_treemap`: Treemap
- `preset_option`: Passthrough Option
- `chart_bar_title`: Medals by Year, {{year_range}}
- `chart_bar_note`: Gold, Silver and Bronze medals awarded in each complete year.
- `chart_bar_label`: Bar chart of Gold, Silver and Bronze medals per year, {{year_range}}.
- `chart_stacked_title`: Medals by Year and State, {{year_range}}
- `chart_stacked_note`: The five states with the most medals, stacked in each complete year.
- `chart_stacked_label`: Stacked bar chart of medals per year for {{states}}, {{year_range}}.
- `chart_horizontal_title`: Medals by State, Ranked
- `chart_horizontal_note`: The ten states with the most medals in the complete years, {{year_range}}.
- `chart_horizontal_label`: Horizontal bar chart of medals by state, {{year_range}}.
- `chart_horizontal_description`: {{state}} led with {{count}} medals.
- `chart_stacked_horizontal_title`: Medals by Brewery
- `chart_stacked_horizontal_note`: The eight breweries with the most points in the complete years, stacked by medal.
- `chart_stacked_horizontal_label`: Stacked horizontal bar chart of Gold, Silver and Bronze medals for the eight breweries with the most points, {{year_range}}.
- `chart_lollipop_title`: Entries by Category
- `chart_lollipop_note`: The ten categories with the most entries in {{year}}.
- `chart_lollipop_label`: Lollipop chart of entries in the ten largest categories, {{year}}.
- `chart_treemap_title`: Medal Share by State
- `chart_treemap_note`: The fourteen states with the most medals in the complete years, sized by medals.
- `chart_treemap_label`: Treemap of medals by state, {{year_range}}.
- `chart_passthrough_title`: Medals per Year
- `chart_passthrough_note`: A full chart option passed through, with the table rows and columns supplied by the page.
- `chart_passthrough_label`: Bar chart of all medals per year, {{year_range}}.
- `finding`: {{category_name}}: {{value}} entries per medal in {{year}}, the longest odds of the year.
- `beer_card`: {{beer_name}}, from its published 2026 winner profile.
- `hop_card`: {{variety}}, from the hop farm tables and the 2026 winner profiles.
- `hop_card_gap`: The hop variety table is not in the record yet, so origin, breeder, ranges, aroma, and acreage read Not Found.

## `headings`

Where: the small headings inside the color section.

- `medals`: Medals
- `series`: Chart Series

## `breakpoint_names`

Where: the name of each breakpoint in the breakpoints table.

- `sm`: Small
- `md`: Medium
- `lg`: Large
- `xl`: Extra Large

## `type_samples`

Where: the sample text set in each type role.

- `h1`: Great American Beer Festival Results
- `h2`: Medals by Category
- `h3`: Category Index
- `figure`: {{count}}
- `lead`: Every medal from {{first_year}} to {{last_year}}, linked and explained.
- `body`: Official winners lists win. Estimates are marked and traceable.
- `data`: West Coast-Style India Pale Ale
- `label`: Entries Judged
- `micro`: 01 Partial


## `color_roles`

Where: the role names in the color tables.

- `ground`: Page Ground
- `ground-tone`: Tinted Ground
- `ink`: Ink
- `ink-muted`: Muted Ink
- `ink-faint`: Secondary Ink
- `on-ink`: Text on Ink
- `rule`: Hairline Rule
- `rule-strong`: Strong Rule
- `green`: Judging Green
- `green-tint`: Green Tint
- `red`: Red Pen
- `red-tint`: Red Pen Tint
- `focus`: Focus Ring
- `selection`: Selection
- `gold`: Gold
- `silver`: Silver
- `bronze`: Bronze
- `medal-stroke`: Medal Ring
- `medal-letter`: Medal Letter
- `stamp`: Status Stamp
- `series-1`: Graphite Series
- `series-2`: Green Series
- `series-3`: Iron Gall Series
- `series-4`: Sepia Series
- `series-5`: Pencil Series

## `groups`

Where: the group headings inside the color section.

- `text`: Text and Ground
- `rules`: Rules and Focus
- `accents`: Judging Green and Red Pen
- `medals`: Medals
- `series`: Chart Series
- `contrast`: Contrast
- `step`: Step {{number}}
- `breakpoint_note`: Columns are added from this width.

## `status`

Where: beside each component name, the stage its spec has reached.

- `label`: Status
- `draft`: Draft
- `review`: In Review
- `approved`: Approved

## `scheme_groups`

Where: the group headings in the color section.

- `primary`: Primary
- `secondary`: Secondary
- `tertiary`: Tertiary
- `error`: Error
- `surfaces`: Surfaces
- `outlines`: Outlines and Inverse
- `medals`: Medals
- `contrast`: Contrast

## `scheme_roles`

Where: the role names in the color tables and the contrast table.

- `primary`: Primary
- `on_primary`: On Primary
- `primary_container`: Primary Container
- `on_primary_container`: On Primary Container
- `secondary`: Secondary
- `on_secondary`: On Secondary
- `secondary_container`: Secondary Container
- `on_secondary_container`: On Secondary Container
- `tertiary`: Tertiary
- `on_tertiary`: On Tertiary
- `tertiary_container`: Tertiary Container
- `on_tertiary_container`: On Tertiary Container
- `error`: Error
- `on_error`: On error
- `error_container`: Error container
- `on_error_container`: On error container
- `background`: Page Background
- `on_background`: On Page Background
- `surface`: Surface
- `surface_dim`: Surface Dim
- `surface_bright`: Surface Bright
- `surface_container_lowest`: Surface Container Lowest
- `surface_container_low`: Surface Container Low
- `surface_container`: Surface Container
- `surface_container_high`: Surface Container High
- `surface_container_highest`: Surface Container Highest
- `on_surface`: On Surface
- `on_surface_variant`: On surface variant
- `outline`: Outline
- `outline_variant`: Outline variant
- `inverse_surface`: Inverse Surface
- `inverse_on_surface`: Inverse on Surface
- `inverse_primary`: Inverse Primary
- `gold`: Gold Medal
- `silver`: Silver Medal
- `bronze`: Bronze Medal

## `type_scale`

Where: the role names in the type scale table.

- `display_large`: Display Large
- `display_medium`: Display Medium
- `display_small`: Display Small
- `headline_large`: Headline Large
- `headline_medium`: Headline Medium
- `headline_small`: Headline Small
- `title_large`: Title Large
- `title_medium`: Title Medium
- `title_small`: Title Small
- `body_large`: Body large
- `body_medium`: Body medium
- `body_small`: Body small
- `label_large`: Label Large
- `label_medium`: Label Medium
- `label_small`: Label Small

## `shape_names`

Where: the steps of the corner scale in the shape table.

- `none`: None
- `extra_small`: Extra Small
- `small`: Small
- `medium`: Medium
- `large`: Large
- `extra_large`: Extra Large
- `full`: Full

## `elevation_levels`

Where: the name of each level in the elevation section.

- `level`: Level {{number}}

## `profile_cards`

Where: the labels and links on the beer profile card and the hop profile card.

- `brewery_line`: {{brewery_name}}, {{city}}, {{state}}
- `category`: Category
- `abv`: ABV
- `ibu`: IBU
- `style`: Style
- `hops`: Hops
- `note`: From the brewery's description
- `source`: Source: {{site}}
- `deep_dive`: Read the Full Beer Profile
- `origin`: Origin
- `breeder`: Breeder
- `alpha`: Alpha Acids
- `oil`: Total Oil
- `range_percent`: {{min}} to {{max}}%
- `oil_range`: {{min}} to {{max}} mL per 100 g
- `acreage`: US Acreage
- `acreage_value`: {{acres}} acres in {{year}}, {{share}} of all US hop acres
- `acreage_value_no_share`: {{acres}} Acres in {{year}}
- `acreage_withheld`: {{states}} not disclosed by NASS that year.
- `medal_beers`: 2026 Medal Beers
- `aroma`: Aroma
- `farms`: Grower Farms
- `farms_more`: and {{count}} more
- `farm_line`: {{farm_name}}, {{state}}

## `icon_labels`

Where: the name under each icon in the icons specimen.

- `close`: Close
- `chevron-down`: Chevron
- `search`: Search
- `check`: Check
- `menu`: Menu
- `filter`: Filter
- `sort`: Sort
- `sort-ascending`: Sort Ascending
- `sort-descending`: Sort Descending
- `tune`: Settings
- `palette`: Color
- `type`: Type
- `shape`: Shape
- `layers`: Elevation
- `widgets`: Components
- `medal`: Results
- `brewery`: Breweries
- `beer`: Beers
- `chart`: Analysis
- `list`: Categories
- `hop`: Hops
- `farm`: Hop Farms

## `review_panel`

Where: the review settings panel, shown only in the local review build.

- `page_settings`: Page Settings
- `close`: Close
- `close_page_settings`: Close Page Settings
- `intro`: A change shows on the page at once. Save writes the setting to its file and files an accepted ticket in {{folder}}.
- `intro_folder`: this page's folder in docs/feedback/
- `site_settings`: Site Settings
- `components_on_page`: Components on This Page
- `no_components`: No design system components were found on this page.
- `count_on_page`: ({{count}} on This Page)
- `spec`: Spec: {{path}}
- `settings`: Settings
- `no_settings`: No settings yet: this component gains settings when it moves to Material.
- `show_on_page`: Show on the Page

## `ranges`

Where: the year span in the specimen captions and chart titles.

- `year_range`: {{first_year}} to {{last_year}}
