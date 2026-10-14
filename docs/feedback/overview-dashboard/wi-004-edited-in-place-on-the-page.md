---
id: WI-004
status: ACCEPTED
title: Edited in place on the page
page: overview-dashboard
job: JOB-1
job-title: Benchmark a brewery against the field
step: S-01
state: overview-default
state-path: happy
route: /
hash: ""
served: site
spots:
  - n: 1
    selector: "#main > h2"
    rect:
      x: 24
      y: 2174
      width: 1206
      height: 30
    text: Results
components: []
content-keys:
  - global.navigation.header.results
content-edits:
  - key: global.navigation.header.results
    file: .docs/content-management-system/global/navigation.md
    old: Results
    new: Medal Winners
    instances:
      - kind: copy
        key: pages.dashboards.overview.results_title
        file: .docs/content-management-system/pages/dashboards.md
        line: 27
      - kind: copy
        key: pages.dashboards.categories.results_title
        file: .docs/content-management-system/pages/dashboards.md
        line: 49
      - kind: copy
        key: pages.dashboards.breweries.results_title
        file: .docs/content-management-system/pages/dashboards.md
        line: 62
      - kind: copy
        key: pages.dashboards.single_file.results_title
        file: .docs/content-management-system/pages/dashboards.md
        line: 225
      - kind: source
        file: web/out-review/design-system/index.html
        line: 19
      - kind: source
        file: web/out-review/design-system/index.html
        line: 19
categories: []
device: desktop
viewport: 1254 by 857
build: f162855dd53f
created: 2026-10-14T21:19:18.396Z
revised: 2026-10-14T21:19:18.396Z
capture: done
images:
  - path: wi-004-edited-in-place-on-the-page/page.png
    kind: page
    spot: null
    component: null
    url: https://github.com/klappe-pm/GABF-Analysis/blob/main/docs/feedback/overview-dashboard/wi-004-edited-in-place-on-the-page/page.png?raw=true
  - path: wi-004-edited-in-place-on-the-page/spot-1.png
    kind: spot
    spot: 1
    component: null
    url: https://github.com/klappe-pm/GABF-Analysis/blob/main/docs/feedback/overview-dashboard/wi-004-edited-in-place-on-the-page/spot-1.png?raw=true
issue: null
---

Edited in place on the page.


## content-edit

global.navigation.header.results in .docs/content-management-system/global/navigation.md

- old: Results
- new: Medal Winners
- also updated: .docs/content-management-system/pages/dashboards.md:27, .docs/content-management-system/pages/dashboards.md:49, .docs/content-management-system/pages/dashboards.md:62, .docs/content-management-system/pages/dashboards.md:225, web/out-review/design-system/index.html:19, web/out-review/design-system/index.html:19


## captured-images

- [Page](wi-004-edited-in-place-on-the-page/page.png)
- [Spot 1](wi-004-edited-in-place-on-the-page/spot-1.png)
