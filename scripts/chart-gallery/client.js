// Chart gallery page script. Every number comes from window.GALLERY, computed at build time
// from the loaded medal data. Each option is a function of the container width so it reflows.
(function () {
  const D = window.GALLERY;
  const P = D.palette;
  const INK = P.ink;
  const INK2 = P.inkSecondary;
  const OUTLINE = P.outline;
  const GRID = '#CAC4D0';
  const FONT = 'Roboto, system-ui, -apple-system, "Segoe UI", sans-serif';
  const NARROW = 480;
  const MEDAL_NAMES = ['Gold', 'Silver', 'Bronze'];
  const fmt = (n) => Number(n).toLocaleString('en-US');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const yearLabel = (y) => (D.years.find((r) => r.year === y)?.coverage === 'complete' ? String(y) : `${y} (partial)`);
  const yearLabelTwoLine = (y, narrow) => (D.years.find((r) => r.year === y)?.coverage === 'complete' ? String(y) : `${y}\n${narrow ? 'part.' : 'partial'}`);
  const SHORT = { 'Fruit, Spice, and Specialty': 'Fruit and spice', 'Strong and Barrel-Aged': 'Strong, Barrel-Aged', 'Gluten-Free and Non-Alcoholic': 'Gluten-Free, NA', 'Brown, Amber, and Red': 'Brown, Amber, Red', 'Belgian and French': 'Belgian, French', 'British and Irish': 'British, Irish', 'Pro-Am and Collaboration': 'Pro-Am' };
  const shortName = (s, n) => { if (SHORT[s] && s.length > n) return SHORT[s]; return shortOf(s, n); };
  const shortOf = (s, n) => { const t = s.replace(', and ', ' & ').replace(' and ', ' & '); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

  const base = (extra) => Object.assign({
    animation: false,
    textStyle: { color: INK, fontFamily: FONT, fontSize: 12 },
    tooltip: { confine: true, backgroundColor: '#FFFFFF', borderColor: OUTLINE, textStyle: { color: INK, fontSize: 12 } },
  }, extra);
  const axisText = { color: INK, fontSize: 12, fontFamily: FONT };
  const legendBase = { textStyle: { color: INK, fontSize: 12 }, itemWidth: 14, itemHeight: 14 };
  const bin = (set, v) => { let hit = set[0]; for (const b of set) if (v >= b.min) hit = b; return hit; };
  const binLabel = (b) => (b.max === null ? `${b.min} or more` : b.min === b.max ? String(b.min) : `${b.min} to ${b.max}`);
  const unitFor = (b, unit) => (unit === 'medals' && b.min === 1 && b.max === 1 ? 'medal' : unit);
  const legendHtml = (items) => `<ul class="legend" aria-label="Color key">${items.map((i) => `<li><span class="swatch" style="background:${i.color}"></span>${esc(i.label)}</li>`).join('')}</ul>`;
  const binLegend = (set, unit) => legendHtml(set.map((b) => ({ color: b.fill, label: `${binLabel(b)}${unit ? ` ${unitFor(b, unit)}` : ''}` })));
  const medalLegend = () => legendHtml(MEDAL_NAMES.map((m) => ({ color: P.medal[m], label: m })));

  // derived data
  const years = D.years;
  const totalsByYear = years.map((y) => y.total);
  const states = D.states.slice().sort((a, b) => b.medals - a.medals || a.name.localeCompare(b.name));
  const stateByCode = Object.fromEntries(D.states.map((s) => [s.code, s]));
  const stateTable = { head: ['State', 'Region', 'Gold', 'Silver', 'Bronze', 'Medals'], numeric: [2, 3, 4, 5], rows: states.filter((s) => s.medals).map((s) => [s.name, s.region, s.gold, s.silver, s.bronze, s.medals]) };
  const breweries = D.breweries;
  const breweryTable = { head: ['Brewery', 'Gold', 'Silver', 'Bronze', 'Medals', 'Points'], numeric: [1, 2, 3, 4, 5], rows: breweries.map((b) => [b.name, b.gold, b.silver, b.bronze, b.total, b.points]) };
  const stateTip = (code) => { const s = stateByCode[code]; return `<b>${esc(s.name)}</b><br>${fmt(s.medals)} medals<br>Gold ${s.gold}, silver ${s.silver}, bronze ${s.bronze}`; };

  // 1. medals by year
  const yearTable = { head: ['Year', 'Coverage', 'Gold', 'Silver', 'Bronze', 'Medals'], numeric: [2, 3, 4, 5], rows: years.map((y) => [y.year, y.coverage === 'complete' ? 'Complete list' : 'Partial, sample only', y.gold, y.silver, y.bronze, y.total]) };
  const medalBars = (w, pct) => {
    const narrow = w < NARROW;
    const labels = years.map((y) => yearLabel(y.year));
    const val = (y, k) => (pct ? Math.round((y[k] / y.total) * 1000) / 10 : y[k]);
    const mk = (name, key) => ({
      name, type: 'bar', stack: 'm', data: years.map((y) => val(y, key)),
      itemStyle: { color: P.medal[name], borderColor: '#FFFFFF', borderWidth: 1 },
      label: { show: true, color: P.textOn[P.medal[name]], fontSize: 12, formatter: (p) => (p.value && (pct || p.value >= 6) ? (pct ? `${p.value}%` : p.value) : '') },
    });
    const series = MEDAL_NAMES.map((m) => mk(m, m.toLowerCase()));
    if (!pct) {
      const max = Math.max(...totalsByYear);
      series.push({ name: 'Total', type: 'bar', stack: 'm', data: totalsByYear, silent: true, itemStyle: { color: 'transparent' }, label: { show: true, position: 'insideLeft', color: INK, fontSize: 12, fontWeight: 600, formatter: (p) => fmt(p.value) }, tooltip: { show: false } });
      return base({
        grid: { left: narrow ? 92 : 112, right: 16, top: 8, bottom: 44 },
        legend: { ...legendBase, bottom: 0, data: MEDAL_NAMES },
        xAxis: { type: 'value', max: Math.ceil((max * 1.22) / 100) * 100, axisLabel: axisText, splitLine: { lineStyle: { color: GRID } } },
        yAxis: { type: 'category', inverse: true, data: labels, axisLabel: axisText, axisLine: { lineStyle: { color: OUTLINE } } },
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, confine: true, formatter: (ps) => { const y = years[ps[0].dataIndex]; return `<b>${yearLabel(y.year)}</b><br>Gold ${y.gold}, silver ${y.silver}, bronze ${y.bronze}<br>${y.total} medals`; } },
        series,
      });
    }
    return base({
      grid: { left: narrow ? 92 : 112, right: 16, top: 8, bottom: 44 },
      legend: { ...legendBase, bottom: 0, data: MEDAL_NAMES },
      xAxis: { type: 'value', min: 0, max: 100, axisLabel: { ...axisText, formatter: '{value}%' }, splitLine: { lineStyle: { color: GRID } } },
      yAxis: { type: 'category', inverse: true, data: labels, axisLabel: axisText, axisLine: { lineStyle: { color: OUTLINE } } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, confine: true, formatter: (ps) => { const y = years[ps[0].dataIndex]; return `<b>${yearLabel(y.year)}</b><br>Gold ${y.gold}, silver ${y.silver}, bronze ${y.bronze} of ${y.total}`; } },
      series,
    });
  };

  const R = D.regions;
  const bumpBuild = (w) => {
    const narrow = w < NARROW;
    return base({
      grid: { left: 40, right: narrow ? 92 : 112, top: 16, bottom: 28 },
      xAxis: { type: 'category', data: R.years.map(String), boundaryGap: false, axisLabel: axisText, axisLine: { lineStyle: { color: OUTLINE } } },
      yAxis: { type: 'value', inverse: true, min: 0.5, max: R.names.length + 0.5, interval: 1, axisLabel: { ...axisText, customValues: R.names.map((_, i) => i + 1) }, splitLine: { lineStyle: { color: GRID } } },
      tooltip: { trigger: 'item', confine: true, formatter: (p) => `<b>${esc(p.seriesName)}</b>, ${p.name}<br>Rank ${p.value} with ${R.series.find((s) => s.region === p.seriesName).counts[p.dataIndex]} medals` },
      series: R.series.map((s, ri) => ({
        name: s.region, type: 'line', symbol: 'circle', symbolSize: 26, lineStyle: { width: 4, color: P.region[s.region] }, itemStyle: { color: P.region[s.region] },
        data: R.years.map((_, i) => R.ranks[i][ri]),
        label: { show: true, position: 'inside', color: '#FFFFFF', fontSize: 12, fontWeight: 700, formatter: (p) => p.value },
        endLabel: { show: true, formatter: '{a}', distance: 20, color: P.region[s.region], fontSize: 13, fontWeight: 600 },
      })),
    });
  };
  const bumpTable = { head: ['Year', ...R.names.map((n) => `${n} medals`), ...R.names.map((n) => `${n} rank`)], numeric: R.names.flatMap((_, i) => [i + 1, i + 1 + R.names.length]), rows: R.years.map((y, i) => [y, ...R.series.map((s) => s.counts[i]), ...R.ranks[i]]) };

  // 2. medals by state
  const COLS = 11;
  const ROWS = 8;
  const tileBuild = (w) => {
    const narrow = w < NARROW;
    const cell = (s) => { const b = bin(P.seqState, s.medals); return { value: [s.tile[0], s.tile[1], s.medals], code: s.code, itemStyle: { color: b.fill, borderColor: '#FFFFFF', borderWidth: 2, borderRadius: 4 }, label: { show: true, color: b.text, formatter: `{c|${s.code}}\n{n|${s.medals}}`, rich: { c: { fontSize: narrow ? 11 : 13, fontWeight: 700, color: b.text, lineHeight: narrow ? 13 : 16 }, n: { fontSize: narrow ? 10 : 12, color: b.text, lineHeight: narrow ? 12 : 15 } } } }; };
    return base({
      grid: { left: 0, right: 0, top: 0, bottom: 0 },
      xAxis: { type: 'category', data: [...Array(COLS).keys()], show: false },
      yAxis: { type: 'category', data: [...Array(ROWS).keys()], inverse: true, show: false },
      tooltip: { confine: true, formatter: (p) => stateTip(p.data.code) },
      series: [{ type: 'heatmap', data: D.states.map(cell), emphasis: { itemStyle: { borderColor: INK, borderWidth: 2 } } }],
    });
  };

  const rankedBuild = (w) => {
    const narrow = w < NARROW;
    const top = states.slice(0, 20);
    return base({
      grid: { left: narrow ? 96 : 118, right: 44, top: 36, bottom: 8 },
      legend: { ...legendBase, top: 0, data: ['Midwest', 'Northeast', 'South', 'West'] },
      xAxis: { type: 'value', axisLabel: axisText, splitLine: { lineStyle: { color: GRID } } },
      yAxis: { type: 'category', inverse: true, data: top.map((s) => s.name), axisLabel: { ...axisText, interval: 0 }, axisLine: { lineStyle: { color: OUTLINE } } },
      tooltip: { trigger: 'item', confine: true, formatter: (p) => stateTip(top[p.dataIndex].code) },
      series: ['Midwest', 'Northeast', 'South', 'West'].map((region) => ({
        name: region, type: 'bar', barGap: '-100%', barCategoryGap: '28%',
        itemStyle: { color: P.region[region] },
        data: top.map((s) => (s.region === region ? s.medals : null)),
        label: { show: true, position: 'right', color: INK, fontSize: 12, formatter: (p) => (p.value === null || p.value === undefined ? '' : fmt(p.value)) },
      })),
    });
  };

  const HEX_R = 1 / Math.sqrt(3);
  const HEX_W = COLS + 0.5;
  const HEX_H = (ROWS - 1) * 0.866 + 2 * HEX_R;
  const hexBuild = (w) => {
    const narrow = w < NARROW;
    const items = D.states.map((s) => ({ s, cx: s.tile[0] + 0.5 + (s.tile[1] % 2) * 0.5, cy: s.tile[1] * 0.866 + HEX_R }));
    return base({
      grid: { left: 0, right: 0, top: 0, bottom: 0 },
      xAxis: { type: 'value', min: 0, max: HEX_W, show: false },
      yAxis: { type: 'value', min: 0, max: HEX_H, inverse: true, show: false },
      tooltip: { confine: true, formatter: (p) => stateTip(p.data[3]) },
      series: [{
        type: 'custom', data: items.map((i) => [i.cx, i.cy, i.s.medals, i.s.code]),
        renderItem: (params, api) => {
          const [cx, cy, medals, code] = [api.value(0), api.value(1), api.value(2), api.value(3)];
          const b = bin(P.seqState, medals);
          const pts = [0, 1, 2, 3, 4, 5].map((k) => { const a = (Math.PI / 180) * (30 + 60 * k); return api.coord([cx + HEX_R * 0.95 * Math.cos(a), cy + HEX_R * 0.95 * Math.sin(a)]); });
          const c = api.coord([cx, cy]);
          return {
            type: 'group',
            children: [
              { type: 'polygon', shape: { points: pts }, style: { fill: b.fill, stroke: '#FFFFFF', lineWidth: 1 } },
              { type: 'text', style: { text: narrow ? code : `${code}\n${medals}`, x: c[0], y: c[1], textAlign: 'center', textVerticalAlign: 'middle', fill: b.text, font: `700 ${narrow ? 10 : 13}px ${FONT}`, lineHeight: narrow ? 13 : 16 } },
            ],
          };
        },
      }],
    });
  };

  const geoBuild = () => base({
    tooltip: { confine: true, formatter: (p) => { const s = D.states.find((x) => x.name === p.name); return s ? stateTip(s.code) : esc(p.name); } },
    series: [{
      type: 'map', map: 'usa', aspectScale: 1, roam: false, left: 0, right: 0, top: 0, bottom: 0, selectedMode: false,
      itemStyle: { areaColor: '#F4EFF4', borderColor: '#49454F', borderWidth: 0.6 },
      emphasis: { label: { show: false }, itemStyle: { areaColor: undefined, borderColor: INK, borderWidth: 1.5 } },
      label: { show: false },
      data: D.states.map((s) => ({ name: s.name, value: s.medals, itemStyle: { areaColor: bin(P.seqState, s.medals).fill } })),
    }],
  });

  // 3. style families
  const fam = D.families;
  const famColor = (i) => P.family[i % P.family.length];
  const famTable = { head: ['Style family', 'Medals', 'Categories'], numeric: [1, 2], rows: fam.map((f) => [f.name, f.medals, f.categories.length]) };
  const treeData = () => fam.map((f, i) => ({ name: f.name, itemStyle: { color: famColor(i) }, children: f.categories.map((c) => ({ name: c.name, value: c.medals, itemStyle: { color: famColor(i) } })) }));
  const flatFamilies = () => fam.map((f, i) => ({ name: f.name, value: f.medals, top: f.categories[0], count: f.categories.length, itemStyle: { color: famColor(i), borderColor: '#FFFFFF', borderWidth: 2 }, label: { show: f.medals >= 60 } }));
  const treemapBuild = (w) => base({
    tooltip: { confine: true, formatter: (p) => `<b>${esc(p.name)}</b><br>${fmt(p.value)} medals in ${p.data.count} categories<br>Most medals: ${esc(p.data.top.name)} (${p.data.top.medals})` },
    series: [{
      type: 'treemap', roam: false, nodeClick: false, breadcrumb: { show: false }, left: 0, right: 0, top: 0, bottom: 0, squareRatio: 1, data: flatFamilies(),
      label: { show: true, color: '#FFFFFF', fontSize: w < NARROW ? 12 : 14, fontWeight: 700, lineHeight: 18, overflow: 'break', formatter: (p) => `${shortName(p.name, 22)}\n${fmt(p.value)}` },
      itemStyle: { gapWidth: 2, borderColor: '#FFFFFF', borderWidth: 2 },
    }],
  });
  const sunburstBuild = (w) => base({
    tooltip: { confine: true, formatter: (p) => `<b>${esc(p.name)}</b><br>${fmt(p.value)} medals` },
    series: [{
      type: 'sunburst', radius: ['10%', '96%'], sort: undefined, nodeClick: false, data: treeData(),
      itemStyle: { borderColor: '#FFFFFF', borderWidth: 1 },
      levels: [
        {},
        { r0: '10%', r: '56%', label: { rotate: 'radial', color: '#FFFFFF', fontSize: 11, fontWeight: 700, minAngle: w < NARROW ? 26 : 14, overflow: 'truncate', formatter: (p) => shortName(p.name, w < NARROW ? 14 : 18) } },
        { r0: '56%', r: '96%', label: { show: false }, itemStyle: { borderWidth: 0.5 } },
      ],
    }],
  });
  const radialItems = fam.slice(0, 8).map((f) => ({ name: f.name, value: f.medals }));
  const radialBuild = (w) => {
    const narrow = w < NARROW;
    const items = radialItems.slice().reverse();
    const max = Math.ceil(Math.max(...items.map((i) => i.value)) / 50) * 50;
    return base({
      tooltip: { confine: true, formatter: (p) => `<b>${esc(items[p.dataIndex].name)}</b><br>${fmt(p.value)} medals` },
      polar: { center: [narrow ? '56%' : '54%', '52%'], radius: ['12%', '94%'] },
      angleAxis: { type: 'value', min: 0, max, startAngle: 90, endAngle: -180, axisLabel: { show: false }, axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: GRID } } },
      radiusAxis: { type: 'category', data: items.map((i) => shortName(i.name, narrow ? 15 : 24)), axisLabel: { ...axisText, fontSize: narrow ? 11 : 12, interval: 0 }, axisLine: { lineStyle: { color: OUTLINE } }, axisTick: { show: false } },
      series: [{ type: 'bar', coordinateSystem: 'polar', barCategoryGap: '22%', data: items.map((i) => ({ value: i.value, itemStyle: { color: famColor(fam.findIndex((f) => f.name === i.name)) } })), label: { show: true, position: 'middle', color: '#FFFFFF', fontSize: 11, fontWeight: 700, formatter: (p) => fmt(p.value) } }],
    });
  };
  const radialTable = { head: ['Style family', 'Medals'], numeric: [1], rows: radialItems.map((f) => [f.name, f.value]) };

  // 4. brewery leaders
  const labelWidth = (w) => (w < NARROW ? 108 : 168);
  const brewLabels = (w) => ({ ...axisText, fontSize: w < NARROW ? 11 : 12, width: labelWidth(w) - 8, overflow: 'break', lineHeight: w < NARROW ? 12 : 14, interval: 0 });
  const brewStackBuild = (w) => {
    const narrow = w < NARROW;
    const max = Math.max(...breweries.map((b) => b.total));
    const series = MEDAL_NAMES.map((m) => ({ name: m, type: 'bar', stack: 'm', data: breweries.map((b) => b[m.toLowerCase()]), itemStyle: { color: P.medal[m], borderColor: '#FFFFFF', borderWidth: 1 }, label: { show: true, color: P.textOn[P.medal[m]], fontSize: 12, formatter: (p) => (p.value ? p.value : '') } }));
    series.push({ name: 'Points', type: 'bar', stack: 'm', data: breweries.map((b) => b.points), silent: true, itemStyle: { color: 'transparent' }, tooltip: { show: false }, label: { show: true, position: 'insideLeft', color: INK, fontSize: 12, fontWeight: 600, formatter: (p) => `${p.value} pts` } });
    return base({
      grid: { left: labelWidth(w), right: 12, top: 4, bottom: 44 },
      legend: { ...legendBase, bottom: 0, data: MEDAL_NAMES },
      xAxis: { type: 'value', max: Math.ceil((max * (narrow ? 1.8 : 1.5)) / 5) * 5, axisLabel: axisText, splitLine: { lineStyle: { color: GRID } } },
      yAxis: { type: 'category', inverse: true, data: breweries.map((b) => b.name), axisLabel: brewLabels(w), axisLine: { lineStyle: { color: OUTLINE } } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, confine: true, formatter: (ps) => { const b = breweries[ps[0].dataIndex]; return `<b>${esc(b.name)}</b><br>Gold ${b.gold}, silver ${b.silver}, bronze ${b.bronze}<br>${b.total} medals, ${b.points} points`; } },
      series,
    });
  };
  const dotsBuild = (w) => {
    const SYMBOL = { Gold: 'circle', Silver: 'diamond', Bronze: 'triangle' };
    const OFF = { Gold: -0.2, Silver: 0, Bronze: 0.2 };
    return base({
      grid: { left: labelWidth(w), right: 16, top: 4, bottom: 44 },
      legend: { ...legendBase, bottom: 0, data: MEDAL_NAMES, icon: 'circle' },
      xAxis: { type: 'value', min: 0, max: 8, interval: 1, name: '', axisLabel: axisText, splitLine: { lineStyle: { color: GRID } } },
      yAxis: { type: 'value', inverse: true, min: -0.5, max: breweries.length - 0.5, interval: 1, axisLabel: { ...brewLabels(w), customValues: breweries.map((_, i) => i), formatter: (v) => (breweries[v] ? breweries[v].name : '') }, splitLine: { show: true, lineStyle: { color: GRID } }, axisLine: { lineStyle: { color: OUTLINE } } },
      tooltip: { confine: true, formatter: (p) => `<b>${esc(breweries[Math.round(p.value[1] - OFF[p.seriesName])].name)}</b><br>${p.seriesName}: ${p.value[0]}` },
      series: MEDAL_NAMES.map((m) => ({ name: m, type: 'scatter', symbol: SYMBOL[m], symbolSize: 15, itemStyle: { color: P.medal[m], borderColor: '#FFFFFF', borderWidth: 1 }, data: breweries.map((b, i) => [b[m.toLowerCase()], i + OFF[m]]) })),
    });
  };
  const brewHeatBuild = (w) => {
    const narrow = w < NARROW;
    const ys = D.breweryYears;
    const data = [];
    breweries.forEach((b, r) => ys.forEach((y, c) => { const v = b.byYear[c]; const k = bin(P.seqSmall, v); data.push({ value: [c, r, v], itemStyle: { color: k.fill, borderColor: '#FFFFFF', borderWidth: 2 }, label: { show: true, color: k.text, formatter: v ? String(v) : '', fontSize: 12 } }); }));
    return base({
      grid: { left: labelWidth(w), right: 8, top: 4, bottom: 40 },
      xAxis: { type: 'category', data: ys.map((y) => yearLabelTwoLine(y, narrow)), position: 'bottom', axisLabel: { ...axisText, fontSize: narrow ? 10 : 12, lineHeight: 13, interval: 0 }, axisLine: { show: false }, axisTick: { show: false } },
      yAxis: { type: 'category', inverse: true, data: breweries.map((b) => b.name), axisLabel: brewLabels(w), axisLine: { show: false }, axisTick: { show: false } },
      tooltip: { confine: true, formatter: (p) => `<b>${esc(breweries[p.value[1]].name)}</b><br>${yearLabel(ys[p.value[0]])}: ${p.value[2]} medals` },
      series: [{ type: 'heatmap', data }],
    });
  };
  const brewHeatTable = { head: ['Brewery', ...D.breweryYears.map(yearLabel)], numeric: D.breweryYears.map((_, i) => i + 1), rows: breweries.map((b) => [b.name, ...b.byYear]) };

  // 5. category crowding
  const crowd = D.crowding;
  const top20 = crowd.slice(0, 20);
  const crowdTable = (list) => ({ head: ['Category', 'Style family', 'Entries', 'Medals awarded', 'Entries per medal', 'Years'], numeric: [2, 3, 4, 5], rows: list.map((c) => [c.name, c.family, c.entries, c.medals, c.perMedal, c.years]) });
  const catLabels = (w) => ({ ...axisText, fontSize: w < NARROW ? 11 : 12, width: (w < NARROW ? 112 : 230) - 8, overflow: 'break', lineHeight: 14, interval: 0 });
  const lollipopBuild = (w) => {
    const narrow = w < NARROW;
    const max = Math.ceil(top20[0].perMedal / 20) * 20;
    return base({
      grid: { left: narrow ? 112 : 230, right: 40, top: 4, bottom: 28 },
      xAxis: { type: 'value', min: 0, max, axisLabel: axisText, splitLine: { lineStyle: { color: GRID } } },
      yAxis: { type: 'category', inverse: true, data: top20.map((c) => c.name), axisLabel: catLabels(w), axisLine: { lineStyle: { color: OUTLINE } } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, confine: true, formatter: (ps) => { const c = top20[ps[0].dataIndex]; return `<b>${esc(c.name)}</b><br>${c.perMedal} entries per medal<br>${fmt(c.entries)} entries, ${c.medals} medals, ${c.years} years`; } },
      series: [
        { type: 'bar', barWidth: 3, data: top20.map((c) => c.perMedal), itemStyle: { color: OUTLINE } },
        { type: 'scatter', symbolSize: 14, data: top20.map((c) => c.perMedal), itemStyle: { color: P.series[0], borderColor: '#FFFFFF', borderWidth: 1 }, label: { show: true, position: 'right', color: INK, fontSize: 12, formatter: (p) => p.value } },
      ],
    });
  };
  const stripFamilies = (() => {
    const med = (list) => { const s = list.map((c) => c.perMedal).sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
    const names = [...new Set(crowd.map((c) => c.family))];
    return names.map((n) => ({ name: n, list: crowd.filter((c) => c.family === n) })).sort((a, b) => med(b.list) - med(a.list) || a.name.localeCompare(b.name));
  })();
  const stripBuild = (w) => {
    const narrow = w < NARROW;
    const data = [];
    stripFamilies.forEach((f, r) => f.list.forEach((c, i) => { const jitter = (((i * 37 + r * 11) % 11) - 5) / 5 * 0.3; data.push({ value: [c.perMedal, r + jitter], name: c.name, label: { show: false } }); }));
    return base({
      grid: { left: narrow ? 104 : 190, right: 16, top: 6, bottom: 34 },
      xAxis: { type: 'value', min: 0, name: 'Entries per medal', nameLocation: 'middle', nameGap: 26, nameTextStyle: { color: INK, fontSize: 12 }, axisLabel: axisText, splitLine: { lineStyle: { color: GRID } } },
      yAxis: { type: 'value', inverse: true, min: -0.5, max: stripFamilies.length - 0.5, interval: 1, axisLabel: { ...axisText, width: (narrow ? 104 : 190) - 8, overflow: 'truncate', customValues: stripFamilies.map((_, i) => i), formatter: (v) => (stripFamilies[v] ? shortName(stripFamilies[v].name, narrow ? 15 : 30) : '') }, splitLine: { lineStyle: { color: GRID } }, axisLine: { lineStyle: { color: OUTLINE } } },
      tooltip: { confine: true, formatter: (p) => `<b>${esc(p.name)}</b><br>${p.value[0]} entries per medal` },
      series: [{ type: 'scatter', symbolSize: 10, itemStyle: { color: P.series[0], opacity: 0.85, borderColor: '#FFFFFF', borderWidth: 1 }, data }],
    });
  };
  const heatCats = crowd.filter((c) => c.years >= 4).slice(0, 20);
  const oddsHeatBuild = (w) => {
    const narrow = w < NARROW;
    const data = [];
    heatCats.forEach((c, r) => c.byYear.forEach((v, i) => { if (v === null) return; const k = bin(P.seqOdds, v); data.push({ value: [i, r, v], itemStyle: { color: k.fill, borderColor: '#FFFFFF', borderWidth: 2 }, label: { show: true, color: k.text, fontSize: narrow ? 11 : 12, formatter: String(Math.round(v)) } }); }));
    return base({
      grid: { left: narrow ? 112 : 230, right: 8, top: 4, bottom: 28 },
      xAxis: { type: 'category', data: D.heatmapYears.map(String), axisLabel: { ...axisText, interval: 0 }, axisLine: { show: false }, axisTick: { show: false } },
      yAxis: { type: 'category', inverse: true, data: heatCats.map((c) => c.name), axisLabel: catLabels(w), axisLine: { show: false }, axisTick: { show: false } },
      tooltip: { confine: true, formatter: (p) => `<b>${esc(heatCats[p.value[1]].name)}</b><br>${D.heatmapYears[p.value[0]]}: ${p.value[2]} entries per medal` },
      series: [{ type: 'heatmap', data }],
    });
  };
  const oddsHeatTable = { head: ['Category', ...D.heatmapYears.map(String)], numeric: D.heatmapYears.map((_, i) => i + 1), rows: heatCats.map((c) => [c.name, ...c.byYear.map((v) => (v === null ? 'not offered' : v))]) };

  // 6. one brewery's medals across style families
  const prof = D.profile;
  const profMax = Math.max(...prof.breweries.flatMap((b) => b.counts));
  const profTable = { head: ['Style family', ...prof.breweries.map((b) => b.name)], numeric: prof.breweries.map((_, i) => i + 1), rows: [...prof.families.map((f, i) => [f, ...prof.breweries.map((b) => b.counts[i])]), ['All other families', ...prof.breweries.map((b) => b.total - b.inTopFamilies)], ['All medals', ...prof.breweries.map((b) => b.total)]] };
  const SYMS = ['circle', 'diamond', 'triangle'];
  const radarBuild = (w) => {
    const narrow = w < NARROW;
    return base({
      legend: { ...legendBase, bottom: 0, data: prof.breweries.map((b) => b.name), icon: 'roundRect', itemGap: 12 },
      tooltip: { confine: true },
      radar: { center: ['50%', '46%'], radius: narrow ? '48%' : '66%', indicator: prof.families.map((f) => ({ name: shortName(f, narrow ? 12 : 24), max: profMax + 1 })), axisName: { color: INK, fontSize: narrow ? 11 : 12 }, splitLine: { lineStyle: { color: GRID } }, splitArea: { show: false }, axisLine: { lineStyle: { color: GRID } } },
      series: [{ type: 'radar', data: prof.breweries.map((b, i) => ({ name: b.name, value: b.counts, symbol: SYMS[i], symbolSize: 9, lineStyle: { color: P.series[i], width: 2.5 }, itemStyle: { color: P.series[i] }, areaStyle: { color: P.series[i], opacity: 0.12 } })) }],
    });
  };
  const groupedBuild = (w) => {
    const narrow = w < NARROW;
    return base({
      grid: { left: narrow ? 104 : 190, right: 28, top: 8, bottom: narrow ? 84 : 56 },
      legend: { ...legendBase, bottom: 0, data: prof.breweries.map((b) => b.name) },
      xAxis: { type: 'value', minInterval: 1, axisLabel: axisText, splitLine: { lineStyle: { color: GRID } } },
      yAxis: { type: 'category', inverse: true, data: prof.families, axisLabel: { ...axisText, width: (narrow ? 104 : 190) - 8, overflow: 'break', lineHeight: 14, interval: 0 }, axisLine: { lineStyle: { color: OUTLINE } } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, confine: true },
      series: prof.breweries.map((b, i) => ({ name: b.name, type: 'bar', data: b.counts, itemStyle: { color: P.series[i] }, label: { show: true, position: 'right', color: INK, fontSize: 11, formatter: (p) => (p.value ? p.value : '') } })),
    });
  };
  const stackedFamBuild = (w) => {
    const narrow = w < NARROW;
    const names = [...prof.families, 'All other families'];
    const colors = [...P.family, OUTLINE];
    return base({
      grid: { left: labelWidth(w), right: 12, top: 4, bottom: narrow ? 118 : 74 },
      legend: { ...legendBase, bottom: 0, data: names.map((n) => shortName(n, 26)), itemGap: 10 },
      xAxis: { type: 'value', minInterval: 1, interval: 2, max: 16, axisLabel: axisText, splitLine: { lineStyle: { color: GRID } } },
      yAxis: { type: 'category', inverse: true, data: prof.breweries.map((b) => b.name), axisLabel: brewLabels(w), axisLine: { lineStyle: { color: OUTLINE } } },
      tooltip: { trigger: 'item', confine: true, formatter: (p) => `<b>${esc(prof.breweries[p.dataIndex].name)}</b><br>${esc(names[p.seriesIndex])}: ${p.value}` },
      series: names.map((n, k) => ({ name: shortName(n, 26), type: 'bar', stack: 'f', barMaxWidth: 44, data: prof.breweries.map((b) => (k < prof.families.length ? b.counts[k] : b.total - b.inTopFamilies)), itemStyle: { color: colors[k], borderColor: '#FFFFFF', borderWidth: 1 }, label: { show: true, color: P.textOn[colors[k]] ?? '#FFFFFF', fontSize: 12, formatter: (p) => (p.value ? p.value : '') } })),
    });
  };

  // the page model
  const sq = (ratio) => (w) => Math.round(w * ratio);
  const partialNote = D.totals.partialMedals.map((p) => `${p.year} holds ${p.medals} medal${p.medals === 1 ? '' : 's'}`).join(' and ');
  const yearsDone = D.totals.completeYears;
  const rangeText = `${yearsDone[0]} to ${yearsDone[yearsDone.length - 1]}`;
  const SECTIONS = [
    {
      id: 'by-year', title: 'Medals by year', now: 'On the dashboards now: stacked vertical columns, one column per year.',
      rule: `Partial years are labeled. ${partialNote}, taken from secondary sources, so they are not comparable with the complete years (${rangeText}). 2020 has no winners list loaded and is left out.`,
      options: [
        { name: 'Stacked horizontal bar', question: 'How many medals did each year award, split by medal?', caption: 'Years run down the page, so labels never crowd, and the total sits at the end of each bar.', height: (w) => (w < NARROW ? 330 : 360), build: (w) => medalBars(w, false), table: yearTable },
        { name: '100% stacked bar', question: 'Is the mix of gold, silver and bronze the same every year?', caption: 'Each category awards one of each medal, so the split stays near one third every year.', height: (w) => (w < NARROW ? 330 : 360), build: (w) => medalBars(w, true), table: yearTable },
        { name: 'Bump chart', question: 'Which region took the most medals each year?', caption: `A rank of 1 means the most medals that year, ${rangeText} only, with counts in the table.`, height: (w) => (w < NARROW ? 300 : 340), build: bumpBuild, table: bumpTable },
      ],
    },
    {
      id: 'by-state', title: 'Medals by state', now: 'On the dashboards now: a United States map that squishes at narrow widths.',
      rule: `All medals on file are counted, ${D.totals.medals.toLocaleString('en-US')} in total, including the sample medals from partial years. ${D.states.filter((s) => !s.medals).length} states have none.`,
      options: [
        { name: 'Square tile grid', question: 'Which states win the most medals?', caption: 'Every state is the same size tile in roughly its place on the map, so small states stay readable on a phone.', height: sq(ROWS / COLS), build: tileBuild, table: stateTable, legend: binLegend(P.seqState, 'medals') },
        { name: 'Ranked bar with region color', question: 'Which states lead, and in which region?', caption: 'The 20 states with the most medals, longest bar first, colored by Census region.', height: () => 36 + 20 * 25 + 8, build: rankedBuild, table: stateTable },
        { name: 'Hex tile map', question: 'Which states win the most medals?', caption: 'The same equal tiles as a honeycomb, which reads closer to the shape of the country. On a phone the tiles show the state only; color and the table give the count.', height: sq(HEX_H / HEX_W), build: hexBuild, table: stateTable, legend: binLegend(P.seqState, 'medals') },
        { name: 'Albers USA map', question: 'Where on the map are the medal winning states?', caption: 'The standard national projection with Alaska and Hawaii inset. It keeps its proportions and scales as one piece; tiny states and DC are hard to see, so use the table.', height: sq(610 / 975), build: geoBuild, table: stateTable, legend: binLegend(P.seqState, 'medals') },
      ],
    },
    {
      id: 'by-style', title: 'Medals by style family', now: 'On the dashboards now: a horizontal ranked bar, one color.',
      rule: 'All medals on file, grouped by the style family each category belongs to.',
      options: [
        { name: 'Treemap', question: 'How big is each style family?', caption: 'Area is medals, so the biggest families are the biggest blocks. Tap a block for its top category.', height: (w) => (w < NARROW ? 420 : Math.round(w * 0.6)), build: treemapBuild, table: famTable },
        { name: 'Sunburst', question: 'What share of all medals does each family hold?', caption: 'The inner ring is the family and the outer ring its categories; tap a slice for the number.', height: (w) => Math.min(w, 560), build: sunburstBuild, table: famTable },
        { name: 'Radial bar', question: 'Which eight families win the most medals?', caption: 'One ring per family, with the sweep around the circle showing medals. Families outside the top eight are in the table of Option A.', height: (w) => (w < NARROW ? 360 : 420), build: radialBuild, table: radialTable },
      ],
    },
    {
      id: 'brewery-leaders', title: 'Brewery leaders', now: 'On the dashboards now: a horizontal ranked bar of points (gold 3, silver 2, bronze 1).',
      rule: `The 15 breweries with the most points across every medal on file. Where breweries tie, more medals ranks first.`,
      options: [
        { name: 'Stacked horizontal bar by medal', question: 'Which breweries have the most points, and from which medals?', caption: 'Each bar splits into gold, silver and bronze, with the points total at the end.', height: (w) => 70 + 15 * (w < NARROW ? 44 : 32), build: brewStackBuild, table: breweryTable },
        { name: 'Dot plot', question: 'How many of each medal does each leading brewery hold?', caption: 'One row per brewery; the circle is gold, the diamond silver and the triangle bronze.', height: (w) => 70 + 15 * (w < NARROW ? 44 : 32), build: dotsBuild, table: breweryTable },
        { name: 'Heatmap by year', question: 'Do the leaders win every year or in bursts?', caption: 'Medals per brewery per year, so steady winners show as a full row.', height: (w) => 70 + 15 * (w < NARROW ? 44 : 32), build: brewHeatBuild, table: brewHeatTable, legend: binLegend(P.seqSmall, 'medals') },
      ],
    },
    {
      id: 'category-crowding', title: 'Category crowding', now: 'On the dashboards now: a horizontal ranked bar of entries per medal, and a scatter of category size against winners.',
      rule: `Entries judged divided by medals awarded, pooled over the complete years (${rangeText}). Partial years are left out because their entry counts describe a sample.`,
      options: [
        { name: 'Lollipop', question: 'Which categories are hardest to medal in?', caption: 'The 20 categories with the most entries per medal; each dot is the pooled ratio.', height: (w) => 40 + 20 * (w < NARROW ? 36 : 28), build: lollipopBuild, table: crowdTable(top20) },
        { name: 'Strip plot', question: 'How crowded are categories within each style family?', caption: 'Each dot is a category on a shared scale, so the spread inside a family is visible.', height: () => 60 + stripFamilies.length * 30, build: stripBuild, table: crowdTable(crowd) },
        { name: 'Heatmap by year', question: 'Did the crowding of a category change from year to year?', caption: 'Entries per medal for each category in each year; blank means it was not offered.', height: (w) => 40 + 20 * (w < NARROW ? 44 : 28), build: oddsHeatBuild, table: oddsHeatTable, legend: binLegend(P.seqOdds, 'entries per medal') },
      ],
    },
    {
      id: 'brewery-profile', title: 'A brewery across style families', now: 'On the dashboards now: horizontal bars of one brewery\'s medals by category, on each brewery page.',
      rule: `The three highest scoring breweries that have medaled in at least three style families, shown on the eight families where they have the most medals. The axes of a radar are unordered, so read the shape lightly and use the numbers.`,
      options: [
        { name: 'Radar', question: 'Where does each brewery\'s strength lie across style families?', caption: 'Spokes are style families and distance from the center is medals, with the same scale on every spoke.', height: (w) => (w < NARROW ? 400 : 460), build: radarBuild, table: profTable },
        { name: 'Grouped horizontal bar', question: 'How do the three breweries compare in each family?', caption: 'The same counts as bars on a shared scale, which is easier to compare precisely.', height: (w) => 100 + prof.families.length * (w < NARROW ? 60 : 50), build: groupedBuild, table: profTable },
        { name: 'Stacked horizontal bar by family', question: 'How is each brewery\'s medal total divided among families?', caption: 'One bar per brewery, split by family, with the remaining medals in a gray block.', height: (w) => (w < NARROW ? 330 : 270), build: stackedFamBuild, table: profTable },
      ],
    },
  ];

  const OTHER = [
    ['Medals by Census region, division and Federal Reserve district', 'Ranked bar with region color', 'Stacked horizontal bar by year', 'Bump chart'],
    ['Medals per million residents and per $100 billion of real GDP by state', 'Square tile grid', 'Lollipop', 'Dot plot'],
    ['Classic versus special categories by year', '100% stacked bar', 'Stacked horizontal bar', 'Slope chart'],
    ['Entrants by category', 'Lollipop', 'Treemap by style family', 'Heatmap by year'],
    ['Category size versus medal spread', 'Scatter with the outliers named', 'Strip plot by style family', 'Dot plot of winning breweries'],
    ['Brewery medals by year, category and location', 'Stacked horizontal bar', 'Dot plot', 'Treemap'],
    ['Medals by ownership type and by parent company', 'Single 100% stacked bar', 'Treemap', 'Ranked bar'],
    ['Estimated annual revenue by brewery', 'Dot plot with the estimate marked', 'Lollipop', 'Ranked bar'],
    ['Entries judged and medals awarded by year', 'Line with end labels', 'Slope chart', 'Small table with sparkline rows'],
  ];

  // rendering
  const tableHtml = (t) => `<div class="table-wrap" tabindex="0" role="region" aria-label="Table of the values shown"><table><thead><tr>${t.head.map((h, i) => `<th scope="col" class="${t.numeric.includes(i) ? 'num' : ''}">${esc(h)}</th>`).join('')}</tr></thead><tbody>${t.rows.map((r) => `<tr>${r.map((c, i) => `<td class="${t.numeric.includes(i) && typeof c === 'number' ? 'num' : ''}">${typeof c === 'number' ? fmt(c) : esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

  echarts.registerMap('usa', D.geo);
  const root = document.getElementById('gallery');
  const chips = document.getElementById('chips');
  const drawers = [];

  SECTIONS.forEach((sec) => {
    chips.insertAdjacentHTML('beforeend', `<a href="#${sec.id}">${esc(sec.title)}</a>`);
    const letters = 'ABCDEFG';
    const html = `<section class="group" id="${sec.id}" aria-labelledby="${sec.id}-h"><h2 id="${sec.id}-h">${esc(sec.title)}</h2><p class="now">${esc(sec.now)}</p><p class="rule">${esc(sec.rule)}</p><div class="options">${sec.options.map((o, i) => `<article class="option" aria-labelledby="${sec.id}-${i}-t"><div class="option-head"><span class="badge" aria-hidden="true">${letters[i]}</span><div><p class="kicker">Option ${letters[i]}, ${esc(o.name)}</p><h3 id="${sec.id}-${i}-t">${esc(o.question)}</h3></div></div><p class="caption">${esc(o.caption)}</p><div class="chart-wrap"><div class="chart" role="img" aria-label="${esc(`${o.question} ${o.caption} A table with the same values follows.`)}"></div></div>${o.legend ?? ''}<details><summary>Show the values as a table</summary>${tableHtml(o.table)}</details></article>`).join('')}</div></section>`;
    root.insertAdjacentHTML('beforeend', html);
    sec.options.forEach((o, i) => drawers.push({ o, el: root.querySelector(`#${sec.id}-${i}-t`).closest('.option') }));
  });

  root.insertAdjacentHTML('beforeend', `<section class="other" id="other"><h2>Other dashboard charts</h2><p class="rule">These charts follow the same patterns as the options above and are not drawn in this round. Pick a pattern and the same treatment carries over.</p><div class="table-wrap" tabindex="0" role="region" aria-label="Alternatives for the remaining charts"><table><thead><tr><th scope="col">Chart now</th><th scope="col">Option A</th><th scope="col">Option B</th><th scope="col">Option C</th></tr></thead><tbody>${OTHER.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`);
  chips.insertAdjacentHTML('beforeend', '<a href="#other">Other charts</a>');
  document.getElementById('foot').innerHTML = `<p>Every figure is computed from the official winners lists on file (${D.totals.medals.toLocaleString('en-US')} medals). Complete years: ${D.totals.completeYears.join(', ')}. Partial years: ${D.totals.partialYears.join(' and ')}.</p><p>Gold, silver and bronze are used only for medals. Other colors carry no medal meaning. Every chart has a table with the same values.</p>`;

  drawers.forEach(({ o, el }) => {
    const box = el.querySelector('.chart');
    const wrap = el.querySelector('.chart-wrap');
    const chart = echarts.init(box, null, { renderer: 'svg', width: Math.max(280, wrap.clientWidth), height: o.height(Math.max(280, wrap.clientWidth)) });
    let lastW = 0;
    const draw = () => {
      const w = Math.max(280, Math.floor(wrap.clientWidth));
      if (w === lastW) return;
      lastW = w;
      const h = o.height(w);
      box.style.height = `${h}px`;
      chart.resize({ width: w, height: h });
      chart.setOption(o.build(w), true);
    };
    draw();
    new ResizeObserver(draw).observe(wrap);
  });
  window.__galleryReady = true;
}());
