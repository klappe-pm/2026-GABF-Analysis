# Formats

How numbers, money, dates, and ranges are written. Each entry is a rule and a written example. The build applies the rule; the example shows the result.

## `number`

Where: counts in tables, tiles, and prose.

- `rule`: Whole numbers with comma thousands separators.
- `example`: 1,907

## `number_compact`

Where: large figures in stat tiles and chart labels.

- `rule`: One decimal at most, with K for thousands, M for millions, and B for billions. Drop a trailing .0.

### `examples`

- 950
- 1.2K
- 12K
- 3.4M
- 1.1B

## `percent`

Where: shares and rates.

- `rule`: One decimal for shares of medals; whole numbers for margins.

### `examples`

- 35.4%
- 12%

## `currency`

Where: revenue, ARR, EBITDA, and gross profit.

- `rule`: US dollars, compact, with a dollar sign. Estimates carry (E).

### `examples`

- $12M (E)
- $850K (E)

## `rate`

Where: medals per million residents and per $100 billion of real GDP.

- `rule`: Two decimals.
- `example`: 4.17

## `abv`

Where: ABV and IBU.

- `rule`: One decimal with a percent sign; drop a trailing .0.

### `examples`

- 5.2%
- 6%

## `ibu`

- `rule`: Whole number.
- `example`: 45

## `range`

Where: any span of values or years.

- `rule`: Write ranges with the word to, never a dash.

### `examples`

- 2021 to 2026
- 4.0% to 4.9%
- $9M to $16M (E)

## `year_list`

Where: lists of years.

- `rule`: Two years joined with and; three or more with commas.

### `examples`

- 2018 and 2019
- 2022, 2023, and 2024

## `date`

Where: awards dates and any full date.

- `rule`: Month name, day, and year.
- `example`: October 11, 2026

## `medal_split`

Where: medal splits in tables.

- `rule`: Gold, silver, and bronze counts in that order, separated by slashes.
- `example`: 3 / 1 / 2

## `plurals`

Where: plurals in counts.

- `rule`: Write 1 medal and 2 medals; never medal(s).

### `examples`

- 1 medal
- 4 locations
