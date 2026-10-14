---
domain: beer
category: gabf-analysis
sub-category: docs
topics:
  - awards
  - competitions
  - registry
types:
  - reference
date-created: 2026-10-13
date-revised: 2026-10-13
status: DRAFT
aliases: []
tags: []
---

# us-beer-competitions

A registry of US beer competitions that grant awards, 2021 to 2026: national and international competitions held in the US, state guild cups, state and county fairs, and style specific events. The data lives in `data/reference/us-beer-competitions.csv`, one row per competition per year, so a year a competition skipped or cancelled is still a row. It is the sampling frame for the `beer-award-dataset` skill: it says which competitions exist and where their results live, and it holds no medal results itself.

## status

This is a first pass and it is incomplete. Web research hit a search limit partway through, so many states and several national competitions were never searched. Treat missing competitions as unresearched, not as absent. 38 competitions and 228 rows are recorded; 62 rows are verified against the organizer's own site or official results, and the other 166 cite a secondary source in `source_url`.

| held | rows |
|---|---|
| yes | 128 |
| unknown | 71 |
| no | 28 |
| cancelled | 1 |

## columns

| column | meaning |
|---|---|
| competition_id | stable lowercase slug, same across years |
| competition_name | name as the organizer uses it |
| year | competition year |
| held | yes, no, unknown, or cancelled |
| event_date | judging or awards date; notes say which |
| city, state | where judging or the ceremony took place |
| scope | national, international, multi-state, or state |
| type | general, style-specific, state-fair, or festival-judged |
| style_focus | all styles, or the style the event is built around |
| organizer | guild, fair, publication, or company running it |
| eligibility | who may enter |
| style_guide | Brewers Association, BJCP, or the event's own |
| entries, entering_breweries | exact counts only; approximations go in notes |
| results_url | official results page when found |
| source_url | page the row's facts came from |
| verified | yes only when the organizer's own site or official results were opened |
| notes | dates meaning, conflicts between sources, approximations |

## data-rules

- Official results win over press and aggregators; conflicts are recorded in notes with both values.
- Counts are filled only from an exact published number. "About 900" stays in notes, not in `entries`.
- Nothing is inferred to fill a cell. Unknown is a valid answer.
- When two research passes covered the same competition, rows were merged under one `competition_id`, keeping the verified row and appending the other pass's notes.

## covered

National and international, held in the US: Great American Beer Festival, World Beer Cup, U.S. Open Beer Championship, Great International Beer, Cider, Mead and Seltzer Competition, Festival of Wood and Barrel Aged Beer (FoBAB), Alpha King Challenge, Best of the West Coast National IPA Throwdown.

State guild and association cups: California, Colorado, Connecticut, Florida, Indiana, Minnesota, Missouri, Montana, New Jersey, New Mexico, New York, North Carolina, Ohio (two), Oklahoma, Oregon, Texas, Virginia, Washington.

Fairs: California State Fair, San Diego County Fair, Colorado State Fair, Indiana State Fair (the Indiana Brewers Cup), Pennsylvania Farm Show.

Style specific: New Mexico IPA Challenge and Stout Invitational, Oregon and Washington fresh hop competitions, Yakima Fresh Hop Ale Festival, Best of Craft Beer fresh hop, Alaska barley wine, Hi-Wire Stout Bout, Bitburger Pilsner Challenge.

## gaps

- States never searched: Arkansas, Delaware, District of Columbia, Hawaii, Louisiana, Maine, Mississippi, Nevada, New Hampshire, North Dakota, Puerto Rico, Rhode Island, South Dakota, Vermont, West Virginia, Wyoming. Other states were searched only for their main guild cup.
- National competitions not yet researched: Los Angeles International, San Diego International, Denver International, New York International, Best of Craft Beer Awards (main competition), North American Beer Awards, US Beer Tasting Championship, Beverage Testing Institute, SIP Awards.
- State fairs not yet researched: Washington, Texas, New York, Ohio, Wisconsin, and the Big E.
- City and metro awards (for example local best of polls with judged panels) are not covered.
- Style leads not checked: lager, non alcoholic, gluten free, sour, Belgian, saison, Oktoberfest, smoked, gose, pumpkin.
- Organizer sites that could not be opened, so their rows rest on secondary sources: brewerscupofca.com, bestfloridabeer.org, ncbeer.org, texascraftbrewersguild.org, wabeerawards.com, theusopenchampionships.com, bestofcraftbeerawards.com.

## next-steps

1. Fill the gap lists above, one state or competition at a time, and raise `verified` by opening each organizer's results page.
2. For each competition with a public results list, record whether it also publishes entrants; only those can support ingredient enrichment.
3. Load medal results for the best covered competitions into `data/results/` following the `beer-award-dataset` skill.
