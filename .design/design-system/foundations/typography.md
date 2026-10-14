---
name: typography
title: Typography
tokens:
  - font.*
  - type.*
version: 1.0.0
---

# Typography

## Purpose

Two faces set the whole system. Public Sans carries tabular lining numerals, so every figure is set in it. The narrow face has no tabular figures (measured in the built page: "1111" is narrower than "0000"), so it never sets numbers.

## Faces

- Public Sans sets the interface, headings, body, and figures.
- Archivo Narrow sets field labels, table headers, stamps, and field numbers.

## Roles

- Page title, section header, subsection, field figure, lede, body, table and control text, field label, field number and stamp.
- Each role is one typography token that sets family, size, weight, line height, and tracking together.

## Rules

- Uppercase is for labels in the narrow face only.
- Prose measure is capped at the measure token.
- Numbers use tabular lining numerals in Public Sans, including field numbers, years in column headers, scale labels, and counts. The narrow face is for letters only; the audit fails on figures set in it.

## Do and do not

- Use the roles, not loose sizes.
- Never set a face outside the two families.
