// Inline feedback for the review build. Never part of the public site: build-site.mjs adds this
// file only when GABF_FEEDBACK=1, and it refuses to start anywhere but this machine.
//
// A reviewer leaves a note on the whole page or on a spot they pick. A picked spot records the
// element's selector, its visible text, its box, the click point, and the code that renders it;
// the note is posted to the local feedback server, which scans it for secrets and appends it to
// docs/design/design-feedback.jsonl. Open notes come back as numbered pins on the page.

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);
const ENDPOINT = '/review/feedback';

function boot() {
  if (!LOCAL_HOSTS.has(location.hostname)) { console.info('Feedback widget not started: it runs only on this machine.'); return; }
  if (document.querySelector('.gfw-fab')) return;

  const build = (() => { try { return JSON.parse(document.getElementById('gabf-review-build')?.textContent || '{}'); } catch { return {}; } })();
  let sourceMap = [];
  const base = new URL('.', import.meta.url);
  fetch(new URL('source-map.json', base)).then((r) => r.json()).then((m) => { sourceMap = m; }).catch(() => {});

  // ---------- page facts ----------
  const MODES = { site: '', 'site-slow': 'loading', 'site-fail': 'data failure' };
  function route() {
    const m = /^\/(site|site-slow|site-fail)(\/.*)$/.exec(location.pathname);
    return { route: m ? m[2] : location.pathname, served: m ? m[1] : 'site', condition: m ? MODES[m[1]] : '' };
  }
  function parseHash(h) {
    const out = {};
    for (const part of String(h || '').replace(/^#/, '').split('&')) { const [k, v] = part.split('='); if (k) out[decodeURIComponent(k)] = decodeURIComponent(v ?? ''); }
    return out;
  }
  function screenId() {
    try { return window.parent !== window ? window.parent.document.body.dataset.screen || null : null; } catch { return null; }
  }
  function theme() {
    const set = document.documentElement.dataset.theme;
    if (set) return set;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function device() { const w = window.innerWidth; return w < 600 ? 'phone' : w < 1024 ? 'tablet' : 'desktop'; }
  function storedFilters() { try { return JSON.parse(localStorage.getItem('gabf-filters') || 'null'); } catch { return null; } }

  // ---------- element facts ----------
  const STABLE_ATTRS = ['data-figure', 'data-panel', 'data-view', 'data-est-key', 'data-tab', 'data-tab-link', 'data-filter', 'data-remove', 'data-src'];
  const cssEscape = (s) => (window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/[^\w-]/g, '\\$&'));
  function stableOf(el) {
    if (el.id && document.querySelectorAll(`#${cssEscape(el.id)}`).length === 1) return `#${cssEscape(el.id)}`;
    for (const a of STABLE_ATTRS) {
      if (!el.hasAttribute(a)) continue;
      const sel = `${el.tagName.toLowerCase()}[${a}="${String(el.getAttribute(a)).replace(/"/g, '\\"')}"]`;
      if (document.querySelectorAll(sel).length === 1) return sel;
    }
    return null;
  }
  // Prefer an id or a data attribute; otherwise a structural path from the nearest stable ancestor.
  function selectorFor(el) {
    const own = stableOf(el);
    if (own) return own;
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && node !== document.body) {
      const stable = stableOf(node);
      if (stable) { parts.unshift(stable); break; }
      const parent = node.parentElement;
      const same = parent ? [...parent.children].filter((c) => c.tagName === node.tagName) : [];
      parts.unshift(`${node.tagName.toLowerCase()}${same.length > 1 ? `:nth-of-type(${same.indexOf(node) + 1})` : ''}`);
      node = parent;
    }
    if (!parts.length || !parts[0].startsWith('#') && !parts[0].includes('[')) parts.unshift('body');
    return parts.join(' > ');
  }
  function codeFor(el) {
    const found = [];
    const seen = new Set();
    for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
      for (const e of sourceMap) {
        let hit = false;
        try { hit = node.matches(e.selector); } catch { hit = false; }
        const loc = `${e.file}${e.line ? `:${e.line}` : ''} ${e.symbol}`;
        if (hit && !seen.has(loc)) { seen.add(loc); found.push({ location: loc, via: e.selector }); }
      }
      const ds = node.getAttribute && node.getAttribute('data-src');
      if (ds && !seen.has(ds)) { seen.add(ds); found.push({ location: ds, via: 'data-src' }); }
    }
    return found;
  }
  const textOf = (el) => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 240);
  const round = (n) => Math.round(n);
  function boxOf(el) {
    const r = el.getBoundingClientRect();
    return { viewport: { x: round(r.left), y: round(r.top), width: round(r.width), height: round(r.height) }, document: { x: round(r.left + scrollX), y: round(r.top + scrollY), width: round(r.width), height: round(r.height) } };
  }

  // ---------- ui ----------
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const fab = el('button', 'gfw-fab', 'Feedback');
  fab.type = 'button';
  fab.title = 'Leave feedback on this page (Shift+F)';
  fab.setAttribute('aria-keyshortcuts', 'Shift+F');
  const panel = el('aside', 'gfw-panel');
  panel.setAttribute('aria-label', 'Feedback');
  panel.hidden = true;
  const hover = el('div', 'gfw-hover');
  hover.hidden = true;
  const pinLayer = el('div', 'gfw-pins');
  document.body.append(pinLayer, hover, panel, fab);

  let mode = 'page';
  let targeting = false;
  let target = null;
  let categories = [];
  let openNotes = [];

  panel.innerHTML = `<div class="gfw-head"><h2>Feedback</h2><button type="button" class="gfw-close">Close</button></div>
<div class="gfw-modes" role="radiogroup" aria-label="What the note is about"><label><input type="radio" name="gfw-mode" value="page" checked> This whole page</label><label><input type="radio" name="gfw-mode" value="element"> A spot I pick</label></div>
<div class="gfw-target" hidden><button type="button" class="gfw-pick">Pick a spot</button><p class="gfw-target-text">Nothing picked yet.</p></div>
<fieldset class="gfw-cats"><legend>Categories (optional)</legend><div class="gfw-cat-list"></div></fieldset>
<label class="gfw-note">Note<textarea rows="4"></textarea></label>
<div class="gfw-row"><button type="button" class="gfw-send">Send</button><span class="gfw-said" role="status"></span></div>
<div class="gfw-open"></div>`;
  const q = (s) => panel.querySelector(s);

  fetch('/review/categories').then((r) => r.json()).then((d) => {
    categories = d.categories || [];
    q('.gfw-cat-list').innerHTML = categories.map((c) => `<label><input type="checkbox" value="${c.replace(/"/g, '&quot;')}"> ${c.replace(/</g, '&lt;')}</label>`).join('');
  }).catch(() => { q('.gfw-cat-list').textContent = 'Categories unavailable: the feedback server did not answer.'; });

  function setOpen(open) {
    panel.hidden = !open;
    fab.setAttribute('aria-expanded', String(open));
    if (!open) stopTargeting();
    if (open) q('textarea').focus();
  }
  function setMode(next) {
    mode = next;
    q('.gfw-target').hidden = mode !== 'element';
    if (mode === 'element' && !target) startTargeting();
    if (mode === 'page') { target = null; clearDraft(); stopTargeting(); }
  }
  function startTargeting() {
    targeting = true;
    document.documentElement.classList.add('gfw-targeting');
    q('.gfw-target-text').textContent = 'Click the spot the note is about. Escape cancels.';
  }
  function stopTargeting() {
    targeting = false;
    hover.hidden = true;
    document.documentElement.classList.remove('gfw-targeting');
  }
  const inWidget = (node) => node && node.closest && node.closest('.gfw-panel, .gfw-fab, .gfw-pins, .gfw-hover');
  function outline(box, node) {
    const r = box || node.getBoundingClientRect();
    Object.assign(hover.style, { left: `${r.left + scrollX}px`, top: `${r.top + scrollY}px`, width: `${r.width}px`, height: `${r.height}px` });
    hover.hidden = false;
  }
  function clearDraft() { pinLayer.querySelectorAll('.gfw-pin.draft').forEach((p) => p.remove()); }
  function placePin(n, x, y, cls = '', title = '') {
    const pin = el('button', `gfw-pin ${cls}`, String(n));
    pin.type = 'button';
    pin.style.left = `${x}px`;
    pin.style.top = `${y}px`;
    if (title) { pin.title = title; pin.setAttribute('aria-label', `Feedback ${n}: ${title}`); }
    pinLayer.appendChild(pin);
    return pin;
  }

  document.addEventListener('pointermove', (e) => {
    if (!targeting || inWidget(e.target)) return;
    outline(null, e.target);
  }, true);
  document.addEventListener('click', (e) => {
    if (!targeting || inWidget(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    const node = e.target;
    target = {
      selector: selectorFor(node),
      tag: node.tagName.toLowerCase(),
      text: textOf(node),
      box: boxOf(node),
      point: { viewport: { x: round(e.clientX), y: round(e.clientY) }, document: { x: round(e.pageX), y: round(e.pageY) } },
      code: codeFor(node),
      screenshot: null,
    };
    stopTargeting();
    outline(null, node);
    clearDraft();
    placePin('new', e.pageX, e.pageY, 'draft', 'the note you are writing');
    q('.gfw-target-text').textContent = `Picked ${target.selector}${target.text ? `: "${target.text.slice(0, 80)}"` : ''}`;
    q('.gfw-pick').textContent = 'Pick again';
  }, true);
  document.addEventListener('keydown', (e) => {
    const typing = e.target && /^(input|select|textarea)$/i.test(e.target.tagName);
    if (e.key === 'Escape' && targeting) { e.preventDefault(); e.stopPropagation(); stopTargeting(); q('.gfw-target-text').textContent = target ? q('.gfw-target-text').textContent : 'Targeting cancelled. Pick a spot again, or switch to the whole page.'; return; }
    if (e.code === 'KeyF' && e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey && !typing) { e.preventDefault(); e.stopPropagation(); setOpen(panel.hidden); }
  }, true);

  fab.addEventListener('click', () => setOpen(panel.hidden));
  q('.gfw-close').addEventListener('click', () => setOpen(false));
  panel.addEventListener('change', (e) => { if (e.target.name === 'gfw-mode') setMode(e.target.value); });
  q('.gfw-pick').addEventListener('click', startTargeting);

  function payload(text) {
    const r = route();
    return {
      mode,
      text,
      categories: [...panel.querySelectorAll('.gfw-cat-list input:checked')].map((i) => i.value),
      page: { url: location.href, route: r.route, served: r.served, condition: r.condition, hash: location.hash, title: document.title },
      screen: screenId(),
      filters: { hash: parseHash(location.hash), stored: storedFilters() },
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio, scroll: { x: round(scrollX), y: round(scrollY) } },
      device: device(),
      theme: theme(),
      build,
      target: mode === 'element' ? target : null,
      code: mode === 'element' && target ? target.code : [{ location: build.writer || 'unknown', via: 'page writer' }, ...(build.assets || []).map((a) => ({ location: a, via: 'page asset' }))],
    };
  }
  q('.gfw-send').addEventListener('click', () => {
    const text = q('textarea').value.trim();
    const said = q('.gfw-said');
    if (!text) { said.textContent = 'Write a note first.'; return; }
    if (mode === 'element' && !target) { said.textContent = 'Pick a spot first, or switch to the whole page.'; return; }
    said.textContent = 'Sending.';
    fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload(text)) })
      .then((r) => r.json().then((b) => { if (!r.ok) throw new Error(b.error || 'rejected'); return b; }))
      .then((b) => {
        said.textContent = `Recorded as ${b.id}, ticket ${b.ticket}.${b.redacted && b.redacted.length ? ' A value shaped like a secret was removed.' : ''}`;
        q('textarea').value = '';
        panel.querySelectorAll('.gfw-cat-list input:checked').forEach((i) => { i.checked = false; });
        target = null;
        clearDraft();
        hover.hidden = true;
        q('.gfw-target-text').textContent = 'Nothing picked yet.';
        q('.gfw-pick').textContent = 'Pick a spot';
        loadPins();
      })
      .catch((err) => { said.textContent = `Not recorded: ${err.message}. Is the review server running (npm run review)?`; });
  });

  function loadPins() {
    fetch(`${ENDPOINT}?route=${encodeURIComponent(route().route)}`).then((r) => r.json()).then((notes) => {
      openNotes = notes;
      drawPins();
      const box = q('.gfw-open');
      box.innerHTML = notes.length ? `<h3>Open on this page</h3><ol>${notes.map((n) => `<li><b>${n.id}</b> ${n.ticket ? `(${n.ticket}) ` : ''}${String(n.text).replace(/</g, '&lt;').slice(0, 140)}</li>`).join('')}</ol>` : '';
      fab.textContent = notes.length ? `Feedback · ${notes.length}` : 'Feedback';
    }).catch(() => {});
  }
  function drawPins() {
    pinLayer.querySelectorAll('.gfw-pin:not(.draft)').forEach((p) => p.remove());
    for (const n of openNotes) {
      if (!n.target) continue;
      let x = n.target.point?.document?.x;
      let y = n.target.point?.document?.y;
      let node = null;
      try { node = n.target.selector ? document.querySelector(n.target.selector) : null; } catch { node = null; }
      if (node && n.target.box && n.target.point) {
        const b = node.getBoundingClientRect();
        const dx = n.target.point.document.x - n.target.box.document.x;
        const dy = n.target.point.document.y - n.target.box.document.y;
        x = b.left + scrollX + Math.min(Math.max(dx, 0), b.width);
        y = b.top + scrollY + Math.min(Math.max(dy, 0), b.height);
      }
      if (x === undefined) continue;
      const pin = placePin(Number(String(n.id).replace(/\D/g, '')), x, y, node ? '' : 'detached', n.text);
      pin.addEventListener('click', () => { setOpen(true); if (node) outline(null, node); });
    }
  }
  let t = null;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(drawPins, 150); });
  // Client views re-render after data loads; place the pins again once the page settles.
  loadPins();
  setTimeout(drawPins, 1500);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
