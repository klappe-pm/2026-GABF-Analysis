---
code: web/components/RuledTable.tsx
content:
  - global.tables.category_columns.category
  - global.tables.medal_columns.beer
  - global.tables.medal_columns.brewery
  - global.tables.pager.showing
  - global.tables.sorting.hint
name: ruled-table
related:
  - chart-frame
  - icon
  - medal-record
status: review
title: Ruled table
tokens:
  - font.family.narrow
  - font.weight.regular
  - layer.sticky
  - rule.hairline
  - rule.heavy
  - semantic.color.green-tint
  - semantic.color.ground-tone
  - semantic.color.ink
  - semantic.color.ink-faint
  - semantic.color.ink-muted
  - semantic.color.rule
  - space.0
  - space.1
  - space.2
  - space.3
  - space.4
  - type.data
  - type.label
version: 1.0.0
---

# Ruled table

## Purpose and when to use

The table every list of records uses: column rules, a heavy rule under a sticky header, tabular figures, and sortable headers. Use it for any data a reader will scan or compare.

## Anatomy

1. Caption, visually hidden, naming the table and giving the sort hint.
2. Header cells: narrow face, uppercase, ink muted, ground tone fill, heavy rule below.
3. First column cells are row headers.
4. Body cells: data type role, hairline rules between rows and columns.
5. Sort control: a button with a drawn mark inside a sortable header.
6. Scroll region: holds the table at the table size token so the header can stick.

## Variants

- Scrolling: a labelled, focusable region at a fixed height.
- Flowing: horizontal scroll only, used inside another component.
- Highlighted row: green tint fill for the row in focus.

## States

- Default.
- Row hover: ground tone fill.
- Sorted: aria-sort set to ascending or descending and the mark shows the direction.
- Focus: outline on the sort button and on the scroll region.

## Behavior and interaction

- Selecting a sortable header sorts descending first, then toggles.
- Rows with no value for the sort key sort last in both directions.
- The scroll region is reachable by keyboard.

## Accessibility

- Real table, caption, th with scope for columns and rows, aria-sort on the sorted column.
- Numeric columns are right aligned with tabular lining numerals.
- A gap is written as text such as Not published, never an empty cell.

## Content guidelines

- Column labels come from the tables content file.
- Medal columns read gold, silver, bronze in that order.

## Responsive behavior

- The table scrolls inside its region on narrow screens; the first column stays the row header.
- Header cells never wrap below two lines.

## Do and do not

- Do: Right align numbers.
- Do: State estimates with the (E) marker.
- Do not: zebra stripe.
- Do not: hide columns on phones; scroll instead.
