// The Feedback entry of the design control plane. The control plane's shell calls render() when its side panel is
// drawn in feedback mode and opened() when that panel opens or closes, and chip() for each entry of its "Made of"
// lists. Feedback itself is taken by the review widget inside the framed page (the host page's review widget in the web
// review build): its panel, the pins, the in place copy editor and the review settings panel all run there, and the
// ticket is filed against the journey step this screen is. This file opens and closes that panel, and links each
// component in the "Made of" lists to its design system file.
(function () {
  'use strict';
  var TO_PAGE = 'gabf-control-plane';
  var lists = null;

  // ---------- small helpers ----------
  function h(tag, attrs) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'class') n.className = attrs[k];
      else if (attrs[k] !== false && attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    });
    for (var i = 2; i < arguments.length; i++) { var c = arguments[i]; if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }
    return n;
  }
  function api(method, path) {
    return fetch(path).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'rejected'); return j; }); });
  }
  var words = function (s) { s = String(s).replace(/[-_]+/g, ' ').trim(); return s.charAt(0).toUpperCase() + s.slice(1); };

  // The design system file behind a component name, when the review server knows one. The lists come from the
  // server once.
  var listsPending = null;
  function loadLists() {
    if (lists) return Promise.resolve(lists);
    if (!listsPending) listsPending = api('GET', '/review/lists').then(function (r) { lists = r; return r; }).catch(function () { listsPending = null; return null; });
    return listsPending;
  }
  function listed(name) {
    return lists ? lists.components.filter(function (c) { return c.name === name; })[0] || null : null;
  }
  function openLinks(c, label) {
    return [
      h('a', { class: 'fbp-open', href: c.view, target: '_blank', rel: 'noopener', 'aria-label': label + ', opens the design system file in a new tab', text: label }),
      h('a', { class: 'fbp-obsidian', href: c.obsidian }, 'Open in Obsidian', h('span', { class: 'fbp-sr', text: ': ' + label }))
    ];
  }
  function componentParts(c) {
    var label = words(c.name);
    if (!c.spec || !c.view) return [h('span', { class: 'fbp-nolink', text: label }), h('small', { class: 'fbp-nofile', text: 'No design system file yet' })];
    return openLinks(c, label);
  }

  // ---------- the widget in the framed page ----------
  // The shell frames a screen page, which frames the live page: the widget lives in the innermost window.
  function livePage(context) {
    try {
      var screen = context && context.frame && context.frame.contentDocument;
      var live = screen && screen.querySelector('.dcp-live-frame');
      return live ? live.contentWindow : null;
    } catch (e) { return null; }
  }
  function tell(context, open) {
    var w = livePage(context);
    if (w) w.postMessage({ source: TO_PAGE, kind: 'open-feedback', open: open }, location.origin);
    return Boolean(w);
  }

  function render(into, context) {
    into.innerHTML = '';
    var live = Boolean(livePage(context));
    into.appendChild(h('div', { class: 'fbp' },
      h('p', { text: live
        ? 'Feedback opens beside the page in the frame: write the note, click the page to pin spots, double click page copy to edit it in place, or change a design setting. The ticket is filed against this journey step.'
        : 'This screen has no live page on the web app, so there is nothing to give feedback on here.' }),
      h('p', { class: 'fbp-hint', text: 'At a phone width no feedback is collected; widen the window to give it.' })));
  }
  function opened(open, context) { tell(context, open); }

  // One entry of the control plane's "Made of" lists. A component is shown by its plain name and becomes a link to its
  // design system file as soon as the review server has said which it is.
  function chip(kind, id, el) {
    var span = el('span', null, id);
    if (kind !== 'components') return span;
    var raw = String(id).replace(/^component:/, '');
    span.textContent = words(raw);
    loadLists().then(function (l) {
      if (!l) return;
      var name = (l.nodes && l.nodes[raw]) || raw;
      var c = listed(name);
      span.textContent = '';
      if (c && c.spec && c.view) { openLinks(c, words(name)).forEach(function (n, i) { if (i) span.appendChild(document.createTextNode(' ')); span.appendChild(n); }); }
      else { span.appendChild(document.createTextNode(words(raw) + ' ')); span.appendChild(h('small', { class: 'fbp-nofile', text: 'No design system file yet' })); }
    });
    return span;
  }

  window.gabfFeedback = { render: render, opened: opened, chip: chip, componentParts: componentParts };
})();
