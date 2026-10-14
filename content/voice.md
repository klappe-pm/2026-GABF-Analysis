# Voice and style

Every string in this folder follows these rules. When a rule and a draft disagree, the rule wins.

## Plain, precise, brief

Write for a brewer reading on a phone at the festival. Use the shortest words that stay exact. Cut any sentence that does not help the reader decide or understand something.

## The finding first, then the evidence

Lead with what the data shows, then say how it was measured. "Entries per medal ranges from 4.5 to 142" comes before "Entries per medal is the entry count divided by the medals awarded."

## Sentence case

Headings, labels, buttons, and column headers use sentence case: capitalize the first word and proper nouns only. "Medals by style family", not "Medals By Style Family". Proper nouns keep their case: Great American Beer Festival, Brewers Association, Census, Federal Reserve, IPA, ABV, IBU, SRM, ARR, EBITDA.

## No dash as punctuation

Never use an em dash, an en dash, a spaced hyphen, or a double hyphen to join or break a sentence. Use a comma, a colon, a semicolon, parentheses, or a period. Write ranges with the word to: "2021 to 2026", "4.0% to 4.9%". Hyphens inside real compound words stay: gluten-free, Pro-Am, barrel-aged.

## No machinery in visible copy

Visible copy never shows kebab case values, file names, paths, commands, column names, or instructions meant for whoever maintains the site. A raw data value always passes through the label dictionary in global/labels.yaml. If a value has no label, it reads "Not defined" until one is added.

## Gaps are stated, never filled

- A value the data does not hold reads "Not defined".
- A value no source has published, such as a beer's IBU, reads "Not published".
- A year that is not loaded is never shown as zero medals.
- Nothing is estimated unless it is marked as an estimate.

## Estimates carry (E)

Every estimated figure carries (E) right after it, and the page links to Method once. Explain an estimate one time, in plain words, and do not repeat the explanation beside every figure.

## Numbers come from the data

Never write a count, share, or rank into the copy by hand. Use a token such as {{medal_count}} and let the build fill it in. Facts that do not change with the data, such as a rule change in a given year or the gallons in a barrel, may be written out.

## Independent and unofficial

The site is not affiliated with the Brewers Association or the Great American Beer Festival. Name them only to identify the competition and its sources. Use no logos, marks, or wording that suggests endorsement.

## No credit to tools

Nothing on the site credits an AI, a model, or a writing or coding tool. Third party software and data appear only in the attribution section of About, as their licenses require.
