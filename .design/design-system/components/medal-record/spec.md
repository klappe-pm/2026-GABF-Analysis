---
code: web/components/MedalRecord.tsx
content:
  - global.labels.medal.Bronze
  - global.labels.medal.Gold
  - global.labels.medal.Silver
  - pages.design-system.states.split
  - pages.design-system.states.tally
  - pages.design-system.states.value
name: medal-record
related:
  - medal-mark
  - ruled-table
title: Medal record
tokens:
  - font.family.narrow
  - font.family.sans
  - font.weight.semibold
  - semantic.color.ink-faint
  - semantic.color.ink-muted
  - space.1
  - space.3
  - type.data
  - type.micro
version: 1.0.0
---

# Medal record

## Purpose and when to use

The gold, silver, bronze record of a brewery or category written as one value, always in the order gold, silver, bronze. Use it wherever a count of medals is shown.

## Anatomy

1. Medal marks, one per type or one per medal won.
2. Counts in semibold tabular numerals.
3. Overflow count after twelve marks in a tally row.
4. Spoken label that reads all three counts.

## Variants

- Split: one mark per medal type with its count.
- Tally: one mark per medal won, a row per type, capped at twelve with a plus count.
- Value: plain text, for example 3 / 2 / 1.

## States

- Static.

## Behavior and interaction

- Zero counts are written as 0, never omitted.

## Accessibility

- The whole record has one label, for example 3 gold, 2 silver, 1 bronze; the marks inside are hidden from assistive technology.
- Counts and letters carry the meaning without color.

## Content guidelines

- The slash separated value uses spaces around the slashes.

## Responsive behavior

- The tally stacks three rows at every width.

## Do and do not

- Do: Use the same order everywhere.
- Do not: reorder by who won more.
