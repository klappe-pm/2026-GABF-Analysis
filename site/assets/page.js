// Shared page behavior: tooltips for chart marks, sortable tables, theme toggle.
(function () {
  const root = document.documentElement;
  const stored = (() => { try { return localStorage.getItem('gabf-theme'); } catch (e) { return null; } })();
  if (stored === 'dark' || stored === 'light') root.setAttribute('data-theme', stored);
  const toggle = document.querySelector('.theme-toggle');
  if (toggle) {
    const sync = () => { toggle.textContent = root.getAttribute('data-theme') === 'dark' ? 'Light mode' : 'Dark mode'; };
    sync();
    toggle.addEventListener('click', () => {
      const current = root.getAttribute('data-theme') === 'dark' ? 'dark' : (root.getAttribute('data-theme') === 'light' ? 'light' : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
      const next = current === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('gabf-theme', next); } catch (e) { /* storage unavailable */ }
      sync();
    });
  }

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
    const val = (tr) => tr.cells[idx] ? tr.cells[idx].textContent.trim() : '';
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
  document.querySelectorAll('table.sortable').forEach((table) => {
    Array.from(table.tHead ? table.tHead.rows[0].cells : []).forEach((th, idx) => {
      th.addEventListener('click', () => {
        const numeric = th.classList.contains('num');
        const current = th.getAttribute('aria-sort');
        const dir = current === 'descending' ? 'asc' : 'desc';
        Array.from(th.parentNode.cells).forEach((c) => c.removeAttribute('aria-sort'));
        th.setAttribute('aria-sort', dir === 'asc' ? 'ascending' : 'descending');
        sortTable(table, idx, numeric, dir);
      });
    });
  });
})();
