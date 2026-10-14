---
code: web/components/FormNote.tsx
content:
  - global.states.empty_scope.page
  - global.states.errors.data_load
  - global.states.loading.data
  - global.states.no_results.remove_hint
  - global.states.no_results.title
name: form-note
related:
  - button
  - status-stamp
title: Form notes
tokens:
  - font.family.narrow
  - font.weight.semibold
  - rule.hairline
  - semantic.color.ground-tone
  - semantic.color.ink-muted
  - semantic.color.red
  - semantic.color.red-tint
  - semantic.color.rule
  - size.measure
  - space.1
  - space.2
  - space.3
  - space.4
  - type.body
  - type.data
  - type.label
version: 1.0.0
---

# Form notes

## Purpose and when to use

Empty, loading, error, and notice states written as notes on the form, in place of the view they replace.

## Anatomy

1. Frame: a hairline box; red boundary and tint for an error; a red left rule for a notice.
2. Optional stamp.
3. Title in semibold body text.
4. Optional explanation in ink muted.
5. Optional action.
6. Loading: label and four ruled placeholder lines.

## Variants

- Empty.
- Loading.
- Error.
- Notice.

## States

- Loading pulses opacity lightly; reduced motion stops it.

## Behavior and interaction

- Error uses the alert role; the others use status.
- An empty note tells the reader how to get results back.

## Accessibility

- Roles announce the state.
- The error does not rely on color: the title states the problem.
- Red on red tint meets 4.5 to 1.

## Content guidelines

- Say what happened and what to do next, in two sentences or fewer.
- Copy comes from the states content file.

## Responsive behavior

- Full width of its container.

## Do and do not

- Do: Offer the one action that fixes the state.
- Do not: apologize or add illustrations.
