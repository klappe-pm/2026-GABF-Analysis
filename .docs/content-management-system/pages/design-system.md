# Design system

Design system: the living style guide. It shows every token and every component of the site, filled with real medal data.

## `page`

Where: top of the page.

- `title`: Design system
- `lede`: The Material 3 settings and components every page of GABF Analysis is built from, shown with real medal data.
- `spec_link`: Read the spec
- `source_link`: Settings and specs
- `nav_label`: Sections
- `settings_heading`: What you can change

## `sections`

Where: the section headers of the page, in order.

- `color`: Color
- `type`: Type
- `space`: Space
- `rules`: Rules, corners, and depth
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

- `h1`: Page title
- `h2`: Section header
- `h3`: Subsection
- `figure`: Field figure
- `lead`: Lede
- `body`: Body
- `data`: Table and control
- `label`: Field label
- `micro`: Field number and stamp

## `rule_names`

Where: the rules, corners, and depth table.

- `hairline`: Hairline rule
- `heavy`: Heavy rule
- `radius`: Corner radius
- `elevation`: Elevation
- `elevation_value`: Material's six levels
- `radius_value`: Material's corner scale

## `components`

Where: the heading of each component on the page.

- `form_header`: Form header
- `breadcrumb`: Breadcrumb
- `section_header`: Section header
- `form_field`: Form field
- `ruled_table`: Ruled table
- `medal_mark`: Medal mark
- `medal_record`: Medal record
- `range_scale`: Range scale
- `red_pen_note`: Red pen note
- `status_stamp`: Status stamp
- `filters_sheet`: Filters sheet
- `active_filters`: Active filters
- `button`: Button
- `text_link`: Link
- `select`: Select
- `checkbox`: Checkbox
- `search_field`: Search field
- `estimate_popover`: Estimate note
- `chart_frame`: Chart frame
- `form_note`: Form notes
- `icon`: Icons

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
- `current`: Current page
- `inside`: Inside the range
- `outside`: Outside the range
- `missing`: Not published
- `split`: Split
- `tally`: Tally
- `value`: Value

## `samples`

Where: captions that say where a component's sample data comes from.

- `category_index`: The first categories of {{year}}, from the official winners list.
- `medal_record`: {{brewery_name}}, {{city}}, {{state}}: medals in the complete years, {{year_range}}.
- `beer`: {{beer_name}}, {{brewery_name}}: {{medal}} in {{category_name}}, {{year}}.
- `chart_title`: Medals by state, {{year_range}}
- `chart_note`: The five states with the most medals in the complete years.
- `chart_label`: Line chart of medals per year for {{states}}, {{year_range}}.
- `finding`: {{category_name}}: {{value}} entries per medal in {{year}}, the longest odds of the year.

## `headings`

Where: the small headings inside the color section.

- `medals`: Medals
- `series`: Chart series

## `breakpoint_names`

Where: the name of each breakpoint in the breakpoints table.

- `sm`: Small
- `md`: Medium
- `lg`: Large
- `xl`: Extra large

## `type_samples`

Where: the sample text set in each type role.

- `h1`: Great American Beer Festival results
- `h2`: Medals by category
- `h3`: Category index
- `figure`: {{count}}
- `lead`: Every medal from {{first_year}} to {{last_year}}, linked and explained.
- `body`: Official winners lists win. Estimates are marked and traceable.
- `data`: West Coast-Style India Pale Ale
- `label`: Entries judged
- `micro`: 01 Partial


## `color_roles`

Where: the role names in the color tables.

- `ground`: Page ground
- `ground-tone`: Tinted ground
- `ink`: Ink
- `ink-muted`: Muted ink
- `ink-faint`: Secondary ink
- `on-ink`: Text on ink
- `rule`: Hairline rule
- `rule-strong`: Strong rule
- `green`: Judging green
- `green-tint`: Green tint
- `red`: Red pen
- `red-tint`: Red pen tint
- `focus`: Focus ring
- `selection`: Selection
- `gold`: Gold
- `silver`: Silver
- `bronze`: Bronze
- `medal-stroke`: Medal ring
- `medal-letter`: Medal letter
- `stamp`: Status stamp
- `series-1`: Graphite series
- `series-2`: Green series
- `series-3`: Iron gall series
- `series-4`: Sepia series
- `series-5`: Pencil series

## `groups`

Where: the group headings inside the color section.

- `text`: Text and ground
- `rules`: Rules and focus
- `accents`: Judging green and red pen
- `medals`: Medals
- `series`: Chart series
- `contrast`: Contrast
- `step`: Step {{number}}
- `breakpoint_note`: Columns are added from this width.

## `status`

Where: beside each component name, the stage its spec has reached.

- `label`: Status
- `draft`: Draft
- `review`: In review
- `approved`: Approved

## `scheme_groups`

Where: the group headings in the color section.

- `primary`: Primary
- `secondary`: Secondary
- `tertiary`: Tertiary
- `error`: Error
- `surfaces`: Surfaces
- `outlines`: Outlines and inverse
- `medals`: Medals
- `contrast`: Contrast

## `scheme_roles`

Where: the role names in the color tables and the contrast table.

- `primary`: Primary
- `on_primary`: On primary
- `primary_container`: Primary container
- `on_primary_container`: On primary container
- `secondary`: Secondary
- `on_secondary`: On secondary
- `secondary_container`: Secondary container
- `on_secondary_container`: On secondary container
- `tertiary`: Tertiary
- `on_tertiary`: On tertiary
- `tertiary_container`: Tertiary container
- `on_tertiary_container`: On tertiary container
- `error`: Error
- `on_error`: On error
- `error_container`: Error container
- `on_error_container`: On error container
- `surface`: Surface
- `surface_dim`: Surface dim
- `surface_bright`: Surface bright
- `surface_container_lowest`: Surface container lowest
- `surface_container_low`: Surface container low
- `surface_container`: Surface container
- `surface_container_high`: Surface container high
- `surface_container_highest`: Surface container highest
- `on_surface`: On surface
- `on_surface_variant`: On surface variant
- `outline`: Outline
- `outline_variant`: Outline variant
- `inverse_surface`: Inverse surface
- `inverse_on_surface`: Inverse on surface
- `inverse_primary`: Inverse primary
- `gold`: Gold medal
- `silver`: Silver medal
- `bronze`: Bronze medal

## `type_scale`

Where: the role names in the type scale table.

- `display_large`: Display large
- `display_medium`: Display medium
- `display_small`: Display small
- `headline_large`: Headline large
- `headline_medium`: Headline medium
- `headline_small`: Headline small
- `title_large`: Title large
- `title_medium`: Title medium
- `title_small`: Title small
- `body_large`: Body large
- `body_medium`: Body medium
- `body_small`: Body small
- `label_large`: Label large
- `label_medium`: Label medium
- `label_small`: Label small

## `shape_names`

Where: the steps of the corner scale in the shape table.

- `none`: None
- `extra_small`: Extra small
- `small`: Small
- `medium`: Medium
- `large`: Large
- `extra_large`: Extra large
- `full`: Full

## `elevation_levels`

Where: the name of each level in the elevation section.

- `level`: Level {{number}}
