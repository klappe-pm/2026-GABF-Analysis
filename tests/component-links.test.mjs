// Component tags link to their design system file. The panel draws a link when the spec exists and
// plain words with a notice when it does not; the review server shows files under
// .design/design-system/ and nothing else; a ticket body carries a relative link to the spec.
// Every test runs on a temporary tree and a temporary ticket store.

import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { request } from 'node:http';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ROOT } from '../scripts/lib/paths.mjs';
import { createReviewServer } from '../scripts/review-server.mjs';
import { componentSpec, withSpec } from '../scripts/lib/review-components.mjs';
import { addTicket, editTicket, findTicket } from '../scripts/lib/review-store.mjs';

const sanitize = (text) => ({ text, redacted: [] });

function tree() {
  const root = mkdtempSync(join(tmpdir(), 'gabf-links-'));
  const ds = join(root, '.design/design-system');
  mkdirSync(join(ds, 'components/form-header'), { recursive: true });
  mkdirSync(join(ds, 'components/footer'), { recursive: true });
  writeFileSync(join(ds, 'components/form-header/spec.md'), '---\nname: form-header\nrelated:\n  - button\n---\n\n# Form header\n\nSee the [button](../button/spec.md).\n\n![sketch](sketch.svg)\n\n<script>alert(1)</script>\n');
  writeFileSync(join(ds, 'components/form-header/sketch.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"/>');
  mkdirSync(join(ds, 'components/button'), { recursive: true });
  writeFileSync(join(ds, 'components/button/spec.md'), '# Button\n');
  writeFileSync(join(root, 'secret.txt'), 'outside the design system');
  return root;
}

// ---------- the panel's tags ----------

function panel() {
  const nodes = [];
  const make = (tag) => {
    const n = { tag, attrs: {}, children: [], textContent: '', className: '', setAttribute(k, v) { this.attrs[k] = v; }, appendChild(c) { this.children.push(c); return c; }, addEventListener() {} };
    nodes.push(n);
    return n;
  };
  const document = { createElement: make, createTextNode: (t) => ({ text: String(t) }), getElementById: () => null, addEventListener() {} };
  const window = { addEventListener() {} };
  const sandbox = { window, document, fetch: () => new Promise(() => {}), location: { origin: 'http://127.0.0.1' }, setTimeout() {}, Promise, console };
  vm.runInNewContext(readFileSync(resolve(ROOT, 'scripts/control-plane/feedback-panel.js'), 'utf8'), sandbox);
  return window.gabfFeedback;
}

test('a component with a spec file is drawn as a link and an Obsidian link, a missing one as plain words with a notice', () => {
  const root = tree();
  const { componentParts } = panel();
  const present = componentParts(withSpec(root, 'form-header'));
  assert.equal(present.length, 2);
  assert.equal(present[0].tag, 'a');
  assert.equal(present[0].attrs.href, '/review/design-system/components/form-header/spec.md');
  assert.equal(present[0].attrs.target, '_blank');
  assert.match(present[0].attrs['aria-label'], /^Form header, opens/);
  assert.equal(present[1].tag, 'a');
  assert.match(present[1].attrs.href, /^obsidian:\/\/open\?path=/);
  assert.ok(decodeURIComponent(present[1].attrs.href).endsWith('/.design/design-system/components/form-header/spec.md'));
  assert.equal(present[1].children[0].text, 'Open in Obsidian');

  // A folder with no spec file, and a name with no folder, both read as missing.
  for (const name of ['footer', 'filters-sheet']) {
    const missing = componentParts(withSpec(root, name));
    assert.equal(missing.length, 2);
    assert.ok(missing.every((n) => n.tag !== 'a'), `${name} is not a link`);
    assert.equal(missing[1].textContent, 'No design system file yet');
  }
});

test('a component folder without a spec file has no spec, so no link is ever made to a missing file', () => {
  const root = tree();
  assert.equal(componentSpec(root, 'footer'), null);
  assert.equal(componentSpec(root, 'form-header'), '.design/design-system/components/form-header/spec.md');
  assert.equal(withSpec(root, 'footer').view, undefined);
  assert.equal(withSpec(root, '../../secret').spec, null);
});

// ---------- the read only route ----------

async function boot(root) {
  const server = createReviewServer({ root, port: 0, sanitize, rebuild: () => {}, env: { GABF_FEEDBACK_DIR: join(root, 'tickets'), GABF_CMS_DIR: join(root, 'cms') } });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const port = server.address().port;
  // http.request keeps the path exactly as written, which fetch would normalise before sending.
  const get = (path, method = 'GET') => new Promise((done, fail) => {
    const req = request({ host: '127.0.0.1', port, path, method }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => done({ status: res.statusCode, type: res.headers['content-type'], body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', fail);
    req.end();
  });
  return { get, close: () => server.close() };
}

test('a spec is shown as a readable page with its frontmatter as a table, its images and its relative links', async () => {
  const s = await boot(tree());
  try {
    const page = await s.get('/review/design-system/components/form-header/spec.md');
    assert.equal(page.status, 200);
    assert.match(page.type, /text\/html/);
    assert.match(page.body, /<table class="meta">/);
    assert.match(page.body, /<th scope="row">name<\/th><td>form-header<\/td>/);
    assert.match(page.body, /<h1>Form header<\/h1>/);
    assert.match(page.body, /href="\.\.\/button\/spec\.md"/);
    assert.match(page.body, /src="sketch\.svg"/);
    assert.match(page.body, /Open in Obsidian/);
    assert.ok(!page.body.includes('<script>alert'), 'raw HTML in a file is shown as text');
    const image = await s.get('/review/design-system/components/form-header/sketch.svg');
    assert.equal(image.status, 200);
    assert.match(image.type, /image\/svg\+xml/);
    const linked = await s.get('/review/design-system/components/button/spec.md');
    assert.equal(linked.status, 200);
  } finally { s.close(); }
});

test('the route refuses anything outside .design/design-system/, however the path is written', async () => {
  const s = await boot(tree());
  try {
    const attempts = [
      '/review/design-system/../../secret.txt',
      '/review/design-system/%2e%2e/%2e%2e/secret.txt',
      '/review/design-system/..%2f..%2f..%2fsecret.txt',
      '/review/design-system/components/form-header/..%2f..%2f..%2f..%2fsecret.txt',
      '/review/design-system/components/%2e%2e/%2e%2e/%2e%2e/secret.txt',
      '/review/design-system/components/form-header/..%5c..%5c..%5c..%5csecret.txt',
      '/review/design-system/%00',
      '/review/design-system/%E0%A4%A',
      '/review/design-system/',
      '/review/design-system/components',
      '/review/design-system//etc/passwd',
    ];
    for (const path of attempts) {
      const r = await s.get(path);
      assert.ok(r.status === 404 || r.status === 403, `${path} answered ${r.status}`);
      assert.ok(!r.body.includes('outside the design system'), `${path} leaked the file`);
    }
    assert.equal((await s.get('/review/design-system/components/form-header/spec.md', 'POST')).status, 405);
  } finally { s.close(); }
});

test('a link inside the folder that points out of it is refused', async () => {
  const root = tree();
  const { symlinkSync } = await import('node:fs');
  symlinkSync(join(root, 'secret.txt'), join(root, '.design/design-system/components/leak.txt'));
  const s = await boot(root);
  try {
    const r = await s.get('/review/design-system/components/leak.txt');
    assert.equal(r.status, 404);
  } finally { s.close(); }
});

test('the lists the panel loads carry the view and Obsidian links only for components that have a spec', async () => {
  const root = tree();
  for (const f of ['docs/design/design-nodes.json', 'docs/design/feedback-categories.json', 'site/review/source-map.json']) {
    mkdirSync(resolve(root, f, '..'), { recursive: true });
    cpSync(resolve(ROOT, f), resolve(root, f));
  }
  mkdirSync(join(root, 'cms'), { recursive: true });
  const s = await boot(root);
  try {
    const lists = JSON.parse((await s.get('/review/lists')).body);
    const byName = Object.fromEntries(lists.components.map((c) => [c.name, c]));
    assert.equal(byName['form-header'].view, '/review/design-system/components/form-header/spec.md');
    assert.ok(byName['form-header'].obsidian.startsWith('obsidian://open?path='));
    assert.equal(byName.footer.spec, null);
    assert.equal(byName.footer.view, undefined);
    assert.equal(lists.nodes['filter-panel'], 'filters-sheet');
  } finally { s.close(); }
});

// ---------- the ticket ----------

const base = (components) => ({ text: 'The header is cramped.', categories: [], page: 'overview-dashboard', step: 'S-01', spots: [], components, contentKeys: [] });

test('a ticket body links each component with a spec to that file by a relative path, and says so for one without', () => {
  const root = tree();
  const dir = mkdtempSync(join(tmpdir(), 'gabf-links-tickets-'));
  const out = addTicket(dir, base([withSpec(root, 'form-header'), withSpec(root, 'footer')]), { sanitize, categories: [], root });
  const t = findTicket(dir, out.id);
  assert.match(t.body, /## components/);
  const link = /\[Form header\]\(([^)]+)\)/.exec(t.body);
  assert.ok(link, 'the body has a Markdown link');
  assert.ok(!link[1].startsWith('/'), 'the link is relative');
  assert.equal(resolve(dir, 'overview-dashboard', link[1]), resolve(root, '.design/design-system/components/form-header/spec.md'));
  assert.match(t.body, /- Footer, no design system file yet/);
  assert.ok(!/\]\([^)]*footer/.test(t.body), 'no link to a missing file');
  assert.equal(t.data.components[0].spec, '.design/design-system/components/form-header/spec.md');
  assert.equal(t.data.components[1].spec, null);
});

test('editing a ticket note keeps the components section, and changing the components rewrites it', () => {
  const root = tree();
  const dir = mkdtempSync(join(tmpdir(), 'gabf-links-tickets-'));
  const out = addTicket(dir, base([withSpec(root, 'form-header')]), { sanitize, categories: [], root });
  editTicket(dir, out.id, { text: 'The header is far too cramped.' }, { sanitize, categories: [], root });
  let t = findTicket(dir, out.id);
  assert.match(t.body, /^The header is far too cramped\./);
  assert.match(t.body, /\[Form header\]/);
  editTicket(dir, out.id, { components: [withSpec(root, 'button')] }, { sanitize, categories: [], root });
  t = findTicket(dir, out.id);
  assert.match(t.body, /\[Button\]/);
  assert.ok(!/Form header/.test(t.body));
  assert.equal((t.body.match(/## components/g) ?? []).length, 1);
});

test('a ticket registered through the server carries the spec link in its body', async () => {
  const root = tree();
  for (const f of ['docs/design/design-nodes.json', 'docs/design/feedback-categories.json', 'site/review/source-map.json']) {
    mkdirSync(resolve(root, f, '..'), { recursive: true });
    cpSync(resolve(ROOT, f), resolve(root, f));
  }
  cpSync(resolve(ROOT, 'docs/design/sketches/overview.html'), resolve(root, 'docs/design/sketches/overview.html'));
  mkdirSync(join(root, 'cms'), { recursive: true });
  const server = createReviewServer({ root, port: 0, sanitize, rebuild: () => {}, env: { GABF_FEEDBACK_DIR: join(root, 'tickets'), GABF_CMS_DIR: join(root, 'cms') } });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  try {
    const r = await fetch(`http://127.0.0.1:${server.address().port}/review/feedback`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ screen: 'S-01', text: 'Tighten the header.', categories: [], spots: [], components: ['form-header', 'footer'], contentKeys: [] }) });
    const done = await r.json();
    assert.equal(r.status, 200);
    const t = findTicket(join(root, 'tickets'), done.id);
    assert.match(t.body, /\[Form header\]\(\.\.\/\.\.\/\.design\/design-system\/components\/form-header\/spec\.md\)/);
    assert.match(t.body, /Footer, no design system file yet/);
  } finally { server.close(); }
});
