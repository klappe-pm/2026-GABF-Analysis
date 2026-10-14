---
code: web/components/Checkbox.tsx
content:
  - global.states.no_results.include_partial
name: checkbox
related:
  - form-field
  - icon
status: review
title: Checkbox
tokens:
  - rule.hairline
  - semantic.color.ground
  - semantic.color.ground-tone
  - semantic.color.ink
  - semantic.color.ink-faint
  - semantic.color.ink-muted
  - semantic.color.on-ink
  - semantic.color.rule
  - semantic.color.rule-strong
  - space.0
  - space.1
  - space.2
  - space.4
  - type.data
version: 1.0.0
---

# Checkbox

## Purpose and when to use

A square ruled box, like the tick boxes on a scoresheet. The check is drawn; the input stays native.

## Anatomy

1. Box: strong rule boundary, ground fill.
2. Check mark in on ink on an ink fill when checked.
3. Label and optional hint.

## Variants

- With a hint.
- Without a hint.

## States

- Unchecked.
- Checked: ink fill.
- Hover: boundary darkens.
- Focus: outline.
- Disabled: ground tone fill.

## Behavior and interaction

- The label is part of the target.

## Accessibility

- Native checkbox with a label; the hint is tied through aria-describedby.
- The checked state differs by fill and by the drawn mark, not by color alone.

## Content guidelines

- The label states the option that is on when checked.

## Responsive behavior

- Label wraps beside the box.

## Do and do not

- Do: Use for an independent on or off choice.
- Do not: use a checkbox for a choice among several; use a select.
