---
code: web/components/Button.tsx
content:
  - global.filters.panel.apply
  - global.filters.panel.reset
name: button
related:
  - icon
  - text-link
status: review
title: Button
tokens:
  - duration.quick
  - font.family.sans
  - font.weight.semibold
  - rule.hairline
  - semantic.color.green-tint
  - semantic.color.ground
  - semantic.color.ground-tone
  - semantic.color.ink
  - semantic.color.ink-faint
  - semantic.color.ink-muted
  - semantic.color.on-ink
  - semantic.color.rule
  - semantic.color.rule-strong
  - space.2
  - space.4
  - space.6
  - type.data
version: 1.0.0
---

# Button

## Purpose and when to use

A form control that performs an action. Square, ruled, labelled with the action it performs. Use a link for navigation and a button for an action.

## Anatomy

1. Box: hairline border, padding at the space scale.
2. Label in the data type role, semibold.
3. Busy label replaces the label while an action runs.

## Variants

- Primary: ink fill with on ink text.
- Secondary: ground fill, strong rule.
- Quiet: no box, underlined text.

## States

- Default.
- Hover: a tone change.
- Pressed (secondary): green tint.
- Disabled: ink faint text, no pointer.
- Busy: aria-busy set and the control disabled.
- Focus: outline.

## Behavior and interaction

- Disabled and busy buttons do not submit.
- Color change is quick, and is removed for reduced motion.

## Accessibility

- Native button element.
- Minimum target height of the min height token for a button.
- On ink on ink meets 4.5 to 1; ink faint on the disabled fill is exempt as disabled text.

## Content guidelines

- Labels are verbs, for example Show results.
- Busy labels say what is happening.

## Responsive behavior

- Content width; stacks with a gap when a row is full.

## Do and do not

- Do: Use one primary button per view.
- Do not: round the box, add a shadow, or use a gradient fill.
