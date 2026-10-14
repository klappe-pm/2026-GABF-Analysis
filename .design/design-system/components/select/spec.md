---
code: web/components/Select.tsx
content:
  - global.filters.groups.when
name: select
related:
  - form-field
  - icon
status: review
title: Select
tokens:
  - rule.hairline
  - semantic.color.ground
  - semantic.color.ground-tone
  - semantic.color.ink
  - semantic.color.ink-faint
  - semantic.color.ink-muted
  - semantic.color.rule
  - semantic.color.rule-strong
  - space.2
  - space.3
  - space.6
  - type.data
version: 1.0.0
---

# Select

## Purpose and when to use

A native select drawn as a ruled box with a drawn chevron. It is native, so keyboard and screen reader behavior is the platform behavior.

## Anatomy

1. Numbered field with label.
2. Select box: strong rule boundary, ground fill.
3. Chevron mark at the right edge, hidden from assistive technology.

## Variants

- Default.
- With a disabled option.

## States

- Default.
- Hover: boundary darkens to ink.
- Focus: outline.
- Disabled: ground tone fill, ink faint text.

## Behavior and interaction

- The platform picker opens on activation.
- The value is a form value named by the control id.

## Accessibility

- A real label for the control.
- The strong rule boundary meets 3 to 1 on ground.

## Content guidelines

- Options are plain words or numbers; the first option is the all option.

## Responsive behavior

- Fills its field width.

## Do and do not

- Do: Use for six or more options.
- Do not: replace it with a custom listbox.
