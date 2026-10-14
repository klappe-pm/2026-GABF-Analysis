# gabf-analysis-voice-styleguide

This document defines the voice and style rules for all copy in the gabf-analysis project. Every string in this folder follows these rules. When a rule and a draft disagree, the rule wins. Follow all existing markdown rules and guidlines found in AGENTS.MD, CLAUDE.MD, or CODEX.MD style propogated from `0-llm-root`.

## style
### use-plain-language

Write for a brewer reading on a phone at the festival. Use the shortest words that stay exact. Cut any sentence that does not help the reader decide or understand something. Use common contractions.

### title-case

Headings, labels, buttons, and column headers use title case: capitalize the first letter for each word.Proper nouns keep their case: Great American Beer Festival, Brewers Association, Census, Federal Reserve, IPA, ABV, IBU, SRM, ARR, EBITDA.

### lead-with-data

Lead with what the data shows, then say how it was measured. "Entries per medal ranges from 4.5 to 142" comes before "Entries per medal is the entry count divided by the medals awarded."

Never write a count, share, or rank into the copy by hand. Use a token such as {{medal_count}} and let the build fill it in. Facts that do not change with the data, such as a rule change in a given year or the gallons in a barrel, may be written out.

### identify-data-gaps

- A value the data does not hold reads "Undefined".
- A value no source has published, such as a beer's IBU, reads "Not published".
- A year that is not loaded is never shown as zero medals.
- Nothing is estimated unless it is marked as an estimate.

### using-estimates

Every estimated figure carries `E` right after it, and the page links to Method once directly from the `E`. Explain an estimate one time, in plain words, and don't repeat the explanation beside every figure.

## don't-ship-internal-work-product

Visible copy never shows kebab case values, file names, paths, commands, column names, or instructions meant for whoever maintains the site. A raw data value always passes through the label dictionary in global/labels.yaml. If a value has no label, it reads "Not defined" until one is added.

Don't ship agent instructions to the external projects, only the final output. Don't ship any internal documentation or planning notes. Don't ship lans, roadmaps. 

### internal-work-product

Internal work product is kept in the `.docs/` folder and is not shipped to the external projects.

### external-content

Documentation all lives under `/docs/*`.

### gabf-analysis-is-independent

The site isn't affiliated with the Brewers Association or the Great American Beer Festival (GABF). Name them only to identify the competition and its sources. Use no logos, marks, or wording that suggests endorsement.

### credits

Nothing on the site credits an AI, a model, or a writing or coding tool. Third party software and data appear only in the attribution section of About, as their licenses require.
