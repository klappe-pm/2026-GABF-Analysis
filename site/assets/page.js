// Shared page behavior: tooltips for chart marks, sortable tables.
(function () {
  // Phone header: the site nav folds behind a Menu button.
  const navToggle = document.querySelector('.nav-toggle');
  if (navToggle) {
    const header = navToggle.closest('.site-header');
    navToggle.addEventListener('click', () => {
      const open = navToggle.getAttribute('aria-expanded') !== 'true';
      navToggle.setAttribute('aria-expanded', String(open));
      header.classList.toggle('open', open);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && header.classList.contains('open')) { header.classList.remove('open'); navToggle.setAttribute('aria-expanded', 'false'); navToggle.focus(); }
    });
  }

  // Sortable headers carry tabindex 0; Enter or Space sorts like a click (static and dashboard tables).
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const th = e.target.closest ? e.target.closest('table.sortable thead th') : null;
    if (!th) return;
    e.preventDefault();
    th.click();
  });

  const tip = document.createElement('div');
  tip.className = 'tooltip';
  tip.setAttribute('role', 'status');
  document.body.appendChild(tip);
  let active = null;
  function show(el, x, y) {
    const text = el.getAttribute('data-tip');
    if (!text) return;
    tip.textContent = text;
    tip.classList.add('show');
    const pad = 12;
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    let left = x + pad;
    let top = y + pad;
    if (left + w > window.innerWidth - 8) left = x - w - pad;
    if (top + h > window.innerHeight - 8) top = y - h - pad;
    tip.style.left = `${Math.max(4, left)}px`;
    tip.style.top = `${Math.max(4, top)}px`;
    active = el;
  }
  function hide() { tip.classList.remove('show'); active = null; }
  document.addEventListener('pointermove', (e) => {
    const mark = e.target.closest ? e.target.closest('[data-tip]') : null;
    if (mark) show(mark, e.clientX, e.clientY);
    else if (active) hide();
  });
  document.addEventListener('focusin', (e) => {
    const mark = e.target.closest ? e.target.closest('[data-tip]') : null;
    if (mark) {
      const r = mark.getBoundingClientRect();
      show(mark, r.left + r.width / 2, r.top);
    }
  });
  document.addEventListener('focusout', hide);
  document.addEventListener('scroll', hide, { passive: true });

  function sortTable(table, idx, numeric, dir) {
    const tbody = table.tBodies[0];
    const rows = Array.from(tbody.rows);
    // A cell may carry its own sort key (the G-S-B column sorts by total medals, then gold).
    const val = (tr) => { const c = tr.cells[idx]; if (!c) return ''; return c.hasAttribute('data-sort') ? c.getAttribute('data-sort') : c.textContent.trim(); };
    rows.sort((a, b) => {
      const va = val(a); const vb = val(b);
      if (numeric) {
        const na = parseFloat(va.replace(/[^0-9.-]/g, '')); const nb = parseFloat(vb.replace(/[^0-9.-]/g, ''));
        const aa = Number.isNaN(na) ? -Infinity : na; const bb = Number.isNaN(nb) ? -Infinity : nb;
        return dir === 'asc' ? aa - bb : bb - aa;
      }
      return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    rows.forEach((r) => tbody.appendChild(r));
  }
  // Delegated, so tables drawn after load (filtered views, dashboards) sort too.
  document.addEventListener('click', (e) => {
    const th = e.target.closest ? e.target.closest('table.sortable thead th') : null;
    if (!th) return;
    const table = th.closest('table');
    const idx = Array.from(th.parentNode.cells).indexOf(th);
    const dir = th.getAttribute('aria-sort') === 'descending' ? 'asc' : 'desc';
    Array.from(th.parentNode.cells).forEach((c) => c.removeAttribute('aria-sort'));
    th.setAttribute('aria-sort', dir === 'asc' ? 'ascending' : 'descending');
    sortTable(table, idx, th.classList.contains('num'), dir);
  });
})();
