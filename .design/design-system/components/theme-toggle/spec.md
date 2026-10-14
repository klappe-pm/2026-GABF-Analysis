---
code: web/components/ThemeToggle.tsx
content:
  - global.site.header.theme_dark
  - global.site.header.theme_light
name: theme-toggle
related:
  - button
  - form-header
status: review
title: Theme toggle
tokens:
  - font.family.narrow
  - rule.hairline
  - semantic.color.ground
  - semantic.color.ground-tone
  - semantic.color.ink
  - semantic.color.rule-strong
  - space.1
  - space.3
  - space.6
  - type.label
version: 1.0.0
---

# Theme toggle

## Purpose and when to use

Switches between the light and dark stock. The label names the action; the choice is kept on this device.

## Anatomy

1. A ruled button in the narrow face with the action label.

## Variants

- Offers dark; offers light.

## States

- Default.
- Hover: ground tone fill.
- Focus: outline.

## Behavior and interaction

- Sets the theme on the document and stores it in the browser; if storage is blocked the choice lasts for the page.
- Follows the system preference until the reader chooses.

## Accessibility

- Native button; the label states the result of activating it.

## Content guidelines

- Labels are Dark mode and Light mode.

## Responsive behavior

- Sits in the header actions.

## Do and do not

- Do: Respect the system preference first.
- Do not: animate the switch.
