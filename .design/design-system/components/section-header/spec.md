---
code: web/components/SectionHeader.tsx
content:
  - pages.design-system.sections.color
  - pages.design-system.sections.type
name: section-header
related:
  - form-field
title: Section header
tokens:
  - rule.hairline
  - semantic.color.green
  - semantic.color.ink-muted
  - size.measure
  - space.2
  - space.3
  - space.8
  - type.body
version: 1.0.0
---

# Section header

## Purpose and when to use

A section heading in judging green over a green rule, with an optional line of explanation under it. It divides a page into the sections of a form.

## Anatomy

1. Heading, level two or three, in the green color role.
2. Optional aside to the right of the heading.
3. Rule: heavy under a level two heading, hairline under a level three heading, both in judging green.
4. Optional lead line in ink muted.

## Variants

- Level two: section type role, heavy rule.
- Level three: subsection type role, hairline rule.

## States

- Static. It has no interactive state.

## Behavior and interaction

- The heading carries an id so the section can be linked and so anchored jumps clear the page top.

## Accessibility

- Real heading elements in order; do not skip levels.
- Green on ground meets 4.5 to 1.
- The lead line is a paragraph, not part of the heading.

## Content guidelines

- A heading names what the section holds, in one to four words.
- The lead states the finding or the rule for the section in one sentence.

## Responsive behavior

- The heading balances its lines; the aside wraps under the heading on narrow screens.

## Do and do not

- Do: Use one level two heading per major section.
- Do not: color any other text judging green for decoration.
