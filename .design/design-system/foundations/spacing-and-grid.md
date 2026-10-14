---
name: spacing-and-grid
status: review
title: Spacing and grid
tokens:
  - breakpoint.*
  - size.*
  - space.*
version: 1.0.0
---

# Spacing and grid

## Purpose

One scale in quarter rem steps, from zero to four rem, spaces every gap and inset. Layouts start at phone width and add columns at each breakpoint.

## Scale

Steps zero to eight: 0, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, and 4 rem. Components take their gaps and padding from this scale and nowhere else.

## Grid

- Pages are capped at the page size token and centered with a space four gutter.
- The scoresheet header is a field grid: one column on phones, two from sm, four from lg, with hairlines shared between boxes.
- Prose never exceeds the measure token.

## Breakpoints

Small, medium, large, and extra large at 40, 48, 64, and 80 rem. Design for the narrowest width first.

## Do and do not

- Use scale steps only.
- Never scroll the page horizontally; tables scroll inside their own region.
