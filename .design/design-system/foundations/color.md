---
name: color
status: review
title: Color
tokens:
  - color.*
  - semantic.color.*
version: 1.0.0
---

# Color

## Purpose

Color has four jobs: ground and ink for reading, judging green for structure, red pen for findings and status, and metals for medals. Everything else is tone.

## Roles

- Ground and ground tone: form stock and the bands on it.
- Ink, ink muted, ink faint: text from strongest to placeholder.
- Rule and rule strong: structure and control boundaries.
- Green and green tint: section headers, field numbers, current navigation, selected rows.
- Red, red tint, stamp: findings, errors, status stamps. Nothing else.
- Focus and selection.
- Gold, silver, bronze, medal stroke, medal letter: medals only.
- Series one to five: graphite, judging green, iron gall, sepia, pencil, for charts that are not about medals.

## Contrast

Each text role declares its minimum contrast in the token file: 4.5 to 1 for text, 3 to 1 for control boundaries, focus, and chart series. The check fails the build when a role does not meet its minimum.

## Do and do not

- Use red for findings, errors, and stamps only.
- Never use a metal color outside a medal.
- Never use the default palette of a charting library.
- Never convey meaning by color alone.
