# README.MD

The design control plane and the review loop for GABF Analysis. Every screen is the real built site in one declared state, every screen explains itself, and feedback is captured inside the journey view as one flow: a ticket that names the job, the step, the state, the spots, the components and the copy it concerns.

The tooling is [product-feedback](https://github.com/klappe-pm/product-feedback), a separate project this repository opts into with [product-feedback.config.json](../../product-feedback.config.json). This folder holds what is this site's own: the interaction spec, the manifest, the jobs, the sketches, the screen drives and the generated prototype. The review widget inside the web app (`web/review/`), the design system and the site copy stay here too. Nothing in the site build, continuous integration or the deploy imports product-feedback; the `npm run` commands below call its `product-feedback` command, which must be installed on the machine (see [the-tooling](#the-tooling)).

## start-reviewing

```bash
cd /Users/kevinlappe/projects/active/gabf-analysis && npm run review
```

That builds the review version of the web app (`WEB_REVIEW=1`, into `web/out-web-review/`) and the control plane, then starts one server on `http://127.0.0.1:4173/`, bound to this machine only, with the feedback pipeline on. Open `http://127.0.0.1:4173/control-plane/` for the control plane (jobs, journeys, and all 51 screens, each framing a page of the review build), for example `#S-01`. The review build on its own is at `http://127.0.0.1:4173/`, with the Feedback entry point on every page. `npm run web:review` serves the same on `http://127.0.0.1:4176/` with the pipeline off.

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

The site build reads visible copy from the copy documents through `scripts/lib/site-copy.mjs` for the keys that exist there (the header, the footer link, the Not Found mark, the beer specs card, the category back link), so a change to one of those keys reaches every page that draws it on the next build, with no instance to match. A string with no key is still found as a hard coded instance. The build stops with the key named if the copy folder or a key it needs is missing; the folder is tracked in git, so a clean clone and continuous integration have it. `gabf-dashboard.html` is generated from site sources and is not committed: `npm run build:standalone` rebuilds it locally, and CI and the deploy build it on every run.

## editing-copy-in-place

With the panel open, text on the framed page that is one line of page copy has a dotted underline. Double click it, or focus it and press Enter, to edit it where it stands: a field with a solid blue outline covers the text, with Save and Cancel under it. Escape cancels. Hovering text that is not page copy says so in plain words (it comes from the data or the page layout), and it cannot be edited.

The field holds the copy entry's own value, so a placeholder such as {{year}} stays a placeholder. The same words found in other copy entries and hard coded strings are listed under the field with checkboxes, all checked, as in the panel. Save sends the new text through the same server copy edit the panel uses: the prose rules and the secret scan run first, and a refused value writes nothing and says why. Otherwise only the value text of the key's line changes, the checked related instances change, the review site is rebuilt, and the frame reloads on the new copy. Each save records an ACCEPTED ticket under `docs/feedback/<page-name>/` with the old and new values, the one spot, and the instances it changed.

When several entries hold the same words, the edit lands on the entry of the page under review first, then a shared one. The others are offered as related instances, checked by default, and unchecking them never stops the page changing. A single click on page copy adds its pin after a short pause, so a double click edits instead of pinning.

## journey-step-markers

A step carries the part of the page it concerns: a square blue outline with a small label (the step id and a plain name) drawn over the framed page, which stays fully readable. The region is `state.region` on the screen node in [design-nodes.json](design-nodes.json); a whole page step (the phone screens) has none and shows no marker. Hovering or focusing an action chip marks the control it acts on, from `controls` in the same file, keyed by the chip label in [interaction-spec.md](interaction-spec.md). Markers are square outlines with a label; spot pins are solid red numbered squares. Both exist only in the review build.

## where-tickets-live

One Markdown file per ticket under `docs/feedback/<page-name>/`, tracked in git, where the page name is the surface's plain name in lowercase kebab case (`overview-dashboard`, `brewery-detail`). The design system page's Save writes to `docs/feedback/design-system/`. Each ticket's captured images sit in a folder named after the ticket file, `docs/feedback/<page-name>/<ticket-name>/`, with `page.png` for the framed page, `spot-<n>.png` for each picked element, and `component.png` where the design system Save supplies one. `PRODUCT_FEEDBACK_FEEDBACK_DIR` moves the store, which tests and screenshots use. The pipeline's own queue, log and work folders live under `.docs/feedback/` (`.queue/`, `.work/`), which git ignores.

The frontmatter holds the id, status, job, step, state, route, spots (selector, rect and element text per pin), components, content keys, content edits, setting edits, categories, images, the issue and pull request numbers once they exist, created and revised; the note is the body. Each image is `{ path, kind, spot, component, url }`: the path is relative to the ticket, the kind is `page`, `spot` or `component`, and the url is the address the image has on main once the pull request merges. Every ticket is ACCEPTED when it is registered, and an edit keeps it ACCEPTED and moves only revised. Every string is scanned with product-feedback's token shape detector before it is written, and again before anything is sent to GitHub, because the repository is public. Tickets hold a reviewer's own words, so `npm run check` skips `docs/feedback/`; `npm run design:check` checks their structure instead.

```bash
cd /Users/kevinlappe/projects/active/gabf-analysis && npm run tickets -- list
cd /Users/kevinlappe/projects/active/gabf-analysis && npm run tickets -- show WI-003
cd /Users/kevinlappe/projects/active/gabf-analysis && npm run tickets -- refine WI-003 --note "Only at phone width" --categories "Layout,Mobile"
cd /Users/kevinlappe/projects/active/gabf-analysis && npm run tickets -- resolve WI-003 --commit <sha> --note "What was done"
cd /Users/kevinlappe/projects/active/gabf-analysis && npm run tickets -- decline WI-003 --note "Why not"
cd /Users/kevinlappe/projects/active/gabf-analysis && npm run tickets -- migrate
cd /Users/kevinlappe/projects/active/gabf-analysis && npm run tickets -- process --scan --dry-run
```

`migrate` moves tickets from the retired local folder `.docs/feedback/` to `docs/feedback/` unchanged: the note and every frontmatter line stay byte for byte, only `images: []` and `issue: null` are added, the id is kept, and an image folder moves with its ticket. It also copies the notes of the retired `design-feedback.jsonl` into the layout once, from the file or from git when the file is gone, and skips any note already copied. `export-github` prints the `gh issue create` commands that would turn accepted tickets into GitHub issues. It does not run them.

## captured-images

When a ticket is registered the review server answers at once and then captures PNG screenshots with the local Playwright: one of the framed page at the reviewer's viewport with the numbered pins and the step marker drawn over it, and one cropped to each picked element. Only the review site on this machine is opened, so nothing outside the framed site is captured. Playwright is found through `PLAYWRIGHT_MODULE`, then `node_modules`, then the global npm root, then product-feedback's own install, and Chromium is the newest headless shell in `~/Library/Caches/ms-playwright` unless `PLAYWRIGHT_CHROMIUM` names one. When no browser is available the ticket records `capture: unavailable` and goes on without images.

A ticket links every component to its spec, with Open in Obsidian beside the link in the local ticket and the panel, and says "No design system file yet" for a component with no spec. Every image is embedded and also a link that opens it in one click: a relative link in the local ticket, `[![Spot 1](url)](url)` in the GitHub issue. The review server serves a ticket's images at `/review/feedback-image/<ticket id>/<file>.png` so the panel can open them.

## the-feedback-pipeline

A saved ticket becomes a GitHub issue and a merged pull request with no one at the keyboard. The review server starts the pipeline when it registers a ticket, after the images are captured, and a watcher on `docs/feedback/` starts it for a ticket file written by someone else, such as the design system Save, once the file has stopped changing. A ticket id is queued once, so it never creates two issues. Jobs run one at a time from a queue saved in `.docs/feedback/.queue/queue.json`, with one line per step in `.docs/feedback/.queue/log.jsonl`. Saving never waits for it.

For each ticket, in order:

- A worktree under `.docs/feedback/.work/<id>/` on the branch `feedback/<id>-<slug>`, from a fresh `origin/main`.
- The ticket and its images are committed and the branch is pushed, so the issue can link the images from the branch.
- The issue is made from `.github/ISSUE_TEMPLATE/design-feedback.yml`'s sections, with the labels `feedback`, one per category, `page: <page>`, `kind: content`, `kind: setting` or `kind: design`, and `status: in progress`, created if missing. The number is recorded in the ticket.
- Copy edits and setting edits are reapplied from the ticket's old and new values with the same byte preserving writer. A note with no mechanical edit goes to `claude -p`, run in the worktree with the issue as the prompt.
- A commit with a plain message and `Refs #n`, then `npm ci` if needed and `npm run verify`. A failure is commented on the issue, the issue is labelled `status: needs attention`, the branch is left for review and the job stops.
- Push, a pull request with `Closes #n`, and `gh pr merge <n> --auto --merge --delete-branch` right after the ticket record is pushed, so GitHub merges when the required `build` check passes. The pipeline looks at the pull request every 15 seconds until it is merged. A failed check or a closed pull request turns auto-merge off, comments on the issue, labels it `status: needs attention`, and leaves the branch for review.
- A `## session handoff` comment with Delivered, Gates, Next, Blocked, Do not and Open decisions on the pull request and on the merge commit. The issue body is edited to point at main and the issue is labelled `status: done`.
- The worktree and local branch are removed, the ticket is DONE with its pull request recorded, and the main checkout is fast forwarded only when it is clean and on main. Otherwise the job records that it needs a pull.

The agent step is `claude -p --allowedTools "Read,Edit,Write,Glob,Grep,Bash(npm run verify),Bash(git status),Bash(git diff *)" --permission-prompts none --output-format json --no-session-persistence --max-budget-usd 5`, with the prompt on stdin and the worktree as the working directory. It names no flag that bypasses permissions or guards, it loads the session's usual settings and hooks, and anything outside the allowed tools is denied rather than asked. The prompt carries the repository rules: no dash used as punctuation, no attribution, plain copy, run `npm run verify`.

The pipeline touches only `klappe-pm/GABF-Analysis`: every `gh` call names it and the origin remote is checked first. `PRODUCT_FEEDBACK_PIPELINE=off` turns off the automatic run in the review server and the watcher. `npm run tickets -- process` runs the queue by hand, naming tickets to queue them or adding `--scan` to queue every accepted ticket without an issue, and `--dry-run` prints every `gh` and `git` command without running any. The panel shows each ticket's status (queued, issue, in progress, pull request, merged, needs attention) with links to the issue, the pull request and the images, and the same states are at `/review/pipeline`.

## owner-decisions

A question only the owner can answer is an issue assigned to klappe-pm, labelled `needs: owner decision` and `area: <plain area>`, written to the form `.github/ISSUE_TEMPLATE/owner-decision.yml`: the question, the context with links, the options (each with what choosing it means), the recommended option, what is blocked until it is answered, and how to answer. A person fills in the form on GitHub; an agent or session files the same thing from the command line, and an open issue that asks the same question is returned instead of filed twice.

```bash
cd /Users/kevinlappe/projects/active/gabf-analysis && npm run decisions -- open --question "Keep the tables sideways on phones?" --option "Yes => one design at every width" --option "No => cards at phone width" --recommend A --blocks "The phone layout" --context "See the medal tables page" --area design
cd /Users/kevinlappe/projects/active/gabf-analysis && npm run decisions -- open --file decisions.json
cd /Users/kevinlappe/projects/active/gabf-analysis && npm run decisions -- list
cd /Users/kevinlappe/projects/active/gabf-analysis && npm run decisions -- poll
```

The owner answers by replying to the issue with an option letter or free text. The review server (every two minutes, `PRODUCT_FEEDBACK_DECISION_POLL_MS` changes it) and `npm run tickets -- process` look at the comments on every open decision issue. The latest comment authored by klappe-pm is the answer; comments by anyone else are ignored. Agents post through the owner's own GitHub login, so every comment the pipeline writes begins with `<!-- feedback-pipeline -->` and is never read as an answer.

An answer becomes an ACCEPTED ticket of kind `decision` in `docs/feedback/decisions/`, with the issue number, the option chosen, and the owner's words, and it runs through the same pipeline as other feedback: a branch, the agent step with the question, the context and the answer as the prompt, verify, a pull request that closes the decision issue (no second issue is made), checks, merge, handoff and cleanup. When the answer needs no change to the repository the agent changes nothing, verify is skipped, and the pull request carries only the ticket; the issue is closed by that pull request with a comment saying so. The panel lists the open decisions under Open decisions, each a link to the issue.

## never-public

The feedback widget, the step marker, the pins and the copy key marks exist only in the web review build (`WEB_REVIEW=1`, written to `web/out-web-review/`). `tests/web-review-build.test.mjs` builds the public export and the review build and fails if any part of the widget appears in the public one, and the widget draws nothing on any host but this machine.

## the-files

- [interaction-spec.md](interaction-spec.md): every screen, its actions, and where each lands.
- [design-nodes.json](design-nodes.json): the manifest; nodes, consumes edges, each screen's state and region, the action controls, and the surfaces with their routes.
- [jobs-to-be-done.md](jobs-to-be-done.md): the jobs and journeys, from PRODUCT.md.
- [tokens.json](tokens.json): generated from the custom properties in `site/assets/styles.css`.
- `sketches/`: one live frame per surface; each screen is its surface's sketch driven into one state.
- [screen-drives.js](screen-drives.js): the steps a screen runs on the live page to reach its state (open the Filters dialog, open an estimate note), keyed by the `drive` a screen node names.
- `prototype/`: generated by `npm run design:build` (including the Feedback panel, which product-feedback supplies), checked by `npm run design:check`, which `npm run verify` runs.

What a change reaches: `product-feedback design impact surface:brewery-detail`.

## the-tooling

product-feedback is installed once per machine from its checkout, which puts the `product-feedback` command on the path:

```bash
cd /Users/kevinlappe/projects/active/product-feedback && npm ci && npm link
```

[product-feedback.config.json](../../product-feedback.config.json) is this site's side of the contract: the repository and owner for issues and decisions, the folders (`docs/design`, `docs/feedback`, the copy folder, the design system), the token stylesheet and the shell aliases, the screen drives, the message names the web app's review widget listens for (`gabf-control-plane`), the source folders copy may be hard coded in, the compound words copy may hyphenate, the pipeline's house rules, and the review hooks. [scripts/review-hooks.mjs](../../scripts/review-hooks.mjs) gives the review server the web review build, the rebuild after a copy edit, and the design system's setting edits with the picture each one carries. `tests/product-feedback.test.mjs` checks both; the tests that need the tool skip where it is not installed, as in continuous integration. The design system's setting editor writes its tickets through [scripts/lib/ticket-format.mjs](../../scripts/lib/ticket-format.mjs), and `npm run design:check` validates every ticket against product-feedback's format.
