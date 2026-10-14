---
code: web/components/FiltersSheet.tsx
content:
  - global.filters.groups.when
  - global.filters.panel.apply
  - global.filters.panel.close
  - global.filters.panel.reset
  - global.filters.panel.title
  - global.filters.search.label
  - global.filters.search.placeholder
  - global.filters.trigger.accessible_label_with_count
  - global.filters.trigger.label
  - global.filters.trigger.label_with_count
name: filters-sheet
related:
  - active-filters
  - button
  - checkbox
  - icon
  - search-field
  - select
title: Filters sheet
tokens:
  - breakpoint.sm
  - font.family.narrow
  - font.weight.semibold
  - rule.hairline
  - rule.heavy
  - semantic.color.green
  - semantic.color.ground
  - semantic.color.ground-tone
  - semantic.color.ink
  - semantic.color.rule-strong
  - space.1
  - space.2
  - space.3
  - space.4
  - space.5
  - space.6
  - type.data
  - type.h3
  - type.label
version: 1.0.0
---

# Filters sheet

## Purpose and when to use

The one global Filters control: a trigger in the header and a sheet holding a search field and the When, What, Where, and Who groups as ruled sections of numbered fields. One filter applies to every view.

## Anatomy

1. Trigger button with the active count.
2. Sheet: a modal dialog with a heavy ruled frame.
3. Title bar with a Close control.
4. Search field, numbered.
5. Four groups, each a fieldset with a green legend and numbered selects; the When group also holds the partial years checkbox.
6. Footer: match count, Clear all, Show results.

## Variants

- Bottom sheet below the md breakpoint.
- Panel under the header from the md breakpoint, at the sheet size token.

## States

- Closed.
- Open.
- Active: the trigger shows how many filters apply.
- Match count updates as fields change.

## Behavior and interaction

- Pressing F opens the sheet unless focus is in a text control; Escape closes it.
- The sheet is a modal dialog: focus stays inside until it closes, and returns to the trigger.
- Choosing the backdrop closes it.

## Accessibility

- Native dialog with a labelled title.
- Trigger has aria-haspopup set to dialog and an accessible label that includes the count.
- The match count is a status region.
- Every control is operable by keyboard.

## Content guidelines

- All text comes from the filters content file.
- Group names are single words: When, What, Where, Who.

## Responsive behavior

- Bottom sheet at most ninety percent of the viewport height on phones; the body scrolls inside.

## Do and do not

- Do: Keep the same filter state in the URL.
- Do not: add a second filter control to any page.
