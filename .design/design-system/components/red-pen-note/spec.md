---
code: web/components/RedPenNote.tsx
content:
  - pages.design-system.samples.beer
name: red-pen-note
related:
  - range-scale
  - status-stamp
  - text-link
title: Red pen note
tokens:
  - font.family.narrow
  - rule.hairline
  - semantic.color.red
  - size.measure
  - space.1
  - space.2
  - space.4
  - type.data
  - type.label
  - type.lead
version: 1.0.0
---

# Red pen note

## Purpose and when to use

A margin note in red pen: the finding a reviewer would write beside the form. Red pen is reserved for findings and annotations, so a page carries one or two at most.

## Anatomy

1. Label in the narrow face, uppercase, red.
2. Finding in the lead type role, red, stating a number.
3. Optional link in red.
4. Left rule in red.

## Variants

- With a link.
- Without a link.

## States

- Static; the link follows the link states.

## Behavior and interaction

- The note is an aside landmark labelled with its label text.

## Accessibility

- Red on ground meets 4.5 to 1.
- The label names the note, so meaning does not depend on color.

## Content guidelines

- State the finding, then the evidence, in one sentence with its number.
- Never write advice in red pen.

## Responsive behavior

- Capped at the measure token; sits beside the form on wide screens and under it on narrow screens.

## Do and do not

- Do: Trace every number to the data.
- Do not: use red pen for decoration, emphasis, or a call to action.
