// The (E) mark: a small button beside every estimated figure that opens a popover explaining how
// that brewery's estimate was made (its inputs and the formula in plain words). One popover element
// serves the page; content is looked up per brewery when the mark is opened. Works by click, tap,
// Enter, or Space; closes on Escape (returning focus to the mark) or a click outside.

import { esc } from './charts.mjs';
import { tx } from './site-text.mjs';

// Each metric's name as the copy writes it inside a sentence (pages/brewery-detail.md estimates); the
// popover title capitalizes it.
const METRIC_NAMES = {
  barrels: () => tx('pages.brewery-detail.estimates.metric_barrels', 'barrels per year'),
  arr: () => tx('pages.brewery-detail.estimates.metric_arr', 'annual revenue (ARR)'),
  gross_margin: () => tx('pages.brewery-detail.estimates.metric_gross_margin', 'gross margin'),
  ebitda: () => tx('pages.brewery-detail.estimates.metric_ebitda', 'EBITDA'),
  per_barrel: () => tx('pages.brewery-detail.estimates.metric_per_barrel', 'revenue per barrel'),
  per_location: () => tx('pages.brewery-detail.estimates.metric_per_location', 'revenue per location'),
  per_employee: () => tx('pages.brewery-detail.estimates.metric_per_employee', 'revenue per employee'),
};
const metricName = (metric) => METRIC_NAMES[metric]?.() ?? 'figure';
const metricTitle = (metric) => (METRIC_NAMES[metric] ? metricName(metric).replace(/^\w/, (c) => c.toUpperCase()) : 'Estimate');

export function estMark(key, metric) {
  const marker = tx('global.states.estimates.marker', '(E)');
  const label = tx('pages.brewery-detail.estimates.mark_label', 'Estimate. How the {{metric}} estimate was made', { metric: metricName(metric) });
  return `<button type="button" class="est-mark" data-est-key="${esc(key)}" data-est-metric="${esc(metric)}" aria-haspopup="dialog" aria-expanded="false" aria-controls="est-popover"><span aria-hidden="true">${esc(marker)}</span><span class="visually-hidden">${esc(label)}</span></button>`;
}

// ex: { name, text: { metric: sentence }, inputs: [[label, value]] } built at site build time.
export function explainHtml(ex, metric, aboutHref) {
  const text = ex.text?.[metric] ?? ex.text?.arr ?? '';
  return `<p class="est-pop-title" id="est-popover-title">${esc(metricTitle(metric))}: how it was estimated</p>
<p>${esc(text)}</p>
<dl class="est-inputs">${(ex.inputs ?? []).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
<p class="est-pop-foot"><strong>${esc(tx('pages.brewery-detail.estimates.foot', 'Estimate, not reported.'))}</strong> <a href="${esc(aboutHref)}">How the estimates are made</a></p>`;
}

export function installEstimates({ lookup, aboutHref }) {
  if (typeof document === 'undefined' || document.getElementById('est-popover')) return;
  const pop = document.createElement('div');
  pop.id = 'est-popover';
  pop.className = 'est-popover';
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-labelledby', 'est-popover-title');
  pop.tabIndex = -1;
  pop.hidden = true;
  document.body.appendChild(pop);
  let owner = null;

  function place() {
    if (!owner) return;
    const r = owner.getBoundingClientRect();
    const w = Math.min(340, window.innerWidth - 32);
    pop.style.width = `${w}px`;
    const left = Math.max(16, Math.min(r.left, window.innerWidth - w - 16));
    pop.style.left = `${left + window.scrollX}px`;
    const below = r.bottom + 8 + window.scrollY;
    pop.style.top = `${below}px`;
  }
  function close({ focus = false } = {}) {
    if (!owner) return;
    owner.setAttribute('aria-expanded', 'false');
    const b = owner;
    owner = null;
    pop.hidden = true;
    if (focus) b.focus();
  }
  async function open(btn) {
    if (owner) close();
    owner = btn;
    btn.setAttribute('aria-expanded', 'true');
    pop.innerHTML = '<p>Loading…</p>';
    pop.hidden = false;
    place();
    try {
      const ex = await lookup(btn.dataset.estKey);
      if (owner !== btn) return;
      pop.innerHTML = ex ? explainHtml(ex, btn.dataset.estMetric, aboutHref) : '<p>No explanation is available for this estimate.</p>';
    } catch (e) {
      pop.innerHTML = '<p>The explanation could not be loaded. Reload the page to try again.</p>';
    }
    place();
    pop.focus();
  }
  document.addEventListener('click', (e) => {
    const btn = e.target.closest ? e.target.closest('.est-mark') : null;
    if (btn) { e.preventDefault(); if (owner === btn) close({ focus: true }); else open(btn); return; }
    if (owner && (!pop.contains(e.target) || (e.target.closest && e.target.closest('a')))) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && owner) { e.preventDefault(); close({ focus: true }); }
  });
  window.addEventListener('resize', () => close());
}
