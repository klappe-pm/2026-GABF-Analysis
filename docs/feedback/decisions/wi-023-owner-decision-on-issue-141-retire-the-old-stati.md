---
id: WI-023
status: ACCEPTED
title: Retire the old static site page build?
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
created: 2026-10-15T21:06:53.688Z
revised: 2026-10-15T21:06:53.688Z
decision-answer: if this is retired where does the feedback tooling go? the live site? toggled off for every user but me.
decision-comment: 6202250388
decision-issue: 141
images: []
issue: 141
issue-url: https://github.com/klappe-pm/GABF-Analysis/issues/141
kind: decision
---

Owner decision on issue #141: Retire the old static site page build?

Answer from klappe-pm: if this is retired where does the feedback tooling go? the live site? toggled off for every user but me.

Free text answer.

## decision

Question: Retire the old static site page build?

Context: Every public page is now a route of the Next.js app, and the app's /overview/ replaces the relocated old dashboard, so the old page build (npm run build, scripts/build-site.mjs) only supplies /assets/ and gabf-dashboard.html. Its filter bar, labels and chart options duplicate the app's and have drifted; #73 exists because of that duplication. See docs/deployment.md.

Blocked until answered: Nothing today; every filter or copy change costs twice until answered
