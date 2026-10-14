---
code: web/components/FormField.tsx
content:
  - pages.design-system.samples.category_index
name: form-field
related:
  - checkbox
  - range-scale
  - search-field
  - select
status: review
title: Form field
tokens:
  - breakpoint.lg
  - breakpoint.sm
  - font.family.narrow
  - font.family.sans
  - font.weight.medium
  - rule.hairline
  - semantic.color.green
  - semantic.color.ink-muted
  - semantic.color.red
  - semantic.color.rule
  - space.2
  - space.3
  - type.data
  - type.figure
  - type.label
  - type.lead
  - type.micro
version: 1.0.0
---

# Form field

## Purpose and when to use

A numbered form field: a ruled box with its number in judging green, its label in the narrow face, and its value or control below. It is the unit of the scoresheet header and of the Filters sheet. A field either shows a recorded value or holds a control.

## Anatomy

1. Field number in the micro type role, set in Public Sans, judging green, hidden from assistive technology.
2. Label in the narrow face, uppercase, ink muted. For a control the label is a real label element.
3. Value in the figure type role (recorded value) or the control below.
4. Optional note in ink muted.
5. Hint and error lines for a control. The error is in red pen.
6. Grid: fields share hairlines through the field grid, which is a description list.

## Variants

- Recorded value, figure size.
- Recorded value, text size.
- Control field wrapping a select, search field, or checkbox.
- Wide: spans two columns from the sm breakpoint.

## States

- Default.
- Error: the error line appears in red pen and the control gains a red boundary.
- Disabled: label and value in ink faint (control fields).

## Behavior and interaction

- A recorded value field is read only.
- A control field associates its hint and error with the control through aria-describedby.
- Figures use tabular lining numerals so columns of fields align.

## Accessibility

- The field grid is a description list: each label is a term and each value a description.
- Labels are programmatically tied to controls.
- Error text is not color alone: it is a sentence that names the problem.
- Ink muted on ground meets 4.5 to 1.

## Content guidelines

- Labels are nouns, for example Entries judged, never questions.
- A figure shows one number; units go in the label or the note.

## Responsive behavior

- One column below the sm breakpoint, two from sm, four from lg for the scoresheet header.

## Do and do not

- Do: Number fields in reading order.
- Do not: put four or more figure fields in a row of equal tiles with no labels; each needs its label and rules.
