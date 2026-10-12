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

  // Formatter functions cannot travel as JSON; the build serializes them as strings
  // prefixed with "fn:" and we revive them here.
  function reviveFunctions(value) {
    if (typeof value === 'string' && value.startsWith('fn:')) {
      // eslint-disable-next-line no-new-func
      return new Function('return (' + value.slice(3) + ')')();
    }
    if (Array.isArray(value)) return value.map(reviveFunctions);
    if (value && typeof value === 'object') {
      const out = {};
      for (const k of Object.keys(value)) out[k] = reviveFunctions(value[k]);
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

  function applyOption(entry) {
    const option = resolveVars(reviveFunctions(entry.spec));
    delete option.__links; delete option.__map; delete option.__totals;
    entry.chart.setOption(option, { notMerge: true });
  }

  function init(el, spec) {
    const target = el.querySelector('.echart') || el;
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

  window.GABFCharts = { init, initAll, retheme, dispose, resolveVars, reviveFunctions, ensureMap, charts };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initAll());
  else initAll();
})();
