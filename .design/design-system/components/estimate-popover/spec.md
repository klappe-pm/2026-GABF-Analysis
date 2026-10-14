---
code: web/components/EstimatePopover.tsx
content:
  - global.states.estimates.explanation
  - global.states.estimates.marker
name: estimate-popover
related:
  - status-stamp
  - text-link
status: review
title: Estimate note
tokens:
  - font.family.narrow
  - rule.hairline
  - semantic.color.ground
  - semantic.color.ink
  - semantic.color.red
  - semantic.color.red-tint
  - size.measure
  - space.1
  - space.2
  - space.3
  - type.data
  - type.label
version: 1.0.0
---

# Estimate note

## Purpose and when to use

The (E) beside an estimated figure. It is a button that opens a note explaining the estimate, using the native popover.

## Anatomy

1. Marker: a dotted underlined button in red.
2. Note: a ruled box in red pen with the explanation and a link to the method.

## Variants

- Single variant.

## States

- Closed.
- Open.
- Hover: red tint behind the marker.
- Focus: outline.

## Behavior and interaction

- Light dismiss and Escape close the note; focus returns to the marker.
- The note anchors under the marker where anchor positioning exists.

## Accessibility

- Button with an accessible label; the note has a note role.
- Red on ground meets 4.5 to 1.

## Content guidelines

- Every estimated figure carries the marker and links to how it was made.

## Responsive behavior

- The note is capped at the measure token and flips to stay on screen.

## Do and do not

- Do: Mark every estimate.
- Do not: present an estimate without the marker.
