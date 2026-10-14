// The page side of review, for the review build only. It never reaches the public site:
// build-site.mjs adds this file only when GABF_FEEDBACK=1, and it refuses to start anywhere but
// this machine.
//
// It has no button and no panel. The design control plane owns the one Feedback entry point and
// the panel; this script, running inside the framed page, does three things for it:
//
//   picking   while the panel is open, a click on the page is not followed but reported as a spot:
//             the element's selector, visible text, box, click point, and the code that draws it
//   pins      the numbered square pins for the spots the panel lists, kept on their elements
//   markers   a square outline with a small label around the region the journey step concerns,
//             and around the control a hovered action chip acts on
//   editing   with the panel open, text that is one line of page copy can be edited in place:
//             double click it, or focus it and press Enter. Save writes through the server's copy
//             edit (the same check, write, related instances and ticket as the panel), then the
//             page reloads on the rebuilt site. Text with no copy entry says why it cannot be edited.
//
// Messages cross between the two windows on this origin only.

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);
const FROM_PAGE = 'gabf-review';
const FROM_SHELL = 'gabf-control-plane';

function boot() {
  if (!LOCAL_HOSTS.has(location.hostname)) { console.info('Page picker not started: it runs only on this machine.'); return; }
  if (document.querySelector('.gfw-layer')) return;
  const screen = screenId();
  // Only the control plane's frame is reviewed; a page opened on its own has nothing to pick for.
  if (!screen || window.top === window) return;

  const build = (() => { try { return JSON.parse(document.getElementById('gabf-review-build')?.textContent || '{}'); } catch { return {}; } })();
  let sourceMap = [];
  let regions = { screens: {}, controls: {} };
  const base = new URL('.', import.meta.url);
  fetch(new URL('source-map.json', base)).then((r) => r.json()).then((m) => { sourceMap = m; }).catch(() => {});
  fetch('/review/regions').then((r) => r.json()).then((r) => { regions = r; schedule(true); }).catch(() => {});

  // ---------- facts ----------
  function screenId() {
    try { return window.parent !== window ? window.parent.document.body.dataset.screen || null : null; } catch { return null; }
  }
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
  // The source map entries that match the element or one of its ancestors, innermost first, then
  // the nearest data-src the build wrote. The server turns each selector into a component.
  function codeFor(el) {
    const found = [];
    const seen = new Set();
    for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
      for (const e of sourceMap) {
        let hit = false;
        try { hit = node.matches(e.selector); } catch { hit = false; }
        const loc = `${e.file}${e.line ? `:${e.line}` : ''} ${e.symbol}`;
        if (hit && !seen.has(loc)) { seen.add(loc); found.push({ location: loc, via: e.selector, instance: stableOf(node) || selectorFor(node) }); }
      }
      const ds = node.getAttribute && node.getAttribute('data-src');
      if (ds && !seen.has(ds)) { seen.add(ds); found.push({ location: ds, via: 'data-src' }); }
    }
    return found;
  }
  const textOf = (el) => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 240);
  const round = (n) => Math.round(n);
  function docRect(el) {
    const r = el.getBoundingClientRect();
    return { x: round(r.left + scrollX), y: round(r.top + scrollY), width: round(r.width), height: round(r.height) };
  }
  function spotFor(node, point) {
    const rect = docRect(node);
    const at = point ?? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    const code = codeFor(node);
    return {
      selector: selectorFor(node),
      tag: node.tagName.toLowerCase(),
      text: textOf(node),
      rect,
      point: { x: round(at.x), y: round(at.y) },
      offset: { dx: round(at.x - rect.x), dy: round(at.y - rect.y) },
      matches: code.map((c) => ({ via: c.via, location: c.location, instance: c.instance || null })),
    };
  }

  // ---------- the layer ----------
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const layer = el('div', 'gfw-layer');
  layer.setAttribute('aria-hidden', 'true');
  const hover = el('div', 'gfw-hover');
  hover.hidden = true;
  const marker = el('div', 'gfw-region');
  marker.hidden = true;
  const markerLabel = el('span', 'gfw-region-label');
  marker.append(markerLabel);
  layer.append(marker, hover);
  document.body.append(layer);

  const post = (message) => { try { window.top.postMessage({ source: FROM_PAGE, screen, ...message }, location.origin); } catch { /* the shell is gone */ } };
  const inLayer = (node) => node && node.closest && node.closest('.gfw-layer, .gfw-editor-host');

  let picking = false;
  let pins = [];
  let control = null;
  let scrolledFor = null;

  // ---------- the step marker ----------
  function firstVisible(selector) {
    let list = [];
    try { list = [...document.querySelectorAll(selector)]; } catch { list = []; }
    return list.find((n) => { const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0; }) ?? null;
  }
  function placeMarker(allowScroll) {
    const region = control ? { selector: control.selector, name: control.label } : regions.screens[screen];
    if (!region || !region.selector) { marker.hidden = true; return; }
    const node = firstVisible(region.selector);
    if (!node) { marker.hidden = true; return; }
    const r = node.getBoundingClientRect();
    Object.assign(marker.style, { left: `${r.left + scrollX}px`, top: `${r.top + scrollY}px`, width: `${r.width}px`, height: `${r.height}px` });
    markerLabel.textContent = `${screen} ${region.name || ''}`.trim();
    // The label sits above the frame; below it when the frame is at the top edge, and right aligned when it would run off the page.
    markerLabel.classList.toggle('below', r.top + scrollY < 32);
    markerLabel.classList.toggle('right', false);
    markerLabel.classList.toggle('right', r.left + markerLabel.offsetWidth > document.documentElement.clientWidth - 4 && r.right - markerLabel.offsetWidth > 0);
    marker.hidden = false;
    // The region may sit below the first screenful; bring it into view once per screen.
    if (allowScroll && scrolledFor !== screen && !control) {
      scrolledFor = screen;
      if (r.top > innerHeight * 0.7 || r.bottom < 0) window.scrollTo({ top: Math.max(0, r.top + scrollY - innerHeight * 0.25), behavior: 'auto' });
    }
  }

  // ---------- pins ----------
  function drawPins() {
    layer.querySelectorAll('.gfw-pin').forEach((p) => p.remove());
    for (const p of pins) {
      let node = null;
      try { node = p.selector ? document.querySelector(p.selector) : null; } catch { node = null; }
      let x = p.point?.x;
      let y = p.point?.y;
      if (node && p.offset) {
        const b = node.getBoundingClientRect();
        x = b.left + scrollX + Math.min(Math.max(p.offset.dx, 0), b.width);
        y = b.top + scrollY + Math.min(Math.max(p.offset.dy, 0), b.height);
      }
      if (x === undefined) continue;
      const pin = el('button', `gfw-pin${node ? '' : ' detached'}${y < 30 ? ' below' : ''}`, String(p.n));
      pin.type = 'button';
      pin.style.left = `${x}px`;
      pin.style.top = `${y}px`;
      pin.setAttribute('aria-label', `Spot ${p.n}`);
      pin.addEventListener('click', (e) => { e.stopPropagation(); post({ kind: 'pin', n: p.n }); });
      layer.append(pin);
    }
  }

  let timer = null;
  function schedule(allowScroll = false) {
    clearTimeout(timer);
    timer = setTimeout(() => { placeMarker(allowScroll); drawPins(); }, 90);
    if (picking) scanSoon();
  }
  window.addEventListener('resize', () => schedule());
  window.addEventListener('load', () => schedule(true));
  if ('ResizeObserver' in window) new ResizeObserver(() => schedule()).observe(document.documentElement);
  // Client views render after the data arrives; place everything again once the page settles.
  new MutationObserver((records) => { if (records.some((r) => !inLayer(r.target))) schedule(true); }).observe(document.body, { childList: true, subtree: true });

  // ---------- picking ----------
  function outline(node) {
    const r = node.getBoundingClientRect();
    Object.assign(hover.style, { left: `${r.left + scrollX}px`, top: `${r.top + scrollY}px`, width: `${r.width}px`, height: `${r.height}px` });
    hover.hidden = false;
  }
  function setPicking(on) {
    picking = on;
    hover.hidden = true;
    document.documentElement.classList.toggle('gfw-picking', on);
    if (on) scanSoon(); else { clearTimeout(scanTimer); scanRun += 1; scanning = false; cancelEdit(false); unmark(); tip.hidden = true; }
  }
  // Only a person's click is a pick: the control plane clicks the Filters button and the estimate
  // mark itself to drive a screen into its state, and those clicks must go through.
  const picks = (e) => picking && e.isTrusted && !inLayer(e.target);
  document.addEventListener('pointermove', (e) => { if (picks(e) && !editing) { outline(e.target); tipFor(e.target); } }, true);
  document.addEventListener('mousedown', (e) => { if (picks(e)) e.preventDefault(); }, true);
  // A double click on page copy edits it, so the pin its first click would add waits for the second
  // click to rule that out. Text that is not page copy pins at once, as before.
  let pendingPin = null;
  document.addEventListener('click', (e) => {
    if (!picks(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    const target = e.target;
    if (e.detail >= 2) {
      clearTimeout(pendingPin);
      pendingPin = null;
      if (keyed.has(target)) startEdit(target); else tipFor(target, true);
      return;
    }
    const spot = spotFor(target, { x: e.pageX, y: e.pageY });
    // Page copy, or text the scan has not answered for yet, may be the first half of a double click.
    if (!keyed.has(target) && !(scanning && isTextLeaf(target))) { post({ kind: 'spot', spot }); return; }
    clearTimeout(pendingPin);
    pendingPin = setTimeout(() => { pendingPin = null; post({ kind: 'spot', spot }); }, 260);
  }, true);
  function pickFocused() {
    const node = document.activeElement;
    if (!node || node === document.body || node === document.documentElement) { post({ kind: 'nothing-focused' }); return; }
    post({ kind: 'spot', spot: spotFor(node, null) });
  }
  document.addEventListener('keydown', (e) => {
    const typing = e.target && /^(input|select|textarea)$/i.test(e.target.tagName);
    if (editing && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelEdit(true); return; }
    if (e.key === 'Escape') { post({ kind: 'escape' }); return; }
    if (picking && !typing && !editing && e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey && e.target !== document.body && !inLayer(e.target)) {
      if (keyed.has(e.target)) { e.preventDefault(); e.stopPropagation(); startEdit(e.target); return; }
      if (isTextLeaf(e.target)) tipFor(e.target, true);
    }
    if (picking && e.key === 'Enter' && e.shiftKey) { e.preventDefault(); e.stopPropagation(); pickFocused(); return; }
    if (e.code === 'KeyF' && e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey && !typing) { e.preventDefault(); e.stopPropagation(); post({ kind: 'toggle' }); }
  }, true);

  // ---------- editing page copy in place ----------
  const norm = (t) => String(t ?? '').replace(/\s+/g, ' ').trim();
  const api = (path, body) => fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(async (r) => {
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const err = new Error(j.error || 'The server refused the request.'); err.problems = j.problems; throw err; }
    return j;
  });
  const words = (key) => { const last = String(key).split('.').slice(-2).join(' ').replace(/[-_]+/g, ' '); return last.charAt(0).toUpperCase() + last.slice(1); };
  const NOT_COPY = 'Not page copy, so it cannot be edited here. It comes from the data or the page layout.';
  const IS_COPY = 'Page copy. Double click it, or press Enter, to edit it here.';
  const keyed = new Map();
  const known = new Map();
  let editing = null;
  let scanTimer = null;
  let scanRun = 0;
  let scanning = false;
  let reported = false;
  const tip = el('div', 'gfw-tip');
  tip.hidden = true;
  tip.setAttribute('role', 'status');
  layer.append(tip);

  const SKIP = /^(SCRIPT|STYLE|NOSCRIPT|TITLE|OPTION|CANVAS|INPUT|SELECT|TEXTAREA|SVG)$/i;
  function isTextLeaf(n) {
    if (!n || n.nodeType !== 1 || n.children.length || inLayer(n) || SKIP.test(n.tagName) || n.closest('svg')) return false;
    const t = norm(n.textContent);
    return t.length >= 2 && t.length <= 240 && n.getClientRects().length > 0;
  }
  function leaves() {
    const out = [];
    for (const n of document.body.querySelectorAll('*')) if (isTextLeaf(n)) out.push([n, norm(n.textContent)]);
    return out.slice(0, 1500);
  }
  function unmark() {
    keyed.clear();
    document.querySelectorAll('.gfw-editable').forEach((n) => { n.classList.remove('gfw-editable'); if (n.hasAttribute('data-gfw-tab')) { n.removeAttribute('data-gfw-tab'); n.removeAttribute('tabindex'); } });
  }
  function scanSoon() { clearTimeout(scanTimer); scanning = true; scanTimer = setTimeout(scan, 250); }
  // Marks every text the server knows to be page copy. Each answered chunk is marked at once, so a
  // slow server shows editable text as it arrives, and a newer scan replaces an older one instead
  // of racing it.
  function mark(list) {
    unmark();
    for (const [n, t] of list) {
      const info = known.get(t);
      if (!info) continue;
      keyed.set(n, info);
      n.classList.add('gfw-editable');
      if (!n.matches('a[href], button, [tabindex]')) { n.setAttribute('tabindex', '0'); n.setAttribute('data-gfw-tab', '1'); }
    }
  }
  // Tells the control plane panel, in plain words, that in place editing is unavailable (or fine again).
  function problem(message) { if (message || reported) post({ kind: 'inline-problem', message }); reported = Boolean(message); }
  async function scan() {
    if (!picking || editing) { scanning = false; return; }
    const run = ++scanRun;
    scanning = true;
    try {
      const list = leaves();
      const need = [...new Set(list.map(([, t]) => t).filter((t) => !known.has(t)))];
      for (let i = 0; i < need.length; i += 300) {
        const chunk = need.slice(i, i + 300);
        const res = await api('/review/inline/resolve', { screen, texts: chunk });
        for (const t of chunk) known.set(t, res[t] ?? null);
        if (run !== scanRun || !picking || editing) return;
        mark(list);
      }
      if (run !== scanRun || !picking || editing) return;
      mark(list);
      problem('');
    } catch (err) {
      if (run === scanRun) problem(`Editing text on the page is not available: ${err && err.message ? err.message : 'the review server did not answer'}. Reload the page, or restart the review server.`);
    } finally {
      if (run === scanRun) scanning = false;
    }
  }
  function tipFor(node, force) {
    if (!picking || editing || !node || node.nodeType !== 1 || inLayer(node)) { tip.hidden = true; return; }
    const isCopy = keyed.has(node);
    if (!isCopy && !(isTextLeaf(node) && known.has(norm(node.textContent)))) { tip.hidden = true; return; }
    tip.textContent = isCopy ? IS_COPY : NOT_COPY;
    tip.classList.toggle('no', !isCopy);
    const r = node.getBoundingClientRect();
    tip.style.left = `${Math.max(4, r.left + scrollX)}px`;
    tip.style.top = `${r.top + scrollY}px`;
    tip.classList.toggle('below', r.top < 40);
    tip.hidden = false;
    if (force) { clearTimeout(tip._t); tip._t = setTimeout(() => { tip.hidden = true; }, 3500); }
  }
  document.addEventListener('focusin', (e) => { if (picking && !editing && !inLayer(e.target)) tipFor(e.target); }, true);
  document.addEventListener('focusout', () => { if (!editing) tip.hidden = true; }, true);

  function cancelEdit(refocus) {
    if (!editing) return;
    const { node, host } = editing;
    clearTimeout(editing.check);
    host.remove();
    node.classList.remove('gfw-editing');
    editing = null;
    if (refocus) { try { node.focus({ preventScroll: true }); } catch { /* not focusable */ } }
  }

  async function startEdit(node) {
    const info = keyed.get(node);
    if (!info) return;
    cancelEdit(false);
    hover.hidden = true;
    tip.hidden = true;
    const spot = spotFor(node, null);
    const r = node.getBoundingClientRect();
    const cs = getComputedStyle(node);
    const host = el('div', 'gfw-editor-host');
    host.setAttribute('role', 'group');
    host.setAttribute('aria-label', 'Edit this text');
    const left = Math.max(4, r.left + scrollX);
    const width = Math.min(Math.max(r.width + 16, 240), document.documentElement.clientWidth - left - 12);
    Object.assign(host.style, { left: `${left}px`, top: `${r.top + scrollY - 3}px`, width: `${Math.max(width, 160)}px` });
    // Near the bottom edge the controls would fall out of view, so the field sits at the bottom of
    // the editor and Save, Cancel and the notes stack above it.
    const place = () => {
      const below = r.bottom + 190 > innerHeight && r.top > 190;
      host.classList.toggle('above', below);
      host.style.top = `${below ? r.bottom + scrollY + 3 - host.offsetHeight : r.top + scrollY - 3}px`;
    };
    const input = el('input', 'gfw-editor-input');
    input.type = 'text';
    input.value = info.value;
    input.setAttribute('aria-label', 'New text');
    Object.assign(input.style, { height: `${Math.max(r.height + 6, 34)}px`, font: cs.font, letterSpacing: cs.letterSpacing });
    const message = el('p', 'gfw-editor-msg');
    message.setAttribute('role', 'alert');
    const related = el('div', 'gfw-editor-related');
    const bar = el('div', 'gfw-editor-bar');
    const saveBtn = el('button', 'gfw-editor-save', 'Save');
    saveBtn.type = 'button';
    const cancelBtn = el('button', 'gfw-editor-cancel', 'Cancel');
    cancelBtn.type = 'button';
    bar.append(saveBtn, cancelBtn);
    host.append(input, bar, message, related);
    document.body.append(host);
    node.classList.add('gfw-editing');
    place();
    const state = { node, host, info, spot, input, take: {}, busy: false, check: null, problems: [] };
    editing = state;
    input.focus();
    input.select();

    const say = (text, bad) => { message.textContent = text; message.classList.toggle('bad', Boolean(bad)); place(); };
    const changed = () => input.value !== info.value;
    if (/\{\{/.test(info.value)) say('Words in double braces are filled in by the page.');
    api('/review/content', { key: info.key }).then((p) => {
      if (editing !== state || !p.instances || !p.instances.length) return;
      related.append(el('p', 'gfw-editor-where', `The same words also appear in ${p.instances.length} other place${p.instances.length === 1 ? '' : 's'}. Checked ones change too.`));
      const ul = el('ul', 'gfw-editor-list');
      for (const i of p.instances) {
        state.take[i.id] = true;
        const cb = el('input');
        cb.type = 'checkbox';
        cb.checked = true;
        cb.addEventListener('change', () => { state.take[i.id] = cb.checked; });
        const label = el('label', 'gfw-editor-check');
        label.append(cb, document.createTextNode(i.kind === 'copy' ? `Copy entry: ${words(i.key)}` : `Page code: ${i.file.split('/').slice(-1)[0]}, line ${i.line}`));
        const li = el('li');
        li.append(label);
        ul.append(li);
      }
      related.append(ul);
      place();
    }).catch(() => {});

    input.addEventListener('input', () => {
      clearTimeout(state.check);
      state.check = setTimeout(() => {
        if (editing !== state || !changed()) { state.problems = []; say(''); saveBtn.disabled = false; return; }
        api('/review/content', { key: info.key, newValue: input.value }).then((p) => {
          if (editing !== state) return;
          state.problems = p.problems || [];
          say(state.problems[0] || '', Boolean(state.problems.length));
          saveBtn.disabled = Boolean(state.problems.length);
        }).catch(() => {});
      }, 250);
    });
    async function save() {
      if (editing !== state || state.busy) return;
      if (!changed()) { say('Nothing changed.'); return; }
      state.busy = true;
      saveBtn.disabled = true;
      say('Saving and rebuilding the page.');
      try {
        const r2 = await api('/review/inline/save', {
          screen, key: info.key, newValue: input.value, take: Object.keys(state.take).filter((k) => state.take[k]), spot,
          device: innerWidth < 600 ? 'phone' : innerWidth < 1024 ? 'tablet' : 'desktop',
          viewport: { width: innerWidth, height: innerHeight }, build,
        });
        post({ kind: 'inline-saved', id: r2.id, rebuilt: r2.rebuilt });
        if (r2.rebuilt) { say(`Saved as ${r2.id}. Reloading the page.`); setTimeout(() => location.reload(), 150); }
        else say(`Saved as ${r2.id}, but the page could not be rebuilt. Rebuild the review site to see it.`, true);
      } catch (err) {
        state.busy = false;
        saveBtn.disabled = false;
        say((err.problems && err.problems[0]) || err.message, true);
      }
    }
    saveBtn.addEventListener('click', save);
    cancelBtn.addEventListener('click', () => cancelEdit(true));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); save(); } });
  }

  // ---------- the control plane talks to the page ----------
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin || !e.data || e.data.source !== FROM_SHELL) return;
    const d = e.data;
    if (d.kind === 'state') { setPicking(Boolean(d.picking)); pins = Array.isArray(d.pins) ? d.pins : []; drawPins(); }
    else if (d.kind === 'control') {
      const hit = d.label ? regions.controls[d.label] : null;
      control = hit ? { selector: hit.selector, label: d.label } : null;
      placeMarker(false);
    } else if (d.kind === 'pick-focused') pickFocused();
    else if (d.kind === 'reveal' && d.selector) { const n = firstVisible(d.selector); if (n) { outline(n); n.scrollIntoView({ block: 'center' }); setTimeout(() => { hover.hidden = true; }, 1600); } }
  });

  post({ kind: 'ready', route: location.pathname.replace(/^\/(site|site-slow|site-fail)/, '') || '/', hash: location.hash, title: document.title, width: innerWidth, height: innerHeight, dpr: devicePixelRatio, build });
  schedule(true);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
