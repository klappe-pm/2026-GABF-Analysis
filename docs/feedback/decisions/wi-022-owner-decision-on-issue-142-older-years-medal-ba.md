---
id: WI-022
status: DONE
title: "Older years' medal badges: link to the brewery page or build a beers page per year?"
page: decisions
job: null
job-title: null
step: null
state: null
state-path: null
route: null
hash: ""
served: site
spots: []
components: []
content-keys: []
categories:
  - Accessibility
  - Action
  - Bug
  - Colors
  - Content
  - Data
  - Footer
  - Functionality
  - Header
  - Heading
  - Icon
  - Images
  - Layout
  - Link
  - Mobile
  - New feature
  - Other
  - Remove
  - Typography
  - Videos
device: null
viewport: null
build: null
created: 2026-10-15T20:35:26.635Z
revised: 2026-10-15T20:35:26.635Z
decision-answer: A. No
decision-comment: 6201566025
decision-issue: 142
decision-option: A
images: []
issue: 142
issue-url: https://github.com/klappe-pm/GABF-Analysis/issues/142
kind: decision
pr: 152
pr-url: https://github.com/klappe-pm/GABF-Analysis/pull/152
resolution:
  status: DONE
  change: "pull request #152"
  note: Delivered by the feedback pipeline.
  at: 2026-10-15T21:09:05.085Z
---

Owner decision on issue #142: Older years' medal badges: link to the brewery page or build a beers page per year?

Answer from klappe-pm: A. No

Chosen option: A. Brewery page for earlier years. Consequence: ships now; earlier years open a filtered medal history, 2026 opens the beers page

## decision

Question: Older years' medal badges: link to the brewery page or build a beers page per year?

Context: #68 adds a medal badge that opens that year's beers. The app only builds /beers/2026/, so a badge for an earlier year opens the brewery page filtered to that year and metal instead. Building /beers/<year>/ for 2018 to 2025 would give every badge the same destination.

Blocked until answered: Where earlier years' badges point; the badge ships either way
