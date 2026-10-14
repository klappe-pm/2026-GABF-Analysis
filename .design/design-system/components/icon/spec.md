---
code: web/components/Icon.tsx
content: []
name: icon
related:
  - button
  - checkbox
  - ruled-table
  - search-field
  - select
title: Icons
tokens:
  - space.4
version: 1.0.0
---

# Icons

## Purpose and when to use

Authored icons drawn on a sixteen unit grid with one stroke weight, square caps, and mitred joins, like marks made with a ruling pen. They inherit the text color.

## Anatomy

1. Eight marks: close, chevron down, search, check, menu, sort, sort ascending, sort descending.
2. Stroke 1.5 units, square caps, mitred joins, no fill.

## Variants

- Sizes by class; the default is the base square size.

## States

- Static; the color follows the text it sits in.

## Behavior and interaction

- Icons are decoration unless given a label.

## Accessibility

- Hidden from assistive technology by default; an icon alone in a control gets the label on the control.

## Content guidelines

- Never use an icon without a text label unless the mark is universal (close, search).

## Responsive behavior

- Fixed size.

## Do and do not

- Do: Draw new marks on the same grid and weight.
- Do not: use rounded caps or filled shapes.
