---
code: web/components/FormHeader.tsx
content:
  - global.navigation.header.analysis
  - global.navigation.header.beers
  - global.navigation.header.breweries
  - global.navigation.header.results
  - global.navigation.header.saved_views
  - global.site.header.menu_button
  - global.site.header.nav_label
  - global.site.header.skip_link
  - global.site.identity.name
name: form-header
related:
  - button
  - filters-sheet
  - icon
status: review
title: Form header
tokens:
  - breakpoint.md
  - font.family.narrow
  - rule.hairline
  - rule.heavy
  - semantic.color.ground
  - semantic.color.ground-tone
  - semantic.color.ink
  - semantic.color.rule
  - semantic.color.rule-strong
  - size.page
  - space.1
  - space.2
  - space.3
  - space.4
  - space.6
  - type.h3
  - type.label
version: 1.0.0
---

# Form header

## Purpose and when to use

The site header, set as the head of a form: the site name in the first box, navigation as ruled boxes, a heavy rule underneath. It appears once, at the top of every page. It carries the global Filters control in its action area.

## Anatomy

1. Skip link, visible only on focus, first in the tab order.
2. Brand box: the site name in the subsection type role, ruled on its right edge.
3. Navigation boxes: one per top level destination, narrow face, uppercase, ruled on the right edge.
4. Actions area: the Filters control, pushed to the far end.
5. Menu button: shown below the md breakpoint, replaces the navigation boxes.
6. Heavy rule: closes the header.

## Variants

- Wide: brand and navigation boxes on one row from the md breakpoint.
- Narrow: brand, actions, and a Menu button; the navigation folds into a stacked list below.

## States

- Default: navigation text in ink.
- Hover: a ground tone fill behind the box.
- Current page: judging green text on a green tint fill, with aria-current set to page.
- Menu open: the Menu button reads as expanded and the stacked list is shown.
- Focus: the focus outline, 2px, offset 2px.

## Behavior and interaction

- The Menu button toggles the stacked navigation and updates aria-expanded.
- The skip link moves focus to the main content landmark.
- The header does not stick; the table header and the Filters sheet are the only layered surfaces.

## Accessibility

- The header is a banner landmark; each navigation is a nav landmark labelled with the site navigation label.
- The current page carries aria-current set to page and a color change; color is not the only cue because the box also changes fill.
- Menu button controls the stacked list through aria-controls and exposes aria-expanded.
- Every box is at least the minimum target height.
- Text contrast: ink on ground and green on green tint each meet 4.5 to 1, checked by design-system:check.

## Content guidelines

- Navigation labels come from the navigation content file, one or two words each.
- The brand box shows the site name only. No marks from the competition or its organizer.
- Do not add a tagline to the header.

## Responsive behavior

- Below the md breakpoint the navigation folds behind the Menu button; the brand and actions stay on the first row.
- The inner row is capped at the page size token and centered.

## Do and do not

- Do: Put the Filters control in the actions area on every page.
- Do: Mark the current destination with aria-current.
- Do not: add dropdown menus.
- Do not: round the boxes or add a shadow when the header sticks.
