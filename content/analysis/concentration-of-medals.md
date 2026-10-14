---
title: "Concentration of medals"
summary: "How the medals split between repeat winners and breweries that won once."
status: "planned"
appears_on: "Analysis"
tokens: ["year_range", "brewery_count", "medal_count", "top_decile_share", "single_medal_share", "top_brewery", "top_brewery_medals"]
---

# Concentration of medals

From {{year_range}}, {{brewery_count}} breweries won {{medal_count}} medals. The top tenth of those breweries by medal count won {{top_decile_share}} of them, and {{single_medal_share}} of the breweries won exactly one.

## The leaders

{{top_brewery}} leads with {{top_brewery_medals}} medals. The full ranking, weighted by points (gold 3, silver 2, bronze 1), is in the Top breweries report.

## How it is measured

Only complete official lists count. Breweries are matched on a normalized name, so renamed printings and location suffixes roll up to one brewery.
