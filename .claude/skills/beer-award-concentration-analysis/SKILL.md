---
name: beer-award-concentration-analysis
description: Test whether US regional and national beer medals concentrate in a few beers, breweries, ingredients, or flavor profiles, with chance baselines, confound checks, and honest reporting.
---

# beer-award-concentration-analysis

The working hypothesis: regional and national beer awards are overwhelmingly won by a small handful of beers that share the same or similar ingredients, which deliver the same flavor profile. This skill turns that sentence into four testable claims, measures each against what chance would produce, and reports the result without overclaiming. It reads the tables built by `beer-award-dataset` and hands charts to `beer-award-visualization`.

## claims

| id | claim | unit | needs entrants |
|---|---|---|---|
| h1 | Medals concentrate in few beers and breweries, more than entry volume explains. | medals per beer, per brewery | yes for the null, no for raw concentration |
| h2 | The same beers and breweries win repeatedly across years and competitions. | repeat medal count | helpful |
| h3 | Winners share ingredients more than the entrant pool does. | ingredient presence | yes |
| h4 | Winners cluster in flavor space more tightly than entrants. | flavor vector | yes |

Marketing questions (does a medal change price or distribution) are a separate claim h5 and are always reported as association, never as cause.

## confounds

- Style guidelines: a category's guideline already narrows ingredients. Compare winners to entrants in the same category, never to all beer.
- Entry volume: breweries that enter more categories win more medals. Every concentration measure is reported per entry as well as raw.
- Disclosure bias: winning brewers publish recipes more often. Restrict h3 and h4 to beers with brewer disclosure, and report the disclosure rate for winners and entrants separately.
- Reverse causality: medals drive marketing, and marketing does not drive judging (judging is blind). Never phrase h5 as marketing causing medals.
- Category consolidation and new categories across years change the denominator; hold the category set fixed for trend claims.

## methods

- Concentration: top k share, Herfindahl Hirschman index, Gini with Lorenz curves, per competition and year.
- Chance baseline: permutation null that reshuffles medals among entrants within each category, preserving entry counts per brewery. Report the observed value against the 5th to 95th percentile band of 2000 permutations.
- Repeat winners: count beers with two or more medals and compare with the same count under the null.
- Ingredient enrichment: log odds of an ingredient among winners against entrants in the same category, with a Haldane correction, Benjamini Hochberg false discovery control across ingredients, and a minimum of 10 entrant beers carrying the ingredient.
- Similarity: Jaccard similarity of ingredient sets at name and family level; cosine similarity of flavor vectors; compare mean within winners to mean within entrants with a permutation test.
- Marketing: before and after medal price per ounce and distribution count against matched non medal beers of the same style and brewery size.

## reporting-rules

- Every finding states the comparison group, the null, the effect size, and the sample size in the chart subtitle or table note.
- A claim survives only if it beats the null and survives the confound it is most exposed to. Otherwise write that the data do not support it; a null result is a result.
- Use plain words for strength: "about twice the chance rate" beats a bare p value.
- Never extrapolate from one competition to "awards in general". Name the competitions and years.
- Inferred ingredients and secondary sources never carry a headline.

## outputs

- `reports/concentration-<competition>-<years>.md` with the claim table filled in (supported, not supported, insufficient data).
- The supporting charts from `beer-award-visualization`, named to match.
