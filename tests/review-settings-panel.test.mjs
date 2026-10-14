// The review settings panel (web/components/review/): the public export carries none of it, it finds
// every design system component on a page, and a save from any page files a ticket in the feedback
// pipeline's shape under docs/feedback/<page>/, or is refused with a plain reason.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { buildSync } from 'esbuild';
import { applyDesignEdit, checkDesignEdit, editPage, pageForRoute } from '../scripts/design-system/edit.mjs';
import { parseTicket } from '../scripts/lib/review-store.mjs';
import { COMPONENTS_DIR, SETTINGS, WEB, design, splitFrontmatter } from '../scripts/design-system/lib.mjs';

const REVIEW = resolve(WEB, 'components/review');
const read = (p) => readFileSync(resolve(WEB, p), 'utf8');

// Bundle TypeScript from web/ for Node, the way scripts/design-system/lib.mjs bundles the schema, into a
// temporary file (React's server renderer is CommonJS, so the bundle gets a require of its own).
async function bundle(contents) {
  const dir = mkdtempSync(join(tmpdir(), 'review-panel-bundle-'));
  const file = join(dir, 'entry.mjs');
  try {
    buildSync({
      stdin: { contents, resolveDir: WEB, loader: 'tsx', sourcefile: 'entry.tsx' },
      bundle: true,
      format: 'esm',
      platform: 'node',
      outfile: file,
      logLevel: 'silent',
      jsx: 'automatic',
      external: ['@material/web/*'],
      define: { 'process.env.NODE_ENV': '"production"' },
      banner: { js: `import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(${JSON.stringify(resolve(WEB, 'package.json'))});` },
    });
    return await import(file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------- the public export ----------

test('the public build resolves the panel to a stand in that renders nothing and imports nothing', () => {
  const config = read('next.config.ts');
  assert.match(config, /'review-settings-panel': review \? '\.\/components\/review\/settings-panel\.tsx' : '\.\/components\/review\/settings-panel-off\.tsx'/);
  assert.match(config, /const review = process\.env\.DESIGN_REVIEW === '1'/);
  const off = read('components/review/settings-panel-off.tsx');
  assert.doesNotMatch(off, /^import /m);
  assert.doesNotMatch(off, /fetch|__design|data-review-panel|design-editor|usePreview/);
  assert.match(off, /return null;/);
  // The public entry point only re-exports the alias.
  const entry = read('components/review/ReviewSettingsPanel.tsx');
  const imports = [...entry.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(imports, ['review-settings-panel']);
  // Nothing reaches the panel or its discovery code except through the alias.
  const files = [];
  const walk = (dir) => { for (const n of readdirSync(dir)) { const f = resolve(dir, n); if (['node_modules', '.next', 'out', 'out-review', 'public'].includes(n)) continue; if (statSync(f).isDirectory()) walk(f); else if (/\.tsx?$/.test(n)) files.push(f); } };
  walk(WEB);
  for (const f of files) {
    if (f === resolve(REVIEW, 'settings-panel.tsx')) continue;
    assert.doesNotMatch(readFileSync(f, 'utf8'), /from '(\.\/|@\/components\/review\/)(settings-panel|discover)'/, f);
  }
});

test('the public export carries no panel code, and the review export does', (t) => {
  const scan = (dir) => {
    const hits = [];
    const walk = (d) => {
      for (const name of readdirSync(d)) {
        const full = resolve(d, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(js|html|txt)$/.test(name) && /data-review-panel|review-settings-panel|__design\//.test(readFileSync(full, 'utf8'))) hits.push(full);
      }
    };
    walk(dir);
    return hits;
  };
  const out = resolve(WEB, 'out');
  if (!existsSync(resolve(out, 'design-system/index.html'))) { t.skip('web/out is not built here; npm run web:build builds it'); return; }
  assert.deepEqual(scan(out), []);
  const review = resolve(WEB, 'out-review');
  if (existsSync(resolve(review, 'design-system/index.html'))) assert.ok(scan(review).length > 0, 'the review build carries the panel');
});

// ---------- discovery ----------

// A small element tree from static markup: enough of the DOM (querySelectorAll and closest on one
// attribute, getAttribute) for discoverInstances to run on what the real components render.
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
function parseMarkup(html) {
  const make = (tag, attrs, parent) => ({
    tag, attrs, parent, children: [],
    getAttribute(name) { return Object.hasOwn(this.attrs, name) ? this.attrs[name] : null; },
    closest(selector) { const attr = /^\[([\w-]+)\]$/.exec(selector)[1]; for (let el = this; el; el = el.parent) if (el.attrs && Object.hasOwn(el.attrs, attr)) return el; return null; },
  });
  const root = make('#root', {}, null);
  let at = root;
  for (const m of html.matchAll(/<(\/?)([a-zA-Z][\w:-]*)((?:\s+[^\s=>/]+(?:="[^"]*")?)*)\s*(\/?)>/g)) {
    const [, closing, tag, rawAttrs, selfClose] = m;
    if (closing) { at = at.parent ?? root; continue; }
    const attrs = Object.fromEntries([...rawAttrs.matchAll(/([^\s=]+)(?:="([^"]*)")?/g)].map((a) => [a[1], a[2] ?? '']));
    const el = make(tag, attrs, at);
    at.children.push(el);
    if (!selfClose && !VOID.has(tag.toLowerCase())) at = el;
  }
  const all = [];
  const visit = (el) => { for (const c of el.children) { all.push(c); visit(c); } };
  visit(root);
  root.querySelectorAll = (selector) => { const attr = /^\[([\w-]+)\]$/.exec(selector)[1]; return all.filter((el) => Object.hasOwn(el.attrs, attr)); };
  return root;
}

test('every shared component marks its root with its spec name', async () => {
  const { COMPONENTS } = await design();
  for (const file of readdirSync(resolve(WEB, 'components')).filter((f) => f.endsWith('.tsx'))) {
    const src = read(`components/${file}`);
    for (const [, name] of src.matchAll(/useSettings\('([a-z0-9-]+)'\)/g)) {
      assert.ok(Object.hasOwn(COMPONENTS, name), `${file}: ${name} has a schema`);
      assert.match(src, new RegExp(`data-component="${name}"`), `${file} marks ${name}`);
    }
  }
});

test('discovery finds each component instance the page renders, and none inside the panel', async () => {
  const m = await bundle(`
    import { createElement as h } from 'react';
    import { renderToStaticMarkup } from 'react-dom/server';
    import { DesignSettings } from '@/design/runtime';
    import { readState } from '@/design/state';
    import { Button } from '@/components/Button';
    import { Callout } from '@/components/Callout';
    import { DataTable } from '@/components/DataTable';
    import { MedalRecord } from '@/components/MedalRecord';
    import { SectionHeader } from '@/components/SectionHeader';
    import { StatusChip } from '@/components/StatusChip';
    export { countInstances, discoverInstances } from '@/components/review/discover';
    export const html = renderToStaticMarkup(h(DesignSettings, { initial: readState({ settings: null, layout: null, specs: {} }) },
      h('main', null,
        h(SectionHeader, { id: 'one', title: 'Medals' }),
        h(MedalRecord, { counts: { gold: 1, silver: 0, bronze: 2 }, names: { Gold: 'Gold', Silver: 'Silver', Bronze: 'Bronze' } }),
        h(StatusChip, { label: 'Partial' }),
        h(Callout, { label: 'Finding', link: { href: '/about/', text: 'About' } }, 'Text'),
        h(DataTable, { caption: 'Rows', columns: [{ key: 'a', label: 'A' }], rows: [{ key: '1', cells: { a: 'x' } }] }),
        h(Button, { variant: 'primary' }, 'Go'),
        h(Button, { variant: 'quiet' }, 'Later'),
      ),
      h('div', { 'data-review-panel': 'open' }, h(Button, null, 'Inside the panel'), h(StatusChip, { label: 'Inside' })),
    ));
  `);
  const { COMPONENTS } = await design();
  const known = Object.keys(COMPONENTS);
  const found = m.discoverInstances(parseMarkup(m.html), known, ['button', 'status-chip']);
  const counts = Object.fromEntries(found.map((i) => [i.name, i.count]));
  assert.deepEqual(counts, { button: 2, 'status-chip': 1, 'section-header': 1, 'medal-record': 1, 'medal-mark': 3, callout: 1, 'text-link': 1, 'data-table': 1 });
  // The layout order first, then the page order.
  assert.deepEqual(found.map((i) => i.name), ['button', 'status-chip', 'section-header', 'medal-record', 'medal-mark', 'callout', 'text-link', 'data-table']);
  // Names with no spec are left out.
  assert.deepEqual(m.countInstances(['button', 'nonsense', null, 'button'], known), [{ name: 'button', count: 2 }]);
});

// ---------- the page a ticket is filed under ----------

test('a ticket is filed under the page sent, or the page its route names', () => {
  assert.deepEqual(editPage({ page: 'brewery-detail' }), { page: 'brewery-detail' });
  assert.deepEqual(editPage({}), { page: 'design-system' });
  assert.equal(pageForRoute('/design-system/'), 'design-system');
  assert.equal(pageForRoute('/'), 'overview-dashboard');
  assert.equal(pageForRoute('/breweries/green-cheek-beer-co/'), 'brewery-detail');
  assert.equal(pageForRoute('/breweries/another-brewery/'), 'brewery-detail');
  assert.equal(pageForRoute('/beers/2026/some-beer/'), 'beer-detail');
  assert.equal(pageForRoute('/hops/cascade/'), 'hops-detail');
  assert.equal(pageForRoute('/hops/'), 'hops');
  assert.equal(pageForRoute('/../etc/'), null);
  assert.equal(pageForRoute('https://example.test/'), null);
});

const PNG = Buffer.from('89504e470d0a1a0a', 'hex');
const ticketsIn = (dir) => readdirSync(dir).filter((f) => f.endsWith('.md'));

test('a save from a site page writes the setting and files a ticket in the existing shape under that page', async () => {
  const spec = resolve(COMPONENTS_DIR, 'status-chip', 'spec.md');
  const before = readFileSync(spec, 'utf8');
  const dir = mkdtempSync(join(tmpdir(), 'review-panel-'));
  const current = splitFrontmatter(before).data.Shape;
  const next = current === 'medium' ? 'small' : 'medium';
  const shots = [];
  try {
    const r = await applyDesignEdit({
      target: 'status-chip', key: 'Shape', value: next, page: 'brewery-detail', route: '/breweries/green-cheek-beer-co/', feedbackDir: dir,
      capture: async (c) => { shots.push(c); writeFileSync(c.path, PNG); return true; },
    });
    assert.equal(r.page, 'brewery-detail');
    assert.equal(existsSync(resolve(dir, 'design-system')), false);
    const md = ticketsIn(resolve(dir, 'brewery-detail'));
    assert.equal(md.length, 1);
    const base = md[0].replace(/\.md$/, '');
    assert.deepEqual(readFileSync(resolve(dir, 'brewery-detail', base, 'component.png')), PNG);
    const { data, body } = parseTicket(readFileSync(resolve(dir, 'brewery-detail', md[0]), 'utf8'));
    assert.deepEqual(Object.keys(data), ['id', 'status', 'title', 'page', 'step', 'components', 'created', 'revised', 'images', 'setting-edits']);
    assert.equal(data.status, 'ACCEPTED');
    assert.equal(data.page, 'brewery-detail');
    assert.deepEqual(data.components, [{ name: 'status-chip', spec: '.design/design-system/components/status-chip/spec.md' }]);
    assert.deepEqual(data.images, [{ path: `${base}/component.png`, kind: 'component', spot: null, component: 'status-chip', url: null }]);
    assert.deepEqual(data['setting-edits'], [{ file: '.design/design-system/components/status-chip/spec.md', key: 'Shape', old: current, new: next }]);
    assert.match(body, new RegExp(`\\]\\(${base}/component\\.png\\)`));
    assert.deepEqual(shots.map((s) => [s.target, s.key, s.page, s.route]), [['status-chip', 'Shape', 'brewery-detail', '/breweries/green-cheek-beer-co/']]);
    assert.equal(splitFrontmatter(readFileSync(spec, 'utf8')).data.Shape, next);
  } finally {
    writeFileSync(spec, before);
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a site setting saved from a page with no page id is filed under the page its route names', async () => {
  const before = readFileSync(SETTINGS, 'utf8');
  const dir = mkdtempSync(join(tmpdir(), 'review-panel-'));
  const current = splitFrontmatter(before).data['Corner shape'];
  const next = current === 'large' ? 'small' : 'large';
  try {
    await applyDesignEdit({ target: 'settings', key: 'Corner shape', value: next, route: '/breweries/some-brewery/', feedbackDir: dir });
    const md = ticketsIn(resolve(dir, 'brewery-detail'));
    const { data } = parseTicket(readFileSync(resolve(dir, 'brewery-detail', md[0]), 'utf8'));
    assert.equal(data.page, 'brewery-detail');
    assert.deepEqual(data.components, []);
    assert.deepEqual(data['setting-edits'], [{ file: '.design/design-system/settings.md', key: 'Corner shape', old: current, new: next }]);
    // No capture: the ticket says so instead of linking a missing picture.
    assert.deepEqual(data.images, []);
  } finally {
    writeFileSync(SETTINGS, before);
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- refusal ----------

test('an edit from a page is refused with a plain reason and nothing is written', async () => {
  const settings = readFileSync(SETTINGS, 'utf8');
  const chip = resolve(COMPONENTS_DIR, 'status-chip', 'spec.md');
  const chipBefore = readFileSync(chip, 'utf8');
  const dir = mkdtempSync(join(tmpdir(), 'review-panel-'));
  try {
    const cases = [
      [{ target: 'status-chip', key: 'Shape', value: 'small', page: '../../etc' }, /is not a page id/],
      [{ target: 'status-chip', key: 'Shape', value: 'small', page: 'Brewery Detail' }, /is not a page id/],
      [{ target: 'status-chip', key: 'Shape', value: 'small', route: '/../../etc/' }, /could not be named from its address/],
      [{ target: 'status-chip', key: 'Shape', value: 'round', page: 'brewery-detail' }, /Shape must be one of/],
      [{ target: 'status-chip', key: 'Hue', value: 'green', page: 'brewery-detail' }, /not a setting of status-chip/],
      [{ target: 'settings', key: 'Series 5 color', value: '#E8E8E8', page: 'brewery-detail' }, /would be [\d.]+ to 1 and needs 3 to 1 \(WCAG AA\)/],
    ];
    for (const [edit, reason] of cases) {
      const { problems } = await checkDesignEdit(edit);
      assert.match(problems.join(' '), reason, JSON.stringify(edit));
      await assert.rejects(applyDesignEdit({ ...edit, feedbackDir: dir }), (e) => reason.test(e.problems.join(' ')), JSON.stringify(edit));
    }
    // The token shaped scan refuses the ticket before anything is written.
    const sanitize = (text) => (/Shape/.test(text) ? { text: '[REDACTED:token]', redacted: ['token'] } : { text, redacted: [] });
    const next = splitFrontmatter(chipBefore).data.Shape === 'medium' ? 'small' : 'medium';
    await assert.rejects(applyDesignEdit({ target: 'status-chip', key: 'Shape', value: next, page: 'brewery-detail', feedbackDir: dir, sanitize }), /shaped like a secret/);
    assert.equal(readFileSync(SETTINGS, 'utf8'), settings);
    assert.equal(readFileSync(chip, 'utf8'), chipBefore);
    assert.deepEqual(readdirSync(dir), []);
  } finally {
    writeFileSync(SETTINGS, settings);
    writeFileSync(chip, chipBefore);
    rmSync(dir, { recursive: true, force: true });
  }
});
