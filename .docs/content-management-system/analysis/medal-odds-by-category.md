---
title: "Medal odds by category"
summary: "Some categories hand out a medal for every few entries; others make each medal beat a field many times larger."
status: "partly built"
appears_on: "Top categories report, categories dashboard, home category index"
tokens: ["odds_min", "odds_min_category", "odds_max", "odds_max_category", "odds_median", "year_range", "missing_entry_count"]
---

# Medal odds by category

Entries per medal ranges from {{odds_min}} in {{odds_min_category}} to {{odds_max}} in {{odds_max_category}}, with a median of {{odds_median}} across categories, {{year_range}}.

## How it is measured

Entries per medal is a category's entry count divided by the medals it awarded that year. Entry counts come from the official winners lists. It reads as odds: how many entries each medal had to beat.

## What it does not say

It is not any one beer's chance of winning: it says nothing about how a beer is judged, and a category can award fewer than three medals. {{missing_entry_count}} medals have no published entry count and are left out.
