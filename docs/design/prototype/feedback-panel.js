// The Feedback panel of the design control plane. The control plane's shell calls render() each
// time its side panel is drawn and opened() when the panel opens or closes; everything else is
// here. A draft belongs to the journey step it was started on, so Prev and Next keep what has
// been typed and each step shows its own spots.
//
// While the panel is open the framed page is in picking mode: each click on it adds a numbered
// pin. A ticket with no spots is about the whole page. The server derives the design system
// components and the copy entries from the picked elements; both stay editable here.
(function () {
  'use strict';
  var FROM_PAGE = 'gabf-review';
  var TO_PAGE = 'gabf-control-plane';
  var drafts = {};
  var ctx = null;
  var isOpen = false;
  var lists = null;
  var categories = null;
  var facts = {};
  var ui = null;
  var uid = 0;
  var deriveSeq = 0;
  var previewTimers = {};

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
  function api(method, path, body) {
    return fetch(path, method === 'GET' ? undefined : { method: method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) { var e = new Error(j.error || 'rejected'); e.problems = j.problems; throw e; } return j; }); });
  }
  var words = function (s) { s = String(s).replace(/[-_]+/g, ' ').trim(); return s.charAt(0).toUpperCase() + s.slice(1); };
  // A copy key reads as words: the group first, then the path, never the dotted form.
  function keyWords(key) {
    var parts = String(key).split('.');
    var head = parts.shift();
    var rest = parts.map(function (p) { return p.replace(/[-_]+/g, ' '); });
    var group = rest.shift() || head;
    return words(group) + (rest.length ? ', ' + rest.join(', ') : '');
  }
  // The design system file behind a component name, when the review server knows one. The lists come
  // from the server once and are shared by the panel and the control plane's component lists.
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
  // A component name in running text: a link when its file exists, plain words when it does not.
  function componentName(name) {
    var c = listed(name);
    return c && c.spec && c.view ? openLinks(c, words(name))[0] : document.createTextNode(words(name));
  }

  var TAGS = { h1: 'heading', h2: 'heading', h3: 'heading', h4: 'heading', a: 'link', button: 'button', p: 'paragraph', table: 'table', th: 'column heading', td: 'table cell', tr: 'table row', figure: 'chart', canvas: 'chart', svg: 'chart', img: 'image', li: 'list item', input: 'field', select: 'field', label: 'label', span: 'text', div: 'area', section: 'section', header: 'header', footer: 'footer', nav: 'navigation', dialog: 'dialog' };
  var tagWord = function (t) { return TAGS[t] || 'element'; };
  var article = function (w) { return /^[aeiou]/.test(w) ? 'An ' : 'A '; };
  var excerpt = function (s, n) { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };

  function draft(id) {
    if (!drafts[id]) drafts[id] = { text: '', cats: [], spots: [], comps: [], removedComps: [], keys: [], removedKeys: [], tagged: {}, edits: {}, derived: [], said: '', bad: false, sending: false };
    return drafts[id];
  }
  var current = function () { return ctx && ctx.current ? draft(ctx.current) : null; };

  // ---------- the framed page ----------
  function liveWindow() {
    try {
      var screenWin = ctx.frame.contentWindow;
      var inner = screenWin.document.querySelector('.dcp-live-frame');
      return inner ? inner.contentWindow : null;
    } catch (e) { return null; }
  }
  function toPage(message) {
    var w = liveWindow();
    if (w) w.postMessage(Object.assign({ source: TO_PAGE }, message), location.origin);
  }
  function syncPage() {
    var d = ctx && ctx.current ? draft(ctx.current) : null;
    var on = Boolean(isOpen && d);
    toPage({ kind: 'state', picking: on, pins: on ? d.spots.map(function (s) { return { n: s.n, selector: s.selector, point: s.point, offset: s.offset }; }) : [] });
  }

  // ---------- derived links ----------
  function derive() {
    var d = current();
    if (!d) return;
    var seq = ++deriveSeq;
    var id = ctx.current;
    api('POST', '/review/derive', { screen: id, spots: d.spots.map(function (s) { return { n: s.n, selector: s.selector, text: s.text, matches: s.matches }; }) }).then(function (r) {
      if (seq !== deriveSeq || id !== ctx.current) return;
      var names = r.components.map(function (c) { return c.name; });
      d.comps = d.comps.filter(function (c) { return c.from === 'added' || names.indexOf(c.name) !== -1; });
      r.components.forEach(function (c) {
        if (d.removedComps.indexOf(c.name) === -1 && !d.comps.some(function (x) { return x.name === c.name; })) d.comps.push({ name: c.name, spec: c.spec, view: c.view || null, obsidian: c.obsidian || null, instance: c.instance || null, from: 'derived' });
      });
      d.derived = r.content;
      // A short common word ("Breweries") matches many entries; those are offered in the spot's
      // copy editor, not linked on their own. A spot with a few exact matches links them all.
      var keys = [];
      d.spots.forEach(function (s) {
        var own = r.content.filter(function (c) { return c.spot === s.n && c.match !== 'inside'; });
        if (own.length <= 3) own.forEach(function (c) { if (keys.indexOf(c.key) === -1) keys.push(c.key); });
      });
      d.keys = d.keys.filter(function (k) { return k.from === 'added' || keys.indexOf(k.key) !== -1; });
      keys.forEach(function (k) {
        if (d.removedKeys.indexOf(k) === -1 && !d.keys.some(function (x) { return x.key === k; })) d.keys.push({ key: k, from: 'derived' });
      });
      d.spots.forEach(function (s) { if (d.tagged[s.id] && !d.edits[s.id]) startEdit(d, s); });
      refresh();
    }).catch(function () { /* the lists stay as they are; the ticket can still be sent */ });
  }

  // ---------- spots ----------
  function addSpot(spot) {
    var d = current();
    if (!d) return;
    if (d.spots.some(function (s) { return s.selector === spot.selector && Math.abs(s.point.x - spot.point.x) < 3 && Math.abs(s.point.y - spot.point.y) < 3; })) return;
    spot.id = ++uid;
    spot.n = d.spots.length + 1;
    d.spots.push(spot);
    d.said = 'Spot ' + spot.n + ' added. Click the page to add another.';
    d.bad = false;
    syncPage(); refresh(); derive();
    if (ui && ui.spotList) { var last = ui.spotList.lastElementChild; if (last) last.scrollIntoView({ block: 'nearest' }); }
  }
  function removeSpot(spot) {
    var d = current();
    d.spots = d.spots.filter(function (s) { return s !== spot; });
    d.spots.forEach(function (s, i) { s.n = i + 1; });
    delete d.tagged[spot.id]; delete d.edits[spot.id];
    d.said = 'Spot removed.';
    d.bad = false;
    syncPage(); refresh(); derive();
    if (ui && ui.spotsHead) ui.spotsHead.focus();
  }
  function candidates(d, spot) { return d.derived.filter(function (c) { return c.spot === spot.n; }); }

  // ---------- copy edits ----------
  function startEdit(d, spot) {
    var c = candidates(d, spot)[0];
    d.edits[spot.id] = { key: c ? c.key : '', newValue: c ? c.value : '', preview: null, take: {} };
    if (c) preview(d, spot);
  }
  function preview(d, spot) {
    var e = d.edits[spot.id];
    if (!e || !e.key) return;
    clearTimeout(previewTimers[spot.id]);
    previewTimers[spot.id] = setTimeout(function () {
      var asked = e.newValue, key = e.key;
      api('POST', '/review/content', { key: key, newValue: asked }).then(function (r) {
        if (e.key !== key) return;
        e.preview = r;
        r.instances.forEach(function (i) { if (!(i.id in e.take)) e.take[i.id] = true; });
        paintEdit(d, spot);
      }).catch(function (err) { e.preview = { problems: [err.message], instances: [], usedBy: null, old: null }; paintEdit(d, spot); });
    }, 160);
  }

  // ---------- painting ----------
  function refresh() {
    if (!ui) return;
    paintSpots(); paintLinks(); paintSaid();
  }
  function paintSaid() {
    var d = current();
    ui.said.textContent = d ? d.said : '';
    ui.said.className = 'fbp-said' + (d && d.bad ? ' bad' : '');
  }

  function paintSpots() {
    var d = current();
    ui.spotList.innerHTML = '';
    ui.empty.hidden = d.spots.length > 0;
    d.spots.forEach(function (spot) {
      var tag = h('input', { type: 'checkbox', id: 'fbp-tag-' + spot.id });
      tag.checked = Boolean(d.tagged[spot.id]);
      tag.addEventListener('change', function () {
        d.tagged[spot.id] = tag.checked;
        if (tag.checked && !d.edits[spot.id]) startEdit(d, spot);
        paintSpots();
        var again = document.getElementById('fbp-tag-' + spot.id);
        if (again) again.focus();
      });
      var label = h('button', { type: 'button', class: 'fbp-spot-label', 'aria-label': 'Show spot ' + spot.n + ' on the page' },
        spot.text ? '“' + excerpt(spot.text, 90) + '”' : article(tagWord(spot.tag)) + tagWord(spot.tag),
        h('small', { text: spot.text ? article(tagWord(spot.tag)) + tagWord(spot.tag) : 'No visible text' }));
      label.addEventListener('click', function () { toPage({ kind: 'reveal', selector: spot.selector }); });
      var remove = h('button', { type: 'button', class: 'fbp-btn small', 'aria-label': 'Remove spot ' + spot.n, text: 'Remove' });
      remove.addEventListener('click', function () { removeSpot(spot); });
      var li = h('li', { class: 'fbp-spot', id: 'fbp-spot-' + spot.n },
        h('div', { class: 'fbp-spot-row' },
          h('span', { class: 'fbp-n', 'aria-hidden': 'true', text: String(spot.n) }),
          label, remove,
          h('div', { class: 'fbp-spot-tools' }, h('label', { class: 'fbp-check', for: 'fbp-tag-' + spot.id }, tag, 'This spot is page copy'))));
      if (d.tagged[spot.id]) li.appendChild(editorFor(d, spot));
      ui.spotList.appendChild(li);
    });
  }

  function editorFor(d, spot) {
    var e = d.edits[spot.id];
    var box = h('div', { class: 'fbp-copy', 'data-edit': spot.id });
    var cands = candidates(d, spot);
    if (!e || !e.key) {
      box.appendChild(h('p', { class: 'fbp-where', text: 'No copy entry matches this text. Add the content entry below, then choose it here.' }));
      var pick = h('select', { 'aria-label': 'Copy entry for spot ' + spot.n }, h('option', { value: '', text: 'Choose a copy entry' }));
      (lists ? lists.contentKeys : []).slice(0, 4000).forEach(function (k) { pick.appendChild(h('option', { value: k, text: keyWords(k) })); });
      pick.addEventListener('change', function () {
        if (!pick.value) return;
        d.edits[spot.id] = { key: pick.value, newValue: '', preview: null, take: {} };
        api('POST', '/review/content', { key: pick.value, newValue: null }).then(function (r) { d.edits[spot.id].newValue = r.old || ''; preview(d, spot); paintSpots(); });
      });
      box.appendChild(pick);
      return box;
    }
    if (cands.length > 1) {
      var sel = h('select', { id: 'fbp-key-' + spot.id, 'aria-label': 'Copy entry for spot ' + spot.n });
      cands.forEach(function (c) { sel.appendChild(h('option', { value: c.key, text: keyWords(c.key) })); });
      sel.value = e.key;
      sel.addEventListener('change', function () {
        var c = cands.filter(function (x) { return x.key === sel.value; })[0];
        d.edits[spot.id] = { key: c.key, newValue: c.value, preview: null, take: {} };
        preview(d, spot); paintSpots();
      });
      box.appendChild(h('div', null, h('label', { for: 'fbp-key-' + spot.id, text: 'Copy entry' }), sel));
    } else {
      box.appendChild(h('div', null, h('label', { text: 'Copy entry' }), h('p', { class: 'fbp-current', text: keyWords(e.key) })));
    }
    var cur = e.preview && e.preview.old !== null && e.preview.old !== undefined ? e.preview.old : (cands[0] ? cands[0].value : '');
    box.appendChild(h('div', null, h('label', { text: 'Current copy' }), h('p', { class: 'fbp-current', text: cur })));
    var input = h('input', { type: 'text', id: 'fbp-new-' + spot.id, autocomplete: 'off', spellcheck: 'true' });
    input.value = e.newValue;
    input.addEventListener('input', function () { e.newValue = input.value; preview(d, spot); });
    box.appendChild(h('div', null, h('label', { for: 'fbp-new-' + spot.id, text: 'New copy' }), input));
    box.appendChild(h('div', { class: 'fbp-edit-state', 'data-state': spot.id }));
    paintEditState(box, d, spot);
    return box;
  }
  function paintEdit(d, spot) {
    var box = ui && ui.spotList.querySelector('[data-edit="' + spot.id + '"]');
    if (box) paintEditState(box, d, spot);
  }
  function paintEditState(box, d, spot) {
    var e = d.edits[spot.id];
    var host = box.querySelector('.fbp-edit-state');
    if (!host || !e) return;
    host.innerHTML = '';
    var p = e.preview;
    if (!p) return;
    (p.problems || []).forEach(function (m) { host.appendChild(h('p', { class: 'fbp-problem', role: 'alert', text: m })); });
    if (p.usedBy) {
      var u = p.usedBy, bits = [];
      if (u.screens.length) bits.push('steps: ' + u.screens.join(', '));
      if (u.pages.length) bits.push('pages: ' + u.pages.map(words).join(', '));
      if (u.components.length || bits.length) {
        var where = h('p', { class: 'fbp-where' }, 'Used by ');
        if (u.components.length) {
          where.appendChild(document.createTextNode('components: '));
          u.components.forEach(function (n, i) { if (i) where.appendChild(document.createTextNode(', ')); where.appendChild(componentName(n)); });
          if (bits.length) where.appendChild(document.createTextNode('; '));
        }
        where.appendChild(document.createTextNode(bits.join('; ') + '.'));
        host.appendChild(where);
      }
    }
    if (p.instances && p.instances.length) {
      host.appendChild(h('p', { class: 'fbp-where', text: 'The same words also appear in ' + p.instances.length + ' other place' + (p.instances.length === 1 ? '' : 's') + '. Checked ones change too.' }));
      var ul = h('ul', { class: 'fbp-related' });
      p.instances.forEach(function (i) {
        var cb = h('input', { type: 'checkbox' });
        cb.checked = e.take[i.id] !== false;
        cb.addEventListener('change', function () { e.take[i.id] = cb.checked; });
        var where = i.kind === 'copy' ? 'Copy entry: ' + keyWords(i.key) : 'Page code: ' + i.file.split('/').slice(-1)[0] + ', line ' + i.line;
        ul.appendChild(h('li', null, h('label', { class: 'fbp-check' }, cb, where)));
      });
      host.appendChild(ul);
    }
  }

  // A component with a design system file is a link that opens the file as a readable page in a new
  // tab, with a second link to open the same file in Obsidian. One without a file is plain words
  // that say so; a link to a missing file is never made. The remove button is a separate control.
  function componentParts(c) {
    var label = words(c.name);
    if (!c.spec || !c.view) return [h('span', { class: 'fbp-nolink', text: label }), h('small', { class: 'fbp-nofile', text: 'No design system file yet' })];
    return openLinks(c, label);
  }
  function chipList(items, label, onRemove, text, parts) {
    var ul = h('ul', { class: 'fbp-links', 'aria-label': label });
    items.forEach(function (it) {
      var b = h('button', { type: 'button', 'aria-label': 'Remove ' + text(it), text: '×' });
      b.addEventListener('click', function () { onRemove(it); });
      var li = h('li', { class: 'fbp-link' });
      (parts ? parts(it) : [h('span', { text: text(it) })]).forEach(function (n) { li.appendChild(n); });
      li.appendChild(b);
      ul.appendChild(li);
    });
    return ul;
  }
  function paintLinks() {
    var d = current();
    ui.comps.innerHTML = '';
    ui.comps.appendChild(d.comps.length
      ? chipList(d.comps, 'Linked components', function (c) {
        d.comps = d.comps.filter(function (x) { return x !== c; });
        if (c.from === 'derived') d.removedComps.push(c.name);
        paintLinks(); ui.compAdd.focus();
      }, function (c) { return words(c.name); }, componentParts)
      : h('p', { class: 'fbp-hint', text: 'None linked.' }));
    ui.keys.innerHTML = '';
    ui.keys.appendChild(d.keys.length
      ? chipList(d.keys, 'Linked content entries', function (k) {
        d.keys = d.keys.filter(function (x) { return x !== k; });
        if (k.from === 'derived') d.removedKeys.push(k.key);
        paintLinks(); ui.keyAdd.focus();
      }, function (k) { return keyWords(k.key); })
      : h('p', { class: 'fbp-hint', text: 'None linked.' }));
  }

  // ---------- sending ----------
  function send() {
    var d = current();
    if (!d || d.sending) return;
    var edits = [];
    var blocked = null;
    d.spots.forEach(function (s) {
      var e = d.edits[s.id];
      if (!d.tagged[s.id] || !e || !e.key) return;
      if (e.newValue === (e.preview && e.preview.old)) return;
      if (e.preview && e.preview.problems && e.preview.problems.length) blocked = e.preview.problems[0];
      var take = Object.keys(e.take).filter(function (k) { return e.take[k]; });
      edits.push({ key: e.key, newValue: e.newValue, take: take });
    });
    if (blocked) { d.said = 'The new copy breaks a rule, so nothing was written. ' + blocked; d.bad = true; paintSaid(); return; }
    if (!d.text.trim() && !edits.length) { d.said = 'Write a note first, or change a line of copy.'; d.bad = true; paintSaid(); ui.note.focus(); return; }
    d.sending = true; ui.send.disabled = true; d.said = 'Sending.'; d.bad = false; paintSaid();
    var f = facts[ctx.current] || {};
    api('POST', '/review/feedback', {
      screen: ctx.current, text: d.text, categories: d.cats,
      spots: d.spots.map(function (s) { return { n: s.n, selector: s.selector, rect: s.rect, text: s.text }; }),
      components: d.comps.map(function (c) { return { name: c.name, instance: c.instance || null }; }),
      contentKeys: d.keys.map(function (k) { return k.key; }),
      contentEdits: edits,
      device: (f.width || window.innerWidth) < 600 ? 'phone' : (f.width || window.innerWidth) < 1024 ? 'tablet' : 'desktop',
      viewport: { width: f.width || window.innerWidth, height: f.height || window.innerHeight },
      build: f.build || null
    }).then(function (r) {
      var id = ctx.current;
      drafts[id] = null;
      draft(id).said = 'Registered as ' + r.id + ' and accepted.' + (r.edited ? (r.rebuilt ? ' The copy is changed and the page is reloaded.' : ' The copy is changed; rebuild the review site to see it.') : '') + (r.redacted && r.redacted.length ? ' A value shaped like a secret was removed.' : '');
      syncPage();
      if (ctx.current === id) ctx.reload(r.edited && r.rebuilt);
      mountAgain();
    }).catch(function (err) {
      d.sending = false; ui.send.disabled = false;
      d.said = 'Not recorded. ' + (err.problems && err.problems.length ? err.problems[0] : err.message) + (err.problems ? '' : ' Is the review server running?');
      d.bad = true; paintSaid();
    });
  }

  // ---------- mounting ----------
  var mountedInto = null;
  function mountAgain() { if (mountedInto && ctx) { mountedInto.innerHTML = ''; render(mountedInto, ctx); } }

  function render(into, context) {
    ctx = context;
    mountedInto = into;
    var screen = ctx.current ? ctx.screens[ctx.current] : null;
    var head = h('div', { class: 'fbp-head' }, h('h2', { text: 'Feedback' }));
    var close = h('button', { type: 'button', class: 'fbp-btn', text: 'Close' });
    close.addEventListener('click', function () { ctx.close(); });
    head.appendChild(close);
    into.appendChild(head);
    if (!screen) {
      into.appendChild(h('div', { class: 'fbp-scroll' }, h('div', { class: 'fbp-form' }, h('p', { class: 'fbp-hint', text: 'Choose a job and a journey step first. Feedback is recorded against the step you are on.' }))));
      ui = null;
      return;
    }
    var job = ctx.job;
    var steps = job ? job.screens : [];
    var position = steps.indexOf(ctx.current);
    var dl = h('dl', { class: 'fbp-context' },
      h('dt', { text: 'Job' }), h('dd', { text: job ? job.id + ' ' + job.title : 'Not part of a job' }),
      h('dt', { text: 'Step' }), h('dd', { text: ctx.current + ' ' + words(screen.name).toLowerCase() + (position >= 0 ? ', step ' + (position + 1) + ' of ' + steps.length : '') }),
      h('dt', { text: 'State' }), h('dd', { text: screen.path + ' path, ' + screen.name.replace(/-/g, ' ') }));
    into.appendChild(dl);

    var d = draft(ctx.current);
    var note = h('textarea', { id: 'fbp-note', rows: '4', placeholder: 'Say what is wrong or what should change.' });
    note.value = d.text;
    note.addEventListener('input', function () { d.text = note.value; });
    var spotsHead = h('h3', { id: 'fbp-spots-head', tabindex: '-1', text: 'Spots on the page' });
    spotsHead.style.cssText = 'margin:0;font-size:13px;font-weight:600;color:var(--text-primary);text-transform:none;letter-spacing:0';
    var spotList = h('ol', { class: 'fbp-spots', 'aria-labelledby': 'fbp-spots-head' });
    var empty = h('p', { class: 'fbp-empty', text: 'No spots yet. With none, this ticket is about the whole page.' });
    var catBox = h('div', { class: 'fbp-cats' });
    var comps = h('div');
    var keys = h('div');
    var compAdd = h('input', { type: 'text', id: 'fbp-comp-add', list: 'fbp-comp-list', autocomplete: 'off', placeholder: 'Add a component' });
    var keyAdd = h('input', { type: 'text', id: 'fbp-key-add', list: 'fbp-key-list', autocomplete: 'off', placeholder: 'Add a content entry' });
    var compList = h('datalist', { id: 'fbp-comp-list' });
    var keyList = h('datalist', { id: 'fbp-key-list' });
    var addComp = h('button', { type: 'button', class: 'fbp-btn', text: 'Add' });
    var addKey = h('button', { type: 'button', class: 'fbp-btn', text: 'Add' });
    var pickKey = h('button', { type: 'button', class: 'fbp-btn', text: 'Add the focused element' });
    pickKey.addEventListener('click', function () { toPage({ kind: 'pick-focused' }); });
    var recorded = h('ul', { class: 'fbp-recorded', 'aria-label': 'Already recorded for this step' });

    var form = h('div', { class: 'fbp-form' },
      h('div', null, h('label', { for: 'fbp-note', text: 'Note' }), note),
      h('div', null, spotsHead,
        h('p', { class: 'fbp-hint', text: 'Click the page to add a numbered pin. Picking stays on while this panel is open. From the keyboard, tab to an element in the page and press Shift and Enter, or use the button.' }),
        spotList, empty, h('div', { style: 'margin-top:8px' }, pickKey)),
      h('fieldset', null, h('legend', { text: 'Categories' }), catBox),
      h('div', null, h('label', { for: 'fbp-comp-add', text: 'Design system components' }), comps,
        h('div', { class: 'fbp-add' }, compAdd, addComp), compList),
      h('div', null, h('label', { for: 'fbp-key-add', text: 'Content entries' }), keys,
        h('div', { class: 'fbp-add' }, keyAdd, addKey), keyList),
      h('div', null, h('h3', { text: 'Recorded for this step' }), recorded));
    recorded.previousElementSibling.style.cssText = 'margin:0;font-size:13px;font-weight:600;color:var(--text-primary);text-transform:none;letter-spacing:0';
    var scroll = h('div', { class: 'fbp-scroll' }, form);
    into.appendChild(scroll);

    var said = h('span', { class: 'fbp-said', role: 'status', 'aria-live': 'polite' });
    var sendBtn = h('button', { type: 'button', class: 'fbp-send', text: 'Send' });
    sendBtn.addEventListener('click', send);
    into.appendChild(h('div', { class: 'fbp-foot' }, said, sendBtn));
    ui = { note: note, spotList: spotList, empty: empty, spotsHead: spotsHead, comps: comps, keys: keys, compAdd: compAdd, keyAdd: keyAdd, said: said, send: sendBtn };
    sendBtn.disabled = d.sending;

    function addFrom(input, list, into2, field, known) {
      var v = input.value.trim();
      if (!v) return;
      var match = known.filter(function (k) { return k.label.toLowerCase() === v.toLowerCase() || k.value === v; })[0];
      if (!match) { d.said = 'That is not a known ' + (field === 'name' ? 'component' : 'content entry') + '. Choose one from the list.'; d.bad = true; paintSaid(); return; }
      if (field === 'name') { if (!d.comps.some(function (c) { return c.name === match.value; })) d.comps.push({ name: match.value, spec: match.spec || null, view: match.view || null, obsidian: match.obsidian || null, from: 'added' }); d.removedComps = d.removedComps.filter(function (n) { return n !== match.value; }); }
      else { if (!d.keys.some(function (k) { return k.key === match.value; })) d.keys.push({ key: match.value, from: 'added' }); d.removedKeys = d.removedKeys.filter(function (n) { return n !== match.value; }); }
      input.value = '';
      d.said = ''; paintSaid(); paintLinks();
    }
    function knownLists() {
      var compOpts = (lists ? lists.components : []).map(function (c) { return { label: words(c.name), value: c.name, spec: c.spec, view: c.view, obsidian: c.obsidian }; });
      var keyOpts = (lists ? lists.contentKeys : []).map(function (k) { return { label: keyWords(k), value: k }; });
      return { compOpts: compOpts, keyOpts: keyOpts };
    }
    function fillDatalists() {
      var k = knownLists();
      compList.innerHTML = ''; keyList.innerHTML = '';
      k.compOpts.forEach(function (o) { compList.appendChild(h('option', { value: o.label })); });
      k.keyOpts.forEach(function (o) { keyList.appendChild(h('option', { value: o.label })); });
    }
    addComp.addEventListener('click', function () { addFrom(compAdd, compList, comps, 'name', knownLists().compOpts); });
    addKey.addEventListener('click', function () { addFrom(keyAdd, keyList, keys, 'key', knownLists().keyOpts); });
    [compAdd, keyAdd].forEach(function (inp, i) { inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); (i ? addKey : addComp).click(); } }); });

    function fillCategories() {
      catBox.innerHTML = '';
      (categories || []).forEach(function (c, i) {
        var cb = h('input', { type: 'checkbox', id: 'fbp-cat-' + i });
        cb.checked = d.cats.indexOf(c) !== -1;
        cb.addEventListener('change', function () { d.cats = d.cats.filter(function (x) { return x !== c; }); if (cb.checked) d.cats.push(c); });
        catBox.appendChild(h('label', { class: 'fbp-check', for: 'fbp-cat-' + i }, cb, c));
      });
    }
    if (categories) fillCategories(); else api('GET', '/review/categories').then(function (r) { categories = r.categories; fillCategories(); }).catch(function () { catBox.textContent = 'Categories are unavailable: the review server did not answer.'; });
    if (lists) fillDatalists(); else loadLists().then(function (r) { if (r) fillDatalists(); });
    api('GET', '/review/feedback?step=' + encodeURIComponent(ctx.current)).then(function (items) {
      recorded.innerHTML = '';
      if (!items.length) { recorded.appendChild(h('li', { text: 'Nothing yet.' })); return; }
      items.slice(-6).forEach(function (t) { recorded.appendChild(h('li', { text: t.id + ' ' + t.status.toLowerCase() + ': ' + excerpt(t.title, 70) })); });
    }).catch(function () { recorded.appendChild(h('li', { text: 'The review server did not answer.' })); });

    refresh();
    if (isOpen) { setTimeout(function () { note.focus(); }, 0); syncPage(); derive(); }
  }

  function opened(open, context) {
    var was = isOpen;
    isOpen = open;
    if (context) ctx = context;
    syncPage();
    if (open && !was && ui) { derive(); ui.note.focus(); }
  }

  // ---------- messages from the framed page ----------
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (e.origin !== location.origin || !d || d.source !== FROM_PAGE) return;
    if (d.kind === 'ready') {
      facts[d.screen] = { width: d.width, height: d.height, build: d.build, route: d.route };
      if (ctx && d.screen === ctx.current) syncPage();
      return;
    }
    if (!ctx || d.screen !== ctx.current) return;
    if (d.kind === 'escape' && isOpen) ctx.close();
    else if (d.kind === 'toggle') ctx.toggle();
    else if (d.kind === 'spot' && isOpen) addSpot(d.spot);
    else if (d.kind === 'pin' && isOpen) { var li = document.getElementById('fbp-spot-' + d.n); if (li) { li.scrollIntoView({ block: 'nearest' }); var b = li.querySelector('button'); if (b) b.focus(); } }
    else if (d.kind === 'inline-saved') { var s2 = current(); s2.said = 'Edited in place and recorded as ' + d.id + ', accepted.' + (d.rebuilt ? ' The page is reloading with the new copy.' : ' Rebuild the review site to see it.'); s2.bad = false; mountAgain(); }
    else if (d.kind === 'nothing-focused') { var c = current(); c.said = 'Nothing in the page has keyboard focus. Tab to an element in the page first.'; c.bad = true; paintSaid(); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen) { e.preventDefault(); ctx.close(); }
  });

  // One entry of the control plane's "Made of" lists. A component is shown by its plain name and
  // becomes a link to its design system file as soon as the review server has said which it is.
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
