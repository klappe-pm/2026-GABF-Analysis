---
code: web/components/ChartFrame.tsx
content:
  - global.charts.table_view.summary
  - pages.design-system.samples.chart_label
  - pages.design-system.samples.chart_note
  - pages.design-system.samples.chart_title
name: chart-frame
related:
  - medal-mark
  - ruled-table
title: Chart frame
tokens:
  - font.family.narrow
  - rule.hairline
  - semantic.color.ground-tone
  - semantic.color.ink
  - semantic.color.ink-muted
  - semantic.color.rule
  - semantic.color.series-1
  - semantic.color.series-2
  - semantic.color.series-3
  - semantic.color.series-4
  - semantic.color.series-5
  - size.chart
  - space.1
  - space.2
  - space.3
  - space.4
  - type.data
  - type.h3
  - type.label
version: 1.0.0
---

# Chart frame

## Purpose and when to use

A chart in a ruled frame: title, legend of drawn marks, the plot, and a table view of the same numbers. Apache ECharts draws the plot with the design system theme.

## Anatomy

1. Figure with a caption: title, optional note, legend.
2. Legend: each series has its own drawn mark and name.
3. Plot area at the chart size token.
4. Table view: a details control that opens a ruled table of the same numbers.

## Variants

- Line chart with up to five series.

## States

- Default.
- Hover: the tooltip shows the series values.
- Table view open.
- Focus: outline on the table view control.

## Behavior and interaction

- The chart redraws when the theme changes or the window resizes.
- No animation.
- Gridlines are rules; there is no shadow in tooltips.

## Accessibility

- The plot has an image role with a text label that states what it shows.
- Every chart has a table alternative.
- Series differ by mark shape and by color; the five series colors meet 3 to 1 on ground.

## Content guidelines

- The title states the measure and the span, for example Medals by state, 2021 to 2026.
- The note states the selection rule.

## Responsive behavior

- Fills the container width at a fixed plot height.

## Do and do not

- Do: Use series colors from the chart series tokens, in order.
- Do not: use the default chart library palette.
- Do not: use gold, silver, or bronze for a series unless it plots a medal.
