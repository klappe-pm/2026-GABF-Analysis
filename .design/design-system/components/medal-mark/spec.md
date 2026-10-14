---
code: web/components/MedalMark.tsx
content:
  - global.labels.medal.Bronze
  - global.labels.medal.Gold
  - global.labels.medal.Silver
name: medal-mark
related:
  - medal-record
status: review
title: Medal mark
tokens:
  - font.family.narrow
  - font.weight.bold
  - semantic.color.bronze
  - semantic.color.gold
  - semantic.color.medal-letter
  - semantic.color.medal-stroke
  - semantic.color.silver
  - space.4
  - space.5
version: 1.0.0
---

# Medal mark

## Purpose and when to use

A medal drawn as a flat round mark: metal fill, a one pixel ring in ink, and the medal initial. The metal colors appear only here and in charts that plot medals.

## Anatomy

1. Disc: flat fill in the gold, silver, or bronze color role.
2. Ring: one pixel stroke in the medal stroke color, non scaling.
3. Letter: G, S, or B in the narrow face, bold, in the medal letter color.

## Variants

- Medium and small sizes.
- With or without the letter; without it only inside a tally where the row names the metal.

## States

- Static.

## Behavior and interaction

- A mark is never interactive on its own.

## Accessibility

- An image role with the medal name as its label.
- The ring and the letter carry the meaning, so the metal color is supplementary.
- The letter meets 4.5 to 1 on each metal; the ring meets 3 to 1 on the ground.

## Content guidelines

- The label is the medal name from the labels content file.

## Responsive behavior

- Fixed sizes; they do not scale with the viewport.

## Do and do not

- Do: Keep the fill flat.
- Do not: add gradient, highlight, bevel, ribbon, or shine.
- Do not: use gold, silver, or bronze for anything that is not a medal.
