---
code: web/components/Breadcrumb.tsx
content:
  - global.navigation.breadcrumbs.all_categories
  - global.navigation.breadcrumbs.all_results
  - global.navigation.breadcrumbs.category_number
name: breadcrumb
related:
  - form-header
  - text-link
status: review
title: Breadcrumb
tokens:
  - font.family.narrow
  - semantic.color.ink
  - semantic.color.ink-faint
  - semantic.color.ink-muted
  - semantic.color.rule-strong
  - space.1
  - space.2
  - type.label
version: 1.0.0
---

# Breadcrumb

## Purpose and when to use

The trail above a page title, set like the reference line at the top of a form. It leads back to the index a page belongs to. Use it on detail pages only.

## Anatomy

1. Navigation landmark labelled with the breadcrumb label.
2. Ordered list of items in the narrow face, uppercase.
3. Separator: a slash, hidden from assistive technology.
4. Links for ancestors; plain text for the current page.

## Variants

- Two levels: an index link and the current page.
- Three or more levels: each ancestor links.

## States

- Default: ink muted, underlined links.
- Hover: the link text and underline move to ink.
- Current: ink, no link, aria-current set to page.
- Focus: the focus outline.

## Behavior and interaction

- Items wrap to a second line instead of truncating.
- The current page is never a link.

## Accessibility

- An ordered list inside a labelled nav landmark.
- The separator is aria-hidden.
- Ink muted on ground meets 4.5 to 1.

## Content guidelines

- Ancestor labels name the index, for example All results.
- The current item repeats the page title in short form.

## Responsive behavior

- Wraps; no horizontal scroll at 320px width.

## Do and do not

- Do: Keep the trail to three levels.
- Do not: use the breadcrumb as the only way back; the header navigation stays.
