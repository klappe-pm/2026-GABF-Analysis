---
code: web/components/TextLink.tsx
content:
  - global.navigation.footer.method
name: text-link
related:
  - button
  - red-pen-note
status: review
title: Link
tokens:
  - duration.quick
  - semantic.color.ink
  - semantic.color.red
  - semantic.color.rule-strong
version: 1.0.0
---

# Link

## Purpose and when to use

A link reads as a link: underlined, in the text own ink. Red only inside a red pen note.

## Anatomy

1. Underlined text in ink with a strong rule underline.

## Variants

- Ink.
- Red, inside a red pen note only.

## States

- Default.
- Hover: the underline darkens or thickens.
- Focus: outline.

## Behavior and interaction

- Links navigate; actions use buttons.

## Accessibility

- Native anchor.
- Never rely on color alone: the underline is always present.

## Content guidelines

- Link text names the destination.
- Never write click here.

## Responsive behavior

- Inline with text.

## Do and do not

- Do: Underline every link in running text.
- Do not: remove the underline on hover.
