---
name: rules-and-borders
status: review
title: Rules and borders
tokens:
  - radius.*
  - rule.*
  - semantic.color.rule
  - semantic.color.rule-strong
version: 1.0.0
---

# Rules and borders

## Purpose

Structure comes from rules, not from boxes with shadow or rounded corners. A hairline divides; a heavy rule closes a header.

## Widths

- Hairline, one pixel: table cells, field boxes, section rules.
- Heavy, two pixels: under a form header, over a table header, around the Filters sheet.

## Colors

- Rule for decorative structure.
- Rule strong for the boundary of any control, so it meets 3 to 1.

## Corners

Every corner is square. The radius token is zero and is the only radius. Medals are round objects drawn as a flat disc, the one circle in the system.

## Do and do not

- Use rules to group.
- Never round a corner, make a pill, or use a chip shape.
