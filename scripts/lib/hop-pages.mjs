// The hop pages: the hops index, a page per variety, the hop farms index, a page per farm, and the
// hop profile block on a beer page. Every word comes from the copy documents through COPY. The
// build passes in its own page helpers so these pages share the site's layout and write path.
//
// Two kinds of farm link appear, each under its own label and in its own table, and they are never
// combined: "named" (the brewery published this farm for this hop) and "grown" (the variety is
// published as grown at this farm).

import { esc, gsbColumn, humanize, statTile, tableHtml } from '../../site/assets/charts.mjs';
import { hopSlug } from '../../site/assets/hop-links.mjs';
import { valueLabel } from '../../site/assets/filter-bar.mjs';
import { medalDot } from '../../site/assets/page-views.mjs';
import { byMedalThenBeer, sourceOf } from './hops.mjs';
import { beerCardsHtml } from '../../site/assets/profile-cards.mjs';

const fmt = (n) => (n === null || n === undefined || n === '' ? '' : Number(n).toLocaleString('en-US'));
const wrap = (html) => `<div tabindex="0" role="region" aria-label="Scrollable data table" class="table-wrap">${html}</div>`;
const label = (key) => humanize(String(key).replace(/_/g, '-'));
// Form and use values read as words: "dry-hop" shows as "Dry hop".
const word = (v) => valueLabel('hop_value', v);

export function createHopPages({ model, ds, layout, write, COPY, renderMarkdownBody, registerDocs, notDefined, year, meta = null }) {
  const none = notDefined;
  const nav = { hops: COPY('global.navigation.header.hops'), farms: COPY('global.navigation.header.hop_farms') };
  const stateName = (code) => (code ? ds.stateByCode?.[code]?.name ?? code : '');

  const sourceHtml = (s) => {
    if (!s) return none;
    return s.url ? `<a href="${esc(s.url)}" rel="noopener">${esc(s.label)}</a>` : esc(s.label);
  };
  const sourcesHtml = (list) => (list.length ? list.map((s) => sourceHtml(s)).join('<br>') : none);
  const text = (v) => (v ? esc(v) : none);

  const beerLink = (b, r) => `<a href="${r}${esc(b.page)}">${esc(b.beer)}</a>`;
  const breweryLink = (b, r) => `<a href="${r}breweries/${esc(b.brewery_slug)}/">${esc(b.brewery)}</a>`;
  const categoryLink = (b, r) => `<a href="${r}categories/${esc(b.category_slug)}/">${esc(b.category)}</a>`;
  const varietyLink = (v, r) => `<a href="${r}hops/${esc(v.slug)}/">${esc(v.name)}</a>`;
  const farmLink = (f, r) => `<a href="${r}hop-farms/${esc(f.slug)}/">${esc(f.name)}</a>`;
  const beerCols = (r) => [
    { key: 'medal', label: COPY('pages.hop-detail.beers.medal'), render: (x) => medalDot(x.beer.medal) },
    { key: 'beer', label: COPY('pages.hop-detail.beers.beer'), render: (x) => beerLink(x.beer, r) },
    { key: 'brewery', label: COPY('pages.hop-detail.beers.brewery'), render: (x) => breweryLink(x.beer, r) },
    { key: 'category', label: COPY('pages.hop-detail.beers.category'), render: (x) => categoryLink(x.beer, r) },
  ];
  // Merchant and gap tables: readable columns only, never the slug lists that join the files.
  const MERCHANT_COLS = ['name', 'type', 'location', 'ownership', 'processing', 'proprietary_varieties', 'notes', 'source_url', 'verified'];
  // A pointer to a data file means nothing to a reader of the page.
  const readable = (v) => String(v ?? '').replace(/\s*See [\w-]+\.csv\.?/g, '').trim();
  const cellFor = (k, raw) => { const v = readable(raw); return cell(k, v); };
  const cell = (k, v) => (!v ? none : /^source/.test(k) || /^https?:/.test(v) ? v.split(/;\s*/).filter(Boolean).map((x) => sourceHtml(sourceOf(x))).join('<br>') : esc(v));
  const merchantTable = (list) => wrap(tableHtml(MERCHANT_COLS.filter((k) => list.some((m) => m[k])).map((k) => ({ key: k, label: label(k), render: (m) => cellFor(k, m[k]) })), list));
  // ---------- profile cards ----------
  const beerCards = (beers, r, tag = 'h2') => beerCardsHtml(beers.map((b) => b.row).filter(Boolean), { r, meta, tag });
  const hc = (k, tokens) => COPY(`pages.profile-cards.hop.${k}`, tokens);
  const trait = (v, re) => v.traits.filter((x) => re.test(x.key)).map((x) => `${label(x.key)}: ${x.value}`);
  function hopCardHtml(v, r) {
    const alpha = trait(v, /alpha/);
    const oil = trait(v, /oil|myrcene|humulene|caryophyllene|farnesene/);
    const lines = (list) => (list.length ? list.map(esc).join('<br>') : none);
    const sources = [...new Map(v.aroma.map((a) => a.source).filter(Boolean).map((s) => [s.label + s.url, s])).values()];
    const aroma = v.aroma.length ? `<span class="chips">${v.aroma.map((a) => `<span class="chip">${esc(a.descriptor)}</span>`).join('')}</span> <span class="small muted">${esc(hc('source'))}: ${sources.length ? sources.map(sourceHtml).join(', ') : none}</span>` : none;
    const years = v.acreage.map((a) => Number(a.year)).filter(Boolean);
    const latest = years.length ? Math.max(...years) : null;
    const latestRows = v.acreage.filter((a) => Number(a.year) === latest);
    const acres = latestRows.reduce((s, a) => s + (Number(String(a.acres).replace(/,/g, '')) || 0), 0);
    const acreage = latest && acres ? esc(hc('acreage_value', { acres: fmt(acres), year: latest, states: latestRows.length })) : none;
    const growers = [...v.farms.values()].map((x) => x.farm).sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
    const farmsHtml = growers.length ? `${growers.slice(0, 5).map((f) => farmLink(f, r)).join(', ')}${growers.length > 5 ? ` ${esc(hc('more', { count: growers.length - 5 }))}` : ''}` : none;
    return `<article class="card profile-card hop-profile-card">
<h3>${varietyLink(v, r)}</h3>
<p class="small">${v.origin ? `<span class="pill">${esc(hc('origin', { origin: v.origin }))}</span>` : ''}${v.breeder ? `<span class="pill">${esc(hc('breeder', { breeder: v.breeder }))}</span>` : ''}</p>
<dl class="kv">
<dt>${esc(hc('alpha'))}</dt><dd>${lines(alpha)}</dd>
<dt>${esc(hc('oil'))}</dt><dd>${lines(oil)}</dd>
<dt>${esc(hc('aroma'))}</dt><dd>${aroma}</dd>
<dt>${esc(hc('acreage'))}</dt><dd>${acreage}</dd>
<dt>${esc(hc('beers', { year }))}</dt><dd>${v.counts.beers}</dd>
<dt>${esc(hc('farms'))}</dt><dd>${farmsHtml}</dd>
</dl>
<p class="small"><a href="${r}hops/${esc(v.slug)}/">${esc(hc('open'))}</a></p>
</article>`;
  }
  const hopCards = (list, r, tag = 'h2') => (list.length ? `<${tag}>${esc(hc('section'))}</${tag}><div class="profile-grid">${list.map((v) => hopCardHtml(v, r)).join('')}</div>` : '');

  const uniq = (list) => [...new Set(list.filter(Boolean))];
  const joinWords = (list) => { const u = uniq(list); return u.length ? esc(u.map(word).join(', ')) : none; };
  const docHtml = (doc, titleKey) => {
    if (!doc || !doc.body.trim()) return '';
    registerDocs([doc]);
    return `<h2>${esc(COPY(titleKey))}</h2><section class="prose">${renderMarkdownBody(doc.body)}</section>`;
  };

  // ---------- hops index ----------
  function hopsIndex() {
    const r = '../';
    const rows = model.varieties.map((v) => ({ v, name: v.name, origin: v.origin, beers: v.counts.beers, medals: v.counts.medals, split: [v.counts.gold, v.counts.silver, v.counts.bronze], farms: v.counts.farms }));
    rows.sort((a, b) => b.medals - a.medals || a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
    const used = rows.filter((x) => x.medals > 0).length;
    const stats = [
      statTile({ label: COPY('pages.hops.stats.varieties'), value: String(rows.length) }),
      statTile({ label: COPY('pages.hops.stats.used'), value: String(used), note: COPY('pages.hops.stats.used_note', { year }) }),
      statTile({ label: COPY('pages.hops.stats.farms'), value: String(model.farms.length) }),
    ].join('');
    const table = rows.length
      ? wrap(tableHtml([
        { key: 'name', label: COPY('pages.hops.table.variety'), render: (x) => varietyLink(x.v, r) },
        { key: 'origin', label: COPY('pages.hops.table.origin'), render: (x) => text(x.origin) },
        { key: 'beers', label: COPY('pages.hops.table.beers'), numeric: true },
        { key: 'medals', label: COPY('pages.hops.table.medals'), numeric: true },
        gsbColumn((x) => x.split),
        { key: 'farms', label: COPY('pages.hops.table.farms'), numeric: true },
      ], rows))
      : `<p class="muted">${esc(COPY('pages.hops.states.empty'))}</p>`;
    const body = `<h1>${esc(COPY('pages.hops.page.title'))}</h1>
<p class="lede">${esc(COPY('pages.hops.page.lede', { year }))}</p>
<p class="link-row"><a class="btn-link" href="${r}hop-farms/">${esc(COPY('pages.hops.links.farms'))}</a><a class="btn-link" href="${r}beers/${year}/">${esc(COPY('pages.hops.links.winners', { year }))}</a></p>
<div class="stats">${stats}</div>
${table}
<p class="small muted">${esc(COPY('pages.hops.page.note', { year }))}</p>
${hopCards(rows.map((x) => x.v), r)}`;
    write('hops/index.html', layout({ title: COPY('pages.hops.page.title'), description: COPY('pages.hops.page.description', { year }), body, depth: 1, active: nav.hops }));
  }

  // ---------- one variety ----------
  function varietyPage(v) {
    const r = '../../';
    const pills = [
      v.origin ? `<span class="pill">${esc(COPY('pages.hop-detail.pills.origin', { origin: v.origin }))}</span>` : '',
      v.breeder ? `<span class="pill">${esc(COPY('pages.hop-detail.pills.breeder', { breeder: v.breeder }))}</span>` : '',
      v.aliases.length ? `<span class="pill">${esc(COPY('pages.hop-detail.pills.aliases', { aliases: v.aliases.join(', ') }))}</span>` : '',
      `<span class="pill">${esc(COPY('pages.hop-detail.pills.medal_beers', { count: v.counts.beers, year }))}</span>`,
    ].join('');
    const traitRows = [
      v.breeder ? [COPY('pages.hop-detail.data.breeder'), esc(v.breeder)] : null,
      v.origin ? [COPY('pages.hop-detail.data.origin'), esc(v.origin)] : null,
      v.aliases.length ? [COPY('pages.hop-detail.data.aliases'), esc(v.aliases.join(', '))] : null,
      ...v.traits.map((t) => [label(t.key), esc(t.value)]),
      ...v.sources.map((s) => [label(s.label), sourceHtml(s.source)]),
    ].filter(Boolean);
    const dataCard = `<div class="card"><h2>${esc(COPY('pages.hop-detail.data.title'))}</h2>${traitRows.length ? `<dl class="kv">${traitRows.map(([k, val]) => `<dt>${esc(k)}</dt><dd>${val}</dd>`).join('')}</dl>` : `<p class="muted">${esc(COPY('pages.hop-detail.data.missing'))}</p>`}</div>`;
    const aroma = `<h2>${esc(COPY('pages.hop-detail.aroma.title'))}</h2>${v.aroma.length ? `<p class="small muted">${esc(COPY('pages.hop-detail.aroma.note'))}</p>${wrap(tableHtml([
      { key: 'descriptor', label: COPY('pages.hop-detail.aroma.descriptor'), render: (x) => esc(x.descriptor) },
      { key: 'source', label: COPY('pages.hop-detail.aroma.source'), render: (x) => sourceHtml(x.source) },
    ], v.aroma))}` : `<p class="muted">${esc(COPY('pages.hop-detail.aroma.missing'))}</p>`}`;
    const acreageRows = [...v.acreage].sort((a, b) => Number(b.year) - Number(a.year) || stateName(a.state).localeCompare(stateName(b.state)));
    const acreage = `<h2>${esc(COPY('pages.hop-detail.acreage.title'))}</h2>${acreageRows.length ? wrap(tableHtml([
      { key: 'state', label: COPY('pages.hop-detail.acreage.state'), render: (x) => text(stateName(x.state)) },
      { key: 'year', label: COPY('pages.hop-detail.acreage.year'), numeric: true, render: (x) => text(x.year) },
      { key: 'acres', label: COPY('pages.hop-detail.acreage.acres'), numeric: true, render: (x) => (x.acres ? esc(fmt(x.acres)) : none) },
      { key: 'production', label: COPY('pages.hop-detail.acreage.production'), numeric: true, render: (x) => (x.production ? esc(fmt(x.production)) : none) },
      { key: 'source', label: COPY('pages.hop-detail.acreage.source'), render: (x) => sourceHtml(x.source) },
    ], acreageRows)) : `<p class="muted">${esc(COPY('pages.hop-detail.acreage.missing'))}</p>`}`;
    const beerRows = [...v.usages.values()].sort((a, b) => byMedalThenBeer(a.beer, b.beer));
    const farmCell = (x) => {
      const named = x.entries.filter((e) => e.farm);
      const other = uniq(x.entries.filter((e) => !e.farm).map((e) => e.lotOrFarm));
      const parts = [...new Map(named.map((e) => [e.farm.slug, farmLink(e.farm, r)])).values(), ...other.map(esc)];
      return parts.length ? parts.join(', ') : none;
    };
    const beers = `<h2>${esc(COPY('pages.hop-detail.beers.title', { year }))}</h2><p class="small muted">${esc(COPY('pages.hop-detail.beers.note'))}</p>${beerRows.length ? wrap(tableHtml([
      ...beerCols(r),
      { key: 'form', label: COPY('pages.hop-detail.beers.form'), render: (x) => joinWords(x.entries.map((e) => e.form)) },
      { key: 'use', label: COPY('pages.hop-detail.beers.use'), render: (x) => joinWords(x.entries.map((e) => e.use)) },
      { key: 'farm', label: COPY('pages.hop-detail.beers.farm'), render: farmCell },
    ], beerRows)) : `<p class="muted">${esc(COPY('pages.hop-detail.beers.missing', { year }))}</p>`}${beerCards(beerRows.map((x) => x.beer), r, 'h3')}`;
    const byBrewery = new Map();
    for (const x of beerRows) {
      const slot = byBrewery.get(x.beer.brewery_slug) ?? { beer: x.beer, count: 0 };
      slot.count += 1;
      byBrewery.set(x.beer.brewery_slug, slot);
    }
    const breweryRows = [...byBrewery.values()].sort((a, b) => b.count - a.count || a.beer.brewery.localeCompare(b.beer.brewery, 'en', { sensitivity: 'base' }));
    const breweries = `<h2>${esc(COPY('pages.hop-detail.breweries.title', { year }))}</h2><p class="small muted">${esc(COPY('pages.hop-detail.breweries.note'))}</p>${breweryRows.length ? wrap(tableHtml([
      { key: 'brewery', label: COPY('pages.hop-detail.breweries.brewery'), render: (x) => breweryLink(x.beer, r) },
      { key: 'count', label: COPY('pages.hop-detail.breweries.beers'), numeric: true },
    ], breweryRows)) : `<p class="muted">${esc(COPY('pages.hop-detail.breweries.missing', { year }))}</p>`}`;
    const grownRows = [...v.farms.values()].sort((a, b) => a.farm.name.localeCompare(b.farm.name, 'en', { sensitivity: 'base' }));
    const farms = `<h2>${esc(COPY('pages.hop-detail.farms.title'))}</h2><p class="small muted"><strong>${esc(COPY('pages.hop-detail.farms.label'))}</strong> ${esc(COPY('pages.hop-detail.farms.note'))}</p>${grownRows.length ? wrap(tableHtml([
      { key: 'farm', label: COPY('pages.hop-detail.farms.farm'), render: (x) => farmLink(x.farm, r) },
      { key: 'state', label: COPY('pages.hop-detail.farms.state'), render: (x) => text(stateName(x.farm.state)) },
      { key: 'published', label: COPY('pages.hop-detail.farms.published'), render: (x) => esc([...x.entry.published].join(', ')) },
      { key: 'years', label: COPY('pages.hop-detail.farms.years'), render: (x) => (x.entry.years.size ? esc([...x.entry.years].sort().join(', ')) : none) },
      { key: 'source', label: COPY('pages.hop-detail.farms.source'), render: (x) => sourcesHtml(x.entry.sources) },
    ], grownRows)) : `<p class="muted">${esc(COPY('pages.hop-detail.farms.missing'))}</p>`}`;
    const body = `<p class="small"><a href="../">${esc(COPY('pages.hop-detail.links.back'))}</a> · <a href="${r}hop-farms/">${esc(COPY('pages.hop-detail.links.farms'))}</a></p>
<h1>${esc(v.name)}</h1>
<p class="lede">${pills}</p>
${dataCard}
${aroma}
${acreage}
${beers}
${breweries}
${farms}
${docHtml(v.doc, 'pages.hop-detail.doc.title')}`;
    write(`hops/${v.slug}/index.html`, layout({ title: v.name, description: COPY('pages.hop-detail.meta.description', { name: v.name, year }), body, depth: 2, active: nav.hops }));
  }

  // ---------- farms index ----------
  function farmsIndex() {
    const r = '../';
    const groups = new Map();
    for (const f of model.farms) {
      const k = f.state || '';
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(f);
    }
    const ordered = [...groups.entries()].sort((a, b) => (a[0] ? 0 : 1) - (b[0] ? 0 : 1) || stateName(a[0]).localeCompare(stateName(b[0])));
    const sections = ordered.map(([code, list]) => `<h2>${code ? esc(stateName(code)) : esc(COPY('pages.hop-farms.table.no_state'))}</h2>${wrap(tableHtml([
      { key: 'name', label: COPY('pages.hop-farms.table.farm'), render: (f) => farmLink(f, r) },
      { key: 'varieties', label: COPY('pages.hop-farms.table.varieties'), numeric: true, render: (f) => String(f.counts.varieties) },
      { key: 'grown', label: COPY('pages.hop-farms.table.grown'), numeric: true, render: (f) => String(f.counts.grown) },
      { key: 'named', label: COPY('pages.hop-farms.table.named'), numeric: true, render: (f) => String(f.counts.named) },
    ], list))}`).join('');
    const merchants = model.merchants.length ? `<h2>${esc(COPY('pages.hop-farms.merchants.title'))}</h2>${merchantTable(model.merchants)}` : '';
    const gaps = model.gaps.length ? `<h2>${esc(COPY('pages.hop-farms.gaps.title'))}</h2><p class="small muted">${esc(COPY('pages.hop-farms.gaps.note'))}</p>${wrap(tableHtml(['topic', 'kind', 'finding', 'sources_checked'].map((k) => ({ key: k, label: label(k), render: (g) => cellFor(k, g[k]) })), model.gaps))}` : '';
    const body = `<h1>${esc(COPY('pages.hop-farms.page.title'))}</h1>
<p class="lede">${esc(COPY('pages.hop-farms.page.lede'))}</p>
<p class="link-row"><a class="btn-link" href="${r}hops/">${esc(COPY('pages.hop-farms.links.hops'))}</a></p>
${model.farms.length ? sections : `<p class="muted">${esc(COPY('pages.hop-farms.states.empty'))}</p>`}
${merchants}
${gaps}`;
    write('hop-farms/index.html', layout({ title: COPY('pages.hop-farms.page.title'), description: COPY('pages.hop-farms.page.description'), body, depth: 1, active: nav.farms }));
  }

  // ---------- one farm ----------
  function farmPage(f) {
    const r = '../../';
    const dataRows = [
      [COPY('pages.hop-farm-detail.data.state'), f.state ? esc(stateName(f.state)) : none],
      ...(f.aliases.length ? [[COPY('pages.hop-farm-detail.data.aliases'), esc(f.aliases.join(', '))]] : []),
      ...f.fields.map((x) => [label(x.key), /^https?:\/\//.test(x.value) ? sourceHtml({ label: x.value.replace(/^https?:\/\/(www\.)?/, ''), url: x.value }) : esc(x.value)]),
      ...f.sources.map((s) => [label(s.label), sourceHtml(s.source)]),
    ];
    const dataCard = `<div class="card"><h2>${esc(COPY('pages.hop-farm-detail.data.title'))}</h2><dl class="kv">${dataRows.map(([k, val]) => `<dt>${esc(k)}</dt><dd>${val}</dd>`).join('')}</dl></div>`;
    const vRows = [...f.varieties.values()].sort((a, b) => a.variety.name.localeCompare(b.variety.name, 'en', { sensitivity: 'base' }));
    const varieties = `<h2>${esc(COPY('pages.hop-farm-detail.varieties.title'))}</h2>${vRows.length ? wrap(tableHtml([
      { key: 'variety', label: COPY('pages.hop-farm-detail.varieties.variety'), render: (x) => varietyLink(x.variety, r) },
      { key: 'published', label: COPY('pages.hop-farm-detail.varieties.published'), render: (x) => esc([...x.published].join(', ')) },
      { key: 'years', label: COPY('pages.hop-farm-detail.varieties.years'), render: (x) => (x.years.size ? esc([...x.years].sort().join(', ')) : none) },
      { key: 'medals', label: COPY('pages.hop-farm-detail.varieties.medal_beers', { year }), numeric: true, render: (x) => String(x.variety.counts.medals) },
      { key: 'source', label: COPY('pages.hop-farm-detail.varieties.source'), render: (x) => sourcesHtml(x.sources) },
      { key: 'verified', label: COPY('pages.hop-farm-detail.varieties.verified'), render: (x) => (x.verified.size ? esc([...x.verified].join(', ')) : none) },
      { key: 'notes', label: COPY('pages.hop-farm-detail.varieties.notes'), render: (x) => (x.notes.size ? esc([...x.notes].join(' ')) : none) },
    ], vRows)) : `<p class="muted">${esc(COPY('pages.hop-farm-detail.varieties.missing'))}</p>`}${hopCards(vRows.map((x) => x.variety), r, 'h3')}`;
    const namedRows = [...f.named.values()].sort((a, b) => byMedalThenBeer(a.beer, b.beer));
    const named = `<h2>${esc(COPY('pages.hop-farm-detail.named.title', { year }))}</h2><p class="small muted"><strong>${esc(COPY('pages.hop-farm-detail.named.label'))}</strong> ${esc(COPY('pages.hop-farm-detail.named.note'))}</p>${namedRows.length ? wrap(tableHtml([
      ...beerCols(r),
      { key: 'hop', label: COPY('pages.hop-farm-detail.named.hop'), render: (x) => uniq(x.entries.map((e) => e.variety.slug)).map((s) => varietyLink(model.varietyBySlug.get(s), r)).join(', ') },
      { key: 'published', label: COPY('pages.hop-farm-detail.named.published'), render: (x) => esc(uniq(x.entries.map((e) => e.lotOrFarm)).join(', ')) },
      { key: 'source', label: COPY('pages.hop-farm-detail.named.source'), render: (x) => sourcesHtml(x.entries.map((e) => e.source).filter(Boolean)) },
    ], namedRows)) : `<p class="muted">${esc(COPY('pages.hop-farm-detail.named.missing', { year }))}</p>`}${beerCards(namedRows.map((x) => x.beer), r, 'h3')}`;
    const grownRows = [...f.grown.values()].sort((a, b) => byMedalThenBeer(a.beer, b.beer));
    const grown = `<h2>${esc(COPY('pages.hop-farm-detail.grown.title', { year }))}</h2><p class="small muted"><strong>${esc(COPY('pages.hop-farm-detail.grown.label'))}</strong> ${esc(COPY('pages.hop-farm-detail.grown.note'))}</p>${grownRows.length ? wrap(tableHtml([
      ...beerCols(r),
      { key: 'hops', label: COPY('pages.hop-farm-detail.grown.hops'), render: (x) => [...x.varieties.values()].map((v) => varietyLink(v, r)).join(', ') },
    ], grownRows)) : `<p class="muted">${esc(COPY('pages.hop-farm-detail.grown.missing', { year }))}</p>`}${beerCards(grownRows.map((x) => x.beer), r, 'h3')}`;
    const linkRows = [];
    const addLinks = (kind, source) => {
      const per = new Map();
      for (const { beer } of source.values()) per.set(beer.brewery_slug, { beer, count: (per.get(beer.brewery_slug)?.count ?? 0) + 1 });
      for (const x of per.values()) linkRows.push({ ...x, kind });
    };
    addLinks('named', f.named);
    addLinks('grown', f.grown);
    linkRows.sort((a, b) => (a.kind === b.kind ? b.count - a.count || a.beer.brewery.localeCompare(b.beer.brewery, 'en', { sensitivity: 'base' }) : a.kind === 'named' ? -1 : 1));
    const breweries = `<h2>${esc(COPY('pages.hop-farm-detail.breweries.title', { year }))}</h2><p class="small muted">${esc(COPY('pages.hop-farm-detail.breweries.note'))}</p>${linkRows.length ? wrap(tableHtml([
      { key: 'brewery', label: COPY('pages.hop-farm-detail.breweries.brewery'), render: (x) => breweryLink(x.beer, r) },
      { key: 'kind', label: COPY('pages.hop-farm-detail.breweries.link'), render: (x) => esc(COPY(`pages.hop-farm-detail.breweries.${x.kind}`)) },
      { key: 'count', label: COPY('pages.hop-farm-detail.breweries.beers'), numeric: true },
    ], linkRows)) : `<p class="muted">${esc(COPY('pages.hop-farm-detail.breweries.missing', { year }))}</p>`}`;
    const merchants = f.merchants.length ? `<h2>${esc(COPY('pages.hop-farm-detail.merchants.title'))}</h2>${merchantTable(f.merchants)}` : '';
    // The grower's medal beers, either fact, through the one Hop Farm filter on the winners list.
    const filterLink = f.counts.named || f.counts.grown ? ` · <a href="${r}beers/${year}/#hop_farm=${encodeURIComponent(f.name)}">${esc(COPY('pages.hop-farm-detail.links.filter', { year }))}</a>` : '';
    const body = `<p class="small"><a href="../">${esc(COPY('pages.hop-farm-detail.links.back'))}</a> · <a href="${r}hops/">${esc(COPY('pages.hop-farm-detail.links.hops'))}</a>${filterLink}</p>
<h1>${esc(f.name)}</h1>
<p class="lede"><span class="pill">${esc(COPY('pages.hop-farm-detail.pills.grower'))}</span>${f.state ? `<span class="pill">${esc(stateName(f.state))}</span>` : ''}<span class="pill">${esc(COPY('pages.hop-farm-detail.pills.varieties', { count: f.counts.varieties }))}</span></p>
${dataCard}
${varieties}
${named}
${grown}
${breweries}
${merchants}
${docHtml(f.doc, 'pages.hop-farm-detail.doc.title')}`;
    write(`hop-farms/${f.slug}/index.html`, layout({ title: f.name, description: COPY('pages.hop-farm-detail.meta.description', { name: f.name }), body, depth: 2, active: nav.farms }));
  }

  function writeAll() {
    hopsIndex();
    for (const v of model.varieties) varietyPage(v);
    farmsIndex();
    for (const f of model.farms) farmPage(f);
    return { varieties: model.varieties.length, farms: model.farms.length, pages: 2 + model.varieties.length + model.farms.length };
  }

  // ---------- the hop profile block of a beer page ----------
  function beerHopHtml(beer, { r }) {
    if (!beer) return '';
    const t = (k, tokens) => COPY(`pages.beer-detail.hop_profile.${k}`, tokens);
    const usage = beer.usage;
    const profile = usage.length ? wrap(tableHtml([
      { key: 'hop', label: t('hop'), render: (u) => varietyLink(u.variety, r) },
      { key: 'published', label: t('published'), render: (u) => esc(u.published) },
      { key: 'form', label: t('form'), render: (u) => (u.form ? esc(word(u.form)) : none) },
      { key: 'use', label: t('use'), render: (u) => (u.use ? esc(word(u.use)) : none) },
      { key: 'farm', label: t('farm'), render: (u) => {
        if (u.farm) return `${farmLink(u.farm, r)} <span class="pill good">${esc(t('named_label'))}</span>`;
        return u.lotOrFarm ? esc(u.lotOrFarm) : none;
      } },
      { key: 'source', label: t('source'), render: (u) => sourceHtml(u.source) },
    ], usage)) : `<p class="muted">${esc(t('missing'))}</p>`;
    const grown = usage.filter((u, i) => u.variety.farms.size && usage.findIndex((x) => x.variety === u.variety) === i);
    const grownBlock = grown.length ? `<h3>${esc(t('grown_title'))}</h3><p class="small muted"><strong>${esc(t('grown_label'))}</strong> ${esc(t('grown_note'))}</p>${grown.map((u) => {
      const list = [...u.variety.farms.values()].map((x) => x.farm).sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
      return `<details class="table-view"><summary>${esc(t('grown_summary', { hop: u.variety.name, count: list.length }))}</summary><ul class="list-plain small">${list.map((f) => `<li>${farmLink(f, r)}${f.state ? ` <span class="muted">${esc(stateName(f.state))}</span>` : ''}</li>`).join('')}</ul></details>`;
    }).join('')}` : '';
    const detail = beer.details.length ? `<h3>${esc(t('details_title'))}</h3><dl class="kv">${beer.details.map((d) => `<dt>${esc(t(`detail_${d.key.replace(/-/g, '_')}`))}</dt><dd>${esc(d.value)}<div class="small muted">${esc(t('source'))}: ${sourceHtml(d.source)}</div></dd>`).join('')}</dl>` : '';
    const cards = hopCards([...new Map(usage.map((u) => [u.variety.slug, u.variety])).values()], r, 'h3');
    return `<section class="card" aria-labelledby="hop-profile-title"><h2 id="hop-profile-title">${esc(t('title'))}</h2>${profile}${cards}${grownBlock}${detail}</section>`;
  }

  return { writeAll, beerHopHtml, nav, model };
}
