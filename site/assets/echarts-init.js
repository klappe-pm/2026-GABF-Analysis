// Initialize every [data-echart] figure on the page with Apache ECharts: resolve CSS
// custom properties to concrete colors for the active theme, register the US map when
// a chart needs it, keep charts sized on resize, and re-theme them when the theme toggles.
(function () {
  const charts = [];
  const base = window.GABF_BASE || './';
  let mapReady = null;

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
  }

  function resolveVars(value) {
    if (typeof value === 'string') {
      const m = value.match(/^var\((--[\w-]+)\)$/);
      return m ? cssVar(m[1]) : value;
    }
    if (Array.isArray(value)) return value.map(resolveVars);
    if (value && typeof value === 'object') {
      const out = {};
      for (const k of Object.keys(value)) out[k] = resolveVars(value[k]);
      return out;
    }
    return value;
  }

  // Formatter functions cannot travel as JSON. Options carry { $fmt: name, args } references
  // (see fmt() in chart-options.mjs) and this registry builds the real function. Nothing is
  // evaluated from text, so the page runs under a CSP that forbids eval and Function.
  const FORMATTERS = {
    compactAxis() {
      return (v) => {
        const n = Number(v);
        if (!Number.isFinite(n)) return '';
        const abs = Math.abs(n);
        if (abs >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
        if (abs >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
        if (abs >= 1e4) return (n / 1e3).toFixed(0) + 'K';
        if (abs >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
        return String(n);
      };
    },
    // Year labels with a second line for coverage status. On a phone the words shrink to a
    // glyph (pending, partial, not loaded, not yet founded or closed) and the year to two digits.
    yearNotes(notes) {
      const glyphs = { pending: '…', partial: '·', draft: '·', 'not loaded': '○', 'not yet founded': '×', closed: '×' };
      return (v, i) => {
        const note = notes[i];
        const narrow = window.innerWidth < 560;
        const year = narrow ? "'" + String(v).slice(-2) : String(v);
        if (!note) return year;
        return year + '\n{note|' + (narrow ? (glyphs[note] || '·') : note) + '}';
      };
    },
  };

  function reviveFormatters(value) {
    if (Array.isArray(value)) return value.map(reviveFormatters);
    if (value && typeof value === 'object') {
      if (typeof value.$fmt === 'string') {
        const make = FORMATTERS[value.$fmt];
        if (!make) throw new Error('Unknown chart formatter: ' + value.$fmt);
        return make(...(value.args || []));
      }
      const out = {};
      for (const k of Object.keys(value)) out[k] = reviveFormatters(value[k]);
      return out;
    }
    return value;
  }

  function ensureMap() {
    if (!mapReady) {
      mapReady = window.GABF_GEO
        ? Promise.resolve().then(() => { window.echarts.registerMap('usa', window.GABF_GEO); })
        : fetch(base + 'assets/us-states.geo.json').then((r) => r.json()).then((geo) => { window.echarts.registerMap('usa', geo); });
    }
    return mapReady;
  }

  // Inside a Claude artifact the browser's own "save image" link is inert, so the toolbox button
  // is swapped for one that hands the PNG to the host's "downloads" capability. Elsewhere
  // window.claude does not exist and ECharts' built-in saveAsImage stays.
  let hosted = null;
  const PNG_ICON = 'path://M4.7,22.9L29.3,45.5L54.7,23.4M4.6,43.6L4.6,58L53.3,58L53.3,43.6M29.3,45.5L29.3,0';

  function pngBlob(chart) {
    const url = chart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: cssVar('--surface-1') });
    const bin = atob(url.split(',')[1]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: 'image/png' });
  }

  function savePng(entry, name) {
    if (!hosted) return;
    hosted.save({ filename: name + '.png', data: pngBlob(entry.chart) }).catch((e) => { if (!e || e.code !== 'declined') console.warn('PNG save failed', e); });
  }

  function applyOption(entry) {
    const option = resolveVars(reviveFormatters(entry.spec));
    delete option.__links; delete option.__map; delete option.__totals;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) option.animation = false;
    // Narrow horizontal bar charts: fewer value ticks and category labels capped at 40 percent of
    // the chart width, truncated with the full name in the tooltip.
    const w = entry.el && entry.el.clientWidth;
    if (w && w < 520 && option.yAxis && option.yAxis.type === 'category' && option.yAxis.axisLabel) {
      option.yAxis.axisLabel.width = Math.min(option.yAxis.axisLabel.width || 190, Math.round(w * 0.4));
      if (option.xAxis && option.xAxis.type === 'value') { option.xAxis.splitNumber = 2; option.xAxis.axisLabel = { ...option.xAxis.axisLabel, hideOverlap: true }; }
    }
    const feature = option.toolbox && option.toolbox.feature;
    if (hosted && feature && feature.saveAsImage) {
      const name = feature.saveAsImage.name || 'chart';
      delete feature.saveAsImage;
      feature.savePng = { show: true, title: 'Save PNG', icon: PNG_ICON, onclick: () => savePng(entry, name) };
    }
    entry.chart.setOption(option, { notMerge: true });
  }

  function init(el, spec) {
    const target = el.querySelector('.echart') || el;
    // The canvas is an image to assistive technology; its name is the chart title, and the
    // Table view below it carries the numbers.
    const title = el.querySelector('figcaption strong');
    target.setAttribute('role', 'img');
    target.setAttribute('aria-label', `${title ? title.textContent : 'Chart'}. The table view below lists the values.`);
    const chart = window.echarts.init(target, null, { renderer: 'canvas' });
    const entry = { el, chart, spec };
    charts.push(entry);
    const go = () => {
      applyOption(entry);
      if (spec.__links) chart.on('click', (p) => { const href = spec.__links[p.name]; if (href) window.location.href = href; });
      if (el.__onClick) chart.on('click', el.__onClick);
    };
    if (spec.__map === 'usa') ensureMap().then(go);
    else go();
    return entry;
  }

  function initAll(root) {
    (root || document).querySelectorAll('[data-echart]').forEach((el) => {
      if (el.__inited) return;
      const script = el.querySelector('script[type="application/json"]');
      if (!script) return;
      el.__inited = true;
      init(el, JSON.parse(script.textContent));
    });
  }

  function retheme() { charts.forEach((entry) => applyOption(entry)); }
  function dispose(el) {
    const idx = charts.findIndex((c) => c.el === el);
    if (idx >= 0) { charts[idx].chart.dispose(); charts.splice(idx, 1); el.__inited = false; }
  }

  window.addEventListener('resize', () => charts.forEach((c) => c.chart.resize()));
  new MutationObserver(retheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', retheme);

  if (window.claude && typeof window.claude.use === 'function') {
    Promise.resolve(window.claude.use('downloads')).then((d) => { if (d) { hosted = d; retheme(); } }).catch(() => {});
  }

  window.GABFCharts = { init, initAll, retheme, dispose, resolveVars, reviveFormatters, ensureMap, charts };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initAll());
  else initAll();
})();
