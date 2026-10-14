# README.MD

The design control plane and the review loop for GABF Analysis. Every screen is the real built site in one declared state, every screen explains itself, and feedback is captured inside the journey view as one flow: a ticket that names the job, the step, the state, the spots, the components and the copy it concerns.

## start-reviewing

```bash
cd /Users/kevinlappe/projects/active/gabf-analysis && npm run review
```

That builds the review version of the site into `dist-review/` and starts one server on `http://127.0.0.1:4173/`, bound to this machine only. Open `http://127.0.0.1:4173/` for the control plane (jobs, journeys, and all 51 screens), for example `#S-01`. The site on its own is at `http://127.0.0.1:4173/site/`, with no feedback entry point: feedback is logged from the journey view.

## the-feedback-panel

The Feedback button in the top bar is the one entry point (`#S-01/feedback` opens a screen with the panel out). The panel docks beside the framed page and the page reflows narrower, so nothing is covered. At a phone width there is no room beside the page, so the page sits above the panel.

From top to bottom: the job, journey step and state you are on, the note, the spots, the categories, the design system components and content entries the ticket concerns, what is already recorded for the step, and Send, which is green and on the right.

- While the panel is open, each click on the framed page adds a numbered pin, listed in the panel with a Remove control. Picking stays on. A ticket with no spots is about the whole page.
- From the keyboard, tab to an element in the page and press Shift and Enter, or use Add the focused element in the panel. Escape closes the panel.
- Components and content entries are derived from the picked elements and stay editable. Components come from [source-map.json](../../site/review/source-map.json) (each entry names the design system component its region draws, and the manifest node), checked against the manifest in [design-nodes.json](design-nodes.json). A component is linked by name; when `.design/design-system/components/<name>/` exists the ticket also carries the path to its spec. Content entries come from the copy documents in `.docs/content-management-system/`, resolved with the key mapping in `scripts/lib/content-md.mjs`. With no spots, a ticket links to the components its screen consumes.
- A component with a spec file under `.design/design-system/components/` is a link in the panel, in the control plane's "Made of" lists and in the ticket: it opens the spec as a readable page in a new tab through the review server's read only route `/review/design-system/`, which serves nothing outside `.design/design-system/`. A second link, Open in Obsidian, opens the same file in the editor. A component with no spec file is plain text marked "No design system file yet". A ticket stores each component's `spec` path in its frontmatter and a relative Markdown link to the spec in its body, and `npm run tickets -- list` prints the path.
- Categories are listed alphabetically from [feedback-categories.json](feedback-categories.json); any number may be ticked.
- Drafts belong to the step they were started on, so Prev and Next keep what was typed.

## changing-copy-from-a-spot

Tick This spot is page copy on a spot. The panel resolves the copy entry behind the text, shows its current value, and offers a field for the new value. It also lists other copy entries and hard coded strings in `site/`, `scripts/` and `web/` that hold the identical old text, each with a checkbox, all checked.

On Send the server checks the new text first: no dash used as punctuation, no kebab case word, one line, and the secret scan. A value that breaks a rule is refused with the reason and nothing is written. Otherwise it changes only the value text of the key's line in the copy file (the frontmatter, the other keys, line endings and formatting stay byte for byte), changes each checked instance in source files only (never in generated output), rebuilds the review site and reloads the frame. The ticket records the key, the file, the old and new values and every instance it changed.

The site build reads visible copy from the copy documents through `scripts/lib/site-copy.mjs` for the keys that exist there (the header, the footer link, the not defined mark, the beer specs card, the category back link), so a change to one of those keys reaches every page that draws it on the next build, with no instance to match. A string with no key is still found as a hard coded instance. The build stops with the key named if the copy folder or a key it needs is missing; the folder is tracked in git, so a clean clone and continuous integration have it. The committed `gabf-dashboard.html` is generated from site sources: run `npm run build:standalone` after a copy change before committing.

## editing-copy-in-place

With the panel open, text on the framed page that is one line of page copy is outlined with a dotted line. Double click it, or focus it and press Enter, to edit it where it stands: a field with a solid blue outline covers the text, with Save and Cancel under it. Escape cancels. Hovering text that is not page copy says so in plain words (it comes from the data or the page layout), and it cannot be edited.

The field holds the copy entry's own value, so a placeholder such as {{year}} stays a placeholder. The same words found in other copy entries and hard coded strings are listed under the field with checkboxes, all checked, as in the panel. Save sends the new text through the same server copy edit the panel uses: the prose rules and the secret scan run first, and a refused value writes nothing and says why. Otherwise only the value text of the key's line changes, the checked related instances change, the review site is rebuilt, and the frame reloads on the new copy. Each save records an ACCEPTED ticket under `.docs/feedback/<page-name>/` with the old and new values, the one spot, and the instances it changed.

When several entries hold the same words, the edit always lands on the entry the site build reads for that text (the review build records its reads in `review-copy-keys.json`), then the entry of the page under review, then a shared one. The others are offered as related instances, checked by default, and unchecking them never stops the page changing. A single click on page copy adds its pin after a short pause, so a double click edits instead of pinning.

## journey-step-markers

A step carries the part of the page it concerns: a square blue outline with a small label (the step id and a plain name) drawn over the framed page, which stays fully readable. The region is `state.region` on the screen node in [design-nodes.json](design-nodes.json); a whole page step (the phone screens) has none and shows no marker. Hovering or focusing an action chip marks the control it acts on, from `controls` in the same file, keyed by the chip label in [interaction-spec.md](interaction-spec.md). Markers are square outlines with a label; spot pins are solid red numbered squares. Both exist only in the review build.

## where-tickets-live

One Markdown file per ticket under `.docs/feedback/<page-name>/`, where the page name is the surface's plain name in lowercase kebab case (`overview-dashboard`, `brewery-detail`). `.docs/` is excluded from git on this machine, so tickets are local and CI, which has no `.docs/` folder, simply finds none. `GABF_FEEDBACK_DIR` moves the store, which tests and screenshots use.

The frontmatter holds the id, status, job, step, state, route, spots (selector, rect and element text per pin), components, content keys, categories, created and revised; the note is the body. Every ticket is ACCEPTED when it is registered, and an edit keeps it ACCEPTED and moves only revised. Every string is scanned with the token shape detector from the agent-graph engine before it is written.

```bash
cd /Users/kevinlappe/projects/active/gabf-analysis && npm run tickets -- list
cd /Users/kevinlappe/projects/active/gabf-analysis && npm run tickets -- show WI-003
cd /Users/kevinlappe/projects/active/gabf-analysis && npm run tickets -- refine WI-003 --note "Only at phone width" --categories "Layout,Mobile"
cd /Users/kevinlappe/projects/active/gabf-analysis && npm run tickets -- resolve WI-003 --commit <sha> --note "What was done"
cd /Users/kevinlappe/projects/active/gabf-analysis && npm run tickets -- decline WI-003 --note "Why not"
cd /Users/kevinlappe/projects/active/gabf-analysis && npm run tickets -- migrate
```

`migrate` copies the notes of the retired `design-feedback.jsonl` into the new layout once, from the file or from git when the file is gone, and skips any note already copied. `export-github` prints the `gh issue create` commands that would turn accepted tickets into GitHub issues. It does not run them.

## never-public

The page picker, the step marker, the pins and their source attributes exist only in the review build (`GABF_FEEDBACK=1`, written to `dist-review/`). The build refuses that flag in continuous integration, `tests/review-build.test.mjs` builds the public site and fails if any part of it appears there, and the picker will not start on any host but this machine or outside the control plane's frame.

## the-files

- [interaction-spec.md](interaction-spec.md): every screen, its actions, and where each lands.
- [design-nodes.json](design-nodes.json): the manifest; nodes, consumes edges, each screen's state and region, the action controls, and the surfaces with their routes.
- [jobs-to-be-done.md](jobs-to-be-done.md): the jobs and journeys, from PRODUCT.md.
- [tokens.json](tokens.json): generated from the custom properties in `site/assets/styles.css`.
- `sketches/`: one live frame per surface; each screen is its surface's sketch driven into one state.
- `prototype/`: generated by `npm run design:build` (including the Feedback panel, whose source is `scripts/control-plane/`), checked by `npm run design:check`, which `npm run verify` runs.

The engine is the agent-graph repository, used read only through `scripts/lib/agent-graph.mjs`; set `AGENT_GRAPH_DIR` if it is not at `~/projects/active/agent-graph`. What a change reaches: `node scripts/design-control-plane.mjs impact surface:brewery-detail`.
