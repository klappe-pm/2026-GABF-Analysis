---
code: web/components/RangeScale.tsx
content:
  - global.scales.range.above
  - global.scales.range.below
  - global.scales.range.inside
  - global.scales.range.no_range
  - global.scales.range.not_published
  - global.scales.range.source
  - global.scales.range.style_range
name: range-scale
related:
  - form-field
  - red-pen-note
title: Range scale
tokens:
  - font.family.narrow
  - font.family.sans
  - font.weight.semibold
  - rule.hairline
  - rule.heavy
  - semantic.color.green
  - semantic.color.green-tint
  - semantic.color.ink
  - semantic.color.ink-faint
  - semantic.color.ink-muted
  - semantic.color.rule-strong
  - space.0
  - space.2
  - space.3
  - space.4
  - space.6
  - type.data
  - type.label
  - type.lead
  - type.micro
version: 1.0.0
---

# Range scale

## Purpose and when to use

A scoresheet range scale that places a beer ABV or IBU inside its style minimum to maximum. The style range is a band in judging green; the beer value is an ink stroke. A value outside the band is a finding, so it is set in red pen.

## Anatomy

1. Label and value on one line.
2. Axis: a ruled baseline with tick marks at round steps.
3. Band: the style minimum to maximum in judging green over a green tint.
4. Marker: the beer value as a two pixel stroke, ink inside the band, red outside.
5. Range labels under the band edges.
6. Caption: a sentence that states where the value sits, and the source of the range.

## Variants

- Inside the range.
- Outside the range: value, marker, and caption in red pen.
- No published value: the band shows alone and the value reads Not published.
- No style range: the marker shows alone.

## States

- Static.

## Behavior and interaction

- The axis pads past the lower and upper values and ticks at one, two, five, or ten steps.
- The scale never invents a value; a missing value is stated.

## Accessibility

- A figure with a label and a caption; the caption is the text alternative and states inside, below, or above.
- Red is not the only cue: the caption says Below or Above the style range.
- The drawing is hidden from assistive technology because the caption carries the same facts.

## Content guidelines

- Captions come from the scales content file.
- Name the source of the range on its own line.

## Responsive behavior

- Fills its container width; labels stay inside the axis.

## Do and do not

- Do: Draw the range from the published style guideline.
- Do not: show a range for a category that has none.
