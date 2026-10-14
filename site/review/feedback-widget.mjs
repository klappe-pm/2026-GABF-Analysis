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
  const inLayer = (node) => node && node.closest && node.closest('.gfw-layer');

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
  }
  // Only a person's click is a pick: the control plane clicks the Filters button and the estimate
  // mark itself to drive a screen into its state, and those clicks must go through.
  const picks = (e) => picking && e.isTrusted && !inLayer(e.target);
  document.addEventListener('pointermove', (e) => { if (picks(e)) outline(e.target); }, true);
  document.addEventListener('mousedown', (e) => { if (picks(e)) e.preventDefault(); }, true);
  document.addEventListener('click', (e) => {
    if (!picks(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    post({ kind: 'spot', spot: spotFor(e.target, { x: e.pageX, y: e.pageY }) });
  }, true);
  function pickFocused() {
    const node = document.activeElement;
    if (!node || node === document.body || node === document.documentElement) { post({ kind: 'nothing-focused' }); return; }
    post({ kind: 'spot', spot: spotFor(node, null) });
  }
  document.addEventListener('keydown', (e) => {
    const typing = e.target && /^(input|select|textarea)$/i.test(e.target.tagName);
    if (e.key === 'Escape') { post({ kind: 'escape' }); return; }
    if (picking && e.key === 'Enter' && e.shiftKey) { e.preventDefault(); e.stopPropagation(); pickFocused(); return; }
    if (e.code === 'KeyF' && e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey && !typing) { e.preventDefault(); e.stopPropagation(); post({ kind: 'toggle' }); }
  }, true);

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
