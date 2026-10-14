---
domain: beer
category: gabf-analysis
sub-category: docs
topics:
  - material-app
  - site-port
types:
  - plan
date-created: 2026-10-14
date-revised: 2026-10-14
status: ACCEPTED
aliases: []
tags: []
---

# site-port-plan

The Material 3 app in web/ becomes the whole public site at gabf.beer, and the static build in scripts/build-site.mjs retires once every page below is ported. This plan lists every page the static build renders today, the route each takes in the app, the data and components it uses, and the lanes that port them in parallel without editing the same file.

## foundation

- Site frame: web/app/(site)/layout.tsx wraps every public page in the top app bar (site name, Filters button), the navigation for the window size class (tabs under 600 pixels, a rail from 600, the drawer or rail from 1200 as settings.md says), the active filter chips, and the page. Destinations follow layout.md "Site navigation": Results, Breweries, Beers, Analysis; the drawer adds Categories, Hops, and Hop farms.
- Footer: web/app/layout.tsx, on every page including the design system: About and source links, the sources, estimate, and independence lines, and the Catalog.beer line from global.site.footer.beer_details.
- Global filter: web/lib/global-filter.tsx keeps the current behavior: the selection lives in the URL hash, then browser storage, then the default (complete years only); the rules are site/assets/filter-bar.mjs through web/lib/filter-model.mjs. The Filters dialog (F opens it) lists every dimension with progressive option counts.
- Data: web/lib/site-data.ts loads web/lib/site-model.mjs with Node's own import; site-model.mjs calls loadDataset from scripts/lib/data-model.mjs and enrichResults and buildPayload from scripts/build-site.mjs, so nothing is forked. The dataset loads once per build worker.
- Static params: staticParams.beers, .breweries, .categories, .hops, and .hopFarms in web/lib/site-data.ts; every dynamic route also sets dynamicParams = false.
- Links: href() and paths in web/lib/href.ts; a plain a element or a Material href goes through href() so a base path (NEXT_BASE_PATH) is carried. gabf.beer has none.
- Metadata: pageMetadata() in web/lib/seo.ts gives the title, the description, the canonical gabf.beer address with its trailing slash, and Open Graph and card tags with the social card at /social-preview.png.
- Files the browser reads: /data/results.json and /data/meta.json, built by route handlers in web/app/data/, same addresses and content as today.
- 404: web/app/not-found.tsx renders inside the site frame and exports as 404.html.
- Reference port: /beers/2026/ (web/app/(site)/beers/[year]/) and /beers/2026/<beer>/ (web/app/(site)/beers/[year]/[stem]/). Copy their shape: static params from site-data, metadata from seo, every word from the copy documents, rows sliced on the server with filterRow, and a client view that calls usePageScope and useFilteredRows.

## inventory

The static build writes 1,694 pages. Counts are from the current data: 1,907 medal rows, 947 breweries, 175 categories, 336 profiled 2026 beers, 100 hop varieties, 113 hop farms.

| page | current path | count | target route | data | components | lane |
|---|---|---|---|---|---|---|
| Overview dashboard | / | 1 | app/(site)/overview/page.tsx (the home page at app/(site)/page.tsx replaces it at /) | data/results.json, meta, breweries | chart-card, stat-card, data-table, tabs | dashboards |
| Dashboards index | /dashboards/ | 1 | app/(site)/dashboards/page.tsx | dashboard list copy | text-link, page-header | dashboards |
| Geography dashboard | /dashboards/geography/ | 1 | app/(site)/dashboards/geography/page.tsx | results, meta indicators, US map geometry | chart-card, stat-card, data-table, tabs | dashboards |
| Categories dashboard | /dashboards/categories/ | 1 | app/(site)/dashboards/categories/page.tsx | results, categories | chart-card, stat-card, data-table, tabs | dashboards |
| Breweries dashboard | /dashboards/breweries/ | 1 | app/(site)/dashboards/breweries/page.tsx | results, breweries, hash key brewery | chart-card, select, data-table, tabs | dashboards |
| Ownership and economics dashboard | /dashboards/economics/ | 1 | app/(site)/dashboards/economics/page.tsx | results, brewery info, estimates | chart-card, estimate-tooltip, data-table, tabs | dashboards |
| Explorer | /explorer/ | 1 | retired: /analysis/explore/ and a redirect, built by the analysis lane | none | none | categories and analysis |
| 2026 winners | /beers/2026/ | 1 | app/(site)/beers/[year]/page.tsx (done) | winners(2026) | data-table, medal-mark, text-link, state-card | foundation |
| Beer detail | /beers/2026/<beer>/ | 336 | app/(site)/beers/[year]/[stem]/page.tsx (done) | beer(stem) | beer-profile-card, breadcrumb, button | foundation |
| First time medalists | /first-time-medalists/2026/ | 1 | app/(site)/first-time-medalists/[year]/page.tsx | medal rows with first_time, ambiguous names | data-table, callout, filter-chips | breweries |
| Breweries index | /breweries/ | 1 | app/(site)/breweries/page.tsx | brewery info, medal rows | data-table, search-field, estimate-tooltip | breweries |
| Brewery detail | /breweries/<brewery>/ | 947 | app/(site)/breweries/[slug]/page.tsx | brewery entity, medal rows, estimates, other competitions | medal-record, stat-card, chart-card, data-table, estimate-tooltip, callout | breweries |
| Categories index | /categories/ | 1 | app/(site)/categories/page.tsx | categoryIndex, medal rows | data-table, status-chip | categories and analysis |
| Category detail | /categories/<category>/ | 175 | app/(site)/categories/[slug]/page.tsx | category, style reference, medal rows | range-scale, status-chip, chart-card, data-table | categories and analysis |
| Reports index | /reports/ | 1 | app/(site)/reports/page.tsx | report list copy, coverage | text-link, status-chip | categories and analysis |
| Report pages (top breweries, top categories, by state, by region, ownership, economics, trends, Brewery of the Year) | /reports/<report>/ | 8 | app/(site)/reports/[slug]/page.tsx | medal rows, summary, awards, ownership | chart-card, data-table, estimate-tooltip | categories and analysis |
| About | /about/ | 1 | app/(site)/about/page.tsx | coverage, sources | data-table, status-chip, text-link | categories and analysis |
| Hops index | /hops/ | 1 | app/(site)/hops/page.tsx | hop model varieties | hop-profile-card, data-table | hops |
| Hop variety | /hops/<variety>/ | 100 | app/(site)/hops/[slug]/page.tsx | hop variety, medal beers, farms, acreage | hop-profile-card, data-table, chart-card | hops |
| Hop farms index | /hop-farms/ | 1 | app/(site)/hop-farms/page.tsx | hop farms by state, merchants, gaps | data-table | hops |
| Hop farm | /hop-farms/<farm>/ | 113 | app/(site)/hop-farms/[slug]/page.tsx | farm, varieties, named and grown beers | data-table, text-link | hops |
| Design system | /design-system/ | 1 | app/design-system/page.tsx (done, outside the site frame) | design settings, real samples | every component | none |
| Results and meta files | /data/results.json, /data/meta.json | 2 | app/data/*/route.ts (done) | buildPayload | none | foundation |
| Other data files | /data/breweries.json, brewery-info.json, categories.json, estimates.json | 4 | app/data/<file>/route.ts | buildPayload, breweryInfo, explainEstimate | none | dashboards |
| Data downloads | /data/csv/<file> | 38 | app/data/csv/[file]/route.ts with generateStaticParams | data/results and data/reference files | none | dashboards |

## lanes

Each lane owns only the files listed for it. The site frame, web/lib/site-model.mjs, web/lib/site-data.ts, web/lib/global-filter.tsx, web/lib/href.ts, web/lib/seo.ts, global copy files, web/design/, and layout.md stay with the foundation; a lane that needs a change there asks for it rather than editing.

- dashboards: routes /, /dashboards/ and its four dashboards, /explorer/, and the data files above. Files: web/app/(site)/page.tsx, web/app/(site)/dashboards/, web/app/(site)/explorer/, web/app/data/ (except results.json and meta.json), web/lib/models/dashboards.mjs and .d.mts, tests/site-dashboards.test.mjs, .docs/content-management-system/pages/home.md, dashboards.md, explorer.md, and the component specs tabs, side-sheet, chips, and explorer-app with the components that implement them.
- breweries: routes /breweries/, /breweries/<brewery>/, /first-time-medalists/2026/. Files: web/app/(site)/breweries/, web/app/(site)/first-time-medalists/, web/lib/models/breweries.mjs and .d.mts, tests/site-breweries.test.mjs, pages/breweries-index.md, brewery-detail.md, first-time-medalists.md, and the medal-record and estimate-tooltip specs if they need changes.
- categories and analysis: routes /categories/, /categories/<category>/, /reports/, the eight reports, /about/. Files: web/app/(site)/categories/, web/app/(site)/reports/, web/app/(site)/about/, web/lib/models/analysis.mjs and .d.mts, tests/site-analysis.test.mjs, pages/results-by-category.md, category-detail.md, analysis-index.md, analysis-report.md, about.md, and the range-scale and status-chip specs if they need changes.
- hops: routes /hops/, /hops/<variety>/, /hop-farms/, /hop-farms/<farm>/, and the remaining parity on the beer pages (the hop profile table, farms that grow each hop, brewing details, and the stat tiles of the winners list). Files: web/app/(site)/hops/, web/app/(site)/hop-farms/, web/app/(site)/beers/ (after this foundation merges), web/lib/models/hops.mjs and .d.mts, tests/site-hops.test.mjs, pages/hops.md, hop-detail.md, hop-farms.md, hop-farm-detail.md, beers-index.md, beer-detail.md, and the hop-profile-card and spec-card specs.

## lane-rules

- Load data in web/lib/models/<lane>.mjs: import site() from ../site-model.mjs and slice what the page needs; read it in pages through laneModel() in web/lib/site-data.ts. Send a client view filterRow(row, extras), never whole rows.
- Every dynamic route sets dynamicParams = false and uses a staticParams helper, so every current address is built and nothing else is.
- Every visible word comes from the copy documents in .docs/content-management-system; add keys to the lane's own pages file. No kebab slugs, file names, or developer instructions in visible copy; label raw values through global/labels.md.
- Compose the components in web/components. A lane that ports a spec still drawn by the static build (tabs, chips, side-sheet, spec-card, explorer-app) adds its web/components file and points that spec's code at it; it never edits web/design/schema.ts or layout.md, which stay with the foundation.
- Tables never wrap, stay left aligned, and have a bold header (the DataTable defaults and the .prose table rules). Material shapes are allowed. Public Sans sets every figure; Archivo Narrow sets labels without figures only.
- Use href() or paths from web/lib/href.ts for every link, and pageMetadata() for every page.
- Routing parity is a test: tests/site-routes.test.mjs fails on any current address with no route, no redirect, and no line in its PENDING list, and on any PENDING line whose address is now routed. A lane removes its PENDING lines in the same change that adds the routes.
- Filters in a page: call usePageScope and useFilteredRows from web/lib/global-filter.tsx. A page that draws its own filter panel uses useFilterFields from web/app/(site)/shell/SiteFilters.tsx with the copy from shellConfig() in web/app/(site)/shell/frame.tsx, and gets the same progressive options, order, and URL state as the Filters dialog.
- Name no folder with a leading underscore: a common global gitignore rule drops such folders without a word, so the frame's parts live in web/app/(site)/shell/, which has no page file and so is not a route. The copy folder .docs/ is ignored the same way: stage an edited copy file with git add -u, a new one with git add -f, and list the ignored files with git status before each commit to see that nothing of yours is among them.
- Gate before a push: npm run verify, npm run web:build, and npm run design-system:audit. The audit finds each section of the export on its own (its index and first detail page), so a lane never edits it to have its pages checked.

## routing-parity

Every current public path keeps its address in the app: the route table above maps each one to a route that renders at the same path with a trailing slash. No path has to change, so no redirect is needed today.

- Filter links keep working: the hash keys of the current site (year, medal, category_type, style_family, category_name, abv_band, hop_variety, hop_farm_named, hop_farm_grown, region, state, city, fed_district_name, brewery_key, brewery_type, ownership_type, distribution_channel, q, years) are read by the same functions, so a link such as /#year=2024 or /beers/2026/#medal=Gold filters the same way. Page keys in the hash (a dashboard tab, the picked brewery on /dashboards/breweries/) are kept beside them.
- The old stylesheets and scripts under /assets/ are not linked from outside the site and are not carried over.
- If a path must change later, static export cannot answer with a server redirect. Keep a page at the old path whose only content is a meta refresh to the new address (meta http-equiv refresh with a content of 0 and the new URL), a canonical link to the new address, and a plain link for readers without refresh; mark it noindex. GitHub Pages serves 404.html for any address with no page.

## build

A full scale trial with stub pages for every brewery, category, hop, and hop farm route generated 1,679 pages in 7.9 seconds, about 17 seconds for the whole build on a laptop. The dataset loads once per build worker, in under a second.

## open-decisions

- Home: decided by the owner. The home page at / is the one home.md describes (scoresheet, search, headline finding, category index) and reads the same hash filters as before, so /#year=2024 still filters. The Overview dashboard moved to /overview/ and the home page links it.
- Analysis address: the navigation and the CMS call the reports Analysis, but their address is /reports/. The plan keeps /reports/; moving to /analysis/ would need the meta refresh pages above.
- Method and saved views: the CMS holds copy for a Method page and a Saved views page that the static site never built. They are not in any lane until the owner asks for them; the footer links About and the source until then.
- Explorer: decided by the owner. The explorer is retired; its unique features move to /analysis/explore/ with a redirect from /explorer/, both built by the analysis lane.
