// Which design system component draws a region of a rendered page: a selector into the page and the folder
// name of the component under .design/design-system/components/. The widget reports every entry whose
// selector matches the picked element or one of its ancestors, innermost first, and the review server turns
// each name into a link to the component's spec and an Open in Obsidian link. A name with no spec file stays
// plain words. This is a map, not a marking, so it is approximate: a more exact link would need each
// component to carry its own name in the page.
export const COMPONENT_MAP = [
  { selector: 'figure[aria-labelledby$="-title"]', component: 'chart-card' },
  { selector: 'figure[aria-labelledby$="-label"]', component: 'range-scale' },
  { selector: 'article:has(h1, h2, h3)', component: 'beer-profile-card' },
  { selector: 'aside[aria-label]', component: 'callout' },
  { selector: 'table', component: 'data-table' },
  { selector: 'dl > div:has(> dt)', component: 'stat-card' },
  { selector: '[role=status][aria-live=polite]', component: 'state-card' },
  { selector: '[role=img][aria-label]', component: 'medal-record' },
  { selector: 'nav[data-nav=tabs]', component: 'tabs' },
  { selector: 'nav[aria-label] > ol', component: 'breadcrumb' },
  { selector: 'section[aria-label]:has(md-input-chip, md-assist-chip, md-filter-chip)', component: 'filter-chips' },
  { selector: 'dialog', component: 'filters-dialog' },
  { selector: 'md-outlined-select, md-filled-select', component: 'select' },
  { selector: 'md-checkbox', component: 'checkbox' },
  { selector: 'md-outlined-text-field, md-filled-text-field', component: 'search-field' },
  { selector: 'md-filled-button, md-outlined-button, md-text-button, md-filled-tonal-button', component: 'button' },
  { selector: 'a[data-state]', component: 'text-link' },
  { selector: 'header.pb-3', component: 'section-header' },
  { selector: 'header:has(> a.sr-only)', component: 'page-header' },
  { selector: 'footer', component: 'footer' },
  { selector: 'nav[data-nav=rail]', component: 'navigation-rail' },
  { selector: 'nav[data-nav=drawer]', component: 'navigation-drawer' },
];
