---
name: beer-award-visualization
description: Chart beer award, ingredient, flavor, and marketing data using Tufte and Schwabish practice; pie and donut charts are banned outright.
---

# beer-award-visualization

Use this skill for every chart built from the beer award dataset. It applies Edward Tufte (The Visual Display of Quantitative Information) and Jonathan Schwabish (Better Data Visualizations) to this subject, and pairs with `beer-award-concentration-analysis`, whose claims each map to a chart below. `scripts/beer-award-mockups.py` renders reference versions of every chart from synthetic data into `docs/design/dash-mocks/`.

## hard-bans

These are never produced, regardless of request wording:

- Pie, donut, sunburst, Nightingale or coxcomb charts. Use a sorted bar, dot plot, or stacked single bar instead.
- 3D charts of any kind.
- Dual y axes. Use two aligned panels.
- Rainbow or jet color scales. Use a single hue ramp, or a diverging pair with a gray midpoint.
- Truncated baselines on bar charts.

## core-principles

- Data ink: remove borders, background fills, heavy gridlines, tick marks that carry nothing. Keep hairline horizontal gridlines only when values must be read.
- Start with gray: draw everything in a neutral context color, then add one or two emphasis colors for what the title is about.
- Active titles: the title states the finding ("Three beers took 40% of IPA golds"), and the subtitle states the measure, the comparison, and the sample.
- Direct labels on lines and bars instead of legends wherever space allows.
- Small multiples with shared axes when comparing competitions or years.
- Lie factor of one: encoded size is proportional to value; areas never encode a linear quantity.
- Every chart carries a source note naming the competition, years, and where the data came from. Synthetic data says so.

## style

- Font: Helvetica Neue, falling back to Helvetica, then Inter. Title 18pt bold, subtitle 12pt, labels 10 to 11pt.
- Surface `#fcfcfb`; ink near black; context gray `#d6d5ce`.
- Emphasis blue `#2a78d6`, second emphasis orange `#eb6834`.
- Diverging: red `#e34948` for more than expected, blue for less, gray midpoint.
- Sequential: a single blue ramp from very light to deep.
- Render at 220 dpi with tight bounding boxes.

## chart-catalog

| question | chart | claim |
|---|---|---|
| How complete is the data by competition and year? | coverage heatmap | dataset |
| How concentrated are medals? | Lorenz curves as small multiples | h1 |
| Do repeat winners exceed chance? | observed points against a null band | h2 |
| Which ingredients are over or under represented among winners? | diverging horizontal bars, sorted | h3 |
| How does an ingredient's share move from entrants to winners? | slope chart | h3 |
| How do ingredient shares change across years? | ingredient by year heatmap, single hue | h3 |
| Do winners sit in a narrow band of a measure such as IBU? | strip plots, winners over entrants | h4 |
| Do winners cluster in flavor space? | scatter of two flavor axes, winners emphasized | h4 |
| Who rises and falls in brewery rankings? | bump chart | h2 |
| Who wins efficiently relative to entries? | lollipop chart of medals per entry | h1 |
| Does price move after a medal? | before and after slopes against matched controls | h5 |

## workflow

1. Name the claim the chart answers and write the active title first.
2. Pick the chart from the catalog; if none fits, choose the simplest form that keeps position on a common scale.
3. Draw in gray, then emphasize only what the title names.
4. Label directly, add the subtitle (measure, comparison, sample) and the source note.
5. Check the title against the data. If the numbers do not say what the title says, change the title.
6. Check every hard ban before export.
