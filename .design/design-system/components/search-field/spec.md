---
code: web/components/SearchField.tsx
content:
  - global.filters.search.label
  - global.filters.search.placeholder
name: search-field
related:
  - filters-sheet
  - form-field
  - icon
status: review
title: Search field
tokens:
  - rule.hairline
  - semantic.color.ground
  - semantic.color.ground-tone
  - semantic.color.ink
  - semantic.color.ink-faint
  - semantic.color.ink-muted
  - space.2
  - space.3
  - space.6
  - type.body
version: 1.0.0
---

# Search field

## Purpose and when to use

The search field: a numbered field with a ruled input and a drawn search mark. It is field one of the Filters sheet and the primary action of the scoresheet.

## Anatomy

1. Numbered label.
2. Input with a search mark at the left.
3. Placeholder in ink faint.
4. Error line in red pen when present.

## Variants

- Default.
- With an error.

## States

- Default.
- Focus: outline.
- Error: red boundary, aria-invalid set.
- Disabled: ground tone fill.

## Behavior and interaction

- Searches beers, breweries, cities, and hops.

## Accessibility

- A real label; the placeholder is a hint, not the label.
- Search type input.
- Ink faint placeholder meets 4.5 to 1.

## Content guidelines

- The placeholder lists what can be found.

## Responsive behavior

- Fills its field width.

## Do and do not

- Do: Keep the label visible.
- Do not: hide the label behind the placeholder.
