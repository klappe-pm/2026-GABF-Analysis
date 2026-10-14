---
code: web/components/ActiveFilters.tsx
content:
  - global.filters.panel.reset
name: active-filters
related:
  - filters-sheet
  - icon
title: Active filters
tokens:
  - font.family.narrow
  - rule.hairline
  - semantic.color.ground-tone
  - semantic.color.ink
  - semantic.color.ink-muted
  - semantic.color.rule-strong
  - space.1
  - space.2
  - type.data
  - type.label
version: 1.0.0
---

# Active filters

## Purpose and when to use

The filters in effect, written as ruled entries on a line, each with its own remove box, followed by a clear control. They are square boxes, never pills.

## Anatomy

1. Label in the narrow face.
2. Entries: a ruled box with the filter text and a remove button.
3. Fixed entry: a scope set by the page, ground tone, no remove button.
4. Clear control: underlined text.

## Variants

- Removable entry.
- Fixed entry with an explanatory title.

## States

- Default.
- Hover on the remove button: ground tone fill.
- Focus: outline.

## Behavior and interaction

- Removing an entry updates the filter and the URL.
- Entries wrap to further lines.

## Accessibility

- A labelled section containing a list.
- Each remove button has a label that names the filter it removes.

## Content guidelines

- Each entry reads as the filter, for example Year: 2026.

## Responsive behavior

- Wraps; never scrolls horizontally.

## Do and do not

- Do: Show fixed page scope so a reader knows why a count is small.
- Do not: style entries as rounded chips.
