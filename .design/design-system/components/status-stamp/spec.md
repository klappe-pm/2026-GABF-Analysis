---
code: web/components/StatusStamp.tsx
content:
  - global.labels.coverage_meaning.partial
  - global.labels.coverage.draft
  - global.labels.coverage.partial
  - global.labels.coverage.pending
  - global.states.estimates.short
name: status-stamp
related:
  - estimate-popover
  - form-note
status: review
title: Status stamp
tokens:
  - font.family.narrow
  - font.line-height.snug
  - rule.heavy
  - semantic.color.stamp
  - space.0
  - space.2
  - type.micro
version: 1.0.0
---

# Status stamp

## Purpose and when to use

A data status set the way a clerk stamps a form: red pen, a heavy ruled box, uppercase narrow letters. Use it for data status only: Partial, Not loaded, Draft, Estimate. Never for categories or tags.

## Anatomy

1. Heavy box in the stamp color.
2. Label in the micro type role, uppercase.
3. Visually hidden meaning after the label.

## Variants

- Partial.
- Not loaded.
- Draft.
- Estimate.

## States

- Static.

## Behavior and interaction

- The meaning shows as a tooltip title and is read by assistive technology.

## Accessibility

- Stamp color on ground meets 4.5 to 1.
- The visible word carries the status; the meaning is announced after it.

## Content guidelines

- Labels and meanings come from the labels content file.

## Responsive behavior

- Inline; does not wrap.

## Do and do not

- Do: Place the stamp beside the figure or year it qualifies.
- Do not: use a stamp as a filter chip or a tag.
- Do not: round it into a pill.
