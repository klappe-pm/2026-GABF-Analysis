---
id: WI-002
status: ACCEPTED
title: Setup test, targeted note on the brewery name heading
page: brewery-detail
job: JOB-1
job-title: Benchmark a brewery against the field
step: S-27
state: brewery-default
state-path: happy
route: /breweries/green-cheek-beer-co/
hash: ""
served: site
spots:
  - n: 1
    selector: "#main > h1"
    rect:
      x: 166
      y: 171
      width: 1108
      height: 33
    text: Green Cheek Beer Co.
components: []
content-keys: []
categories:
  - Heading
  - Typography
device: desktop
viewport: 1440 by 772
build: 63dafc4bee8f
legacy-id: fb-002
created: 2026-10-14T18:22:15.378Z
revised: 2026-10-14T18:22:38.371Z
images: []
issue: null
---

Setup test, targeted note on the brewery name heading. This record checks that a pinned note carries its selector, box, click point, and code location. It asks for no change to the site.

## history

- 2026-10-14T18:22:23.903Z: Marked as a setup test of the review loop: it confirms a targeted note carries its selector, box, click point, and code location.
- 2026-10-14T18:22:38.371Z: done in 113f8ad. Setup test complete: the targeted note arrived with selector #main > h1, its box and click point, screen S-27, and code location scripts/build-site.mjs breweryPage, and its pin returned at 1440 and 390. No site change was asked for.
