import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { applyDesignEdit, checkDesignEdit, setFrontmatterKey, setListLine, tokenShaped, yamlValue } from '../scripts/design-system/edit.mjs';
import { ROOT } from '../scripts/lib/paths.mjs';
import { parseTicket } from '../scripts/lib/review-store.mjs';
import { COMPONENTS_DIR, SETTINGS, WEB, splitFrontmatter } from '../scripts/design-system/lib.mjs';

const changedLines = (a, b) => {
  const x = a.split('\n');
  const y = b.split('\n');
  return y.map((line, i) => (line === x[i] ? null : i)).filter((i) => i !== null);
};

test('a key write changes only that key and keeps every other byte', () => {
  const text = '---\nSeed color: "#4A8F3C"\nColor style: tonal spot\nCorner shape: medium\n---\n\n# Settings\n\n- Seed color: the seed.\n';
  const out = setFrontmatterKey(text, 'Corner shape', 'large');
  assert.equal(out, text.replace('Corner shape: medium', 'Corner shape: large'));
  const hex = setFrontmatterKey(text, 'Seed color', '#3F8A4B');
  assert.equal(hex, text.replace('"#4A8F3C"', '"#3F8A4B"'));
  assert.equal(splitFrontmatter(hex).data['Seed color'], '#3F8A4B');
  // Windows line endings survive.
  const crlf = text.replace(/\n/g, '\r\n');
  assert.equal(setFrontmatterKey(crlf, 'Corner shape', 'small'), crlf.replace('Corner shape: medium', 'Corner shape: small'));
});

test('a list value replaces its own lines only, and a missing key is added at the end of the block', () => {
  const text = '---\nname: chart-card\nSeries colors:\n  - primary\n  - tertiary\nLine width: 2\n---\n\n- Series colors: primary, tertiary\n- Line width: 2\n';
  const out = setListLine(setFrontmatterKey(text, 'Series colors', ['primary', 'secondary', 'outline']), 'Series colors', 'primary, secondary, outline');
  assert.equal(out, '---\nname: chart-card\nSeries colors:\n  - primary\n  - secondary\n  - outline\nLine width: 2\n---\n\n- Series colors: primary, secondary, outline\n- Line width: 2\n');
  const added = setFrontmatterKey(text, 'Point size', 8);
  assert.deepEqual(changedLines(text, added), [6, 7, 8, 9, 10, 11]);
  assert.equal(splitFrontmatter(added).data['Point size'], 8);
  assert.equal(splitFrontmatter(added).data['Line width'], 2);
});

test('values are written so YAML reads them back unchanged', () => {
  for (const v of ['#4A8F3C', 'tonal spot', 'yes', '/', 'surface container', 12, 1.5]) {
    const text = setFrontmatterKey('---\nKey: x\n---\n', 'Key', v);
    assert.deepEqual(splitFrontmatter(text).data.Key, v, String(v));
  }
  assert.equal(yamlValue('#4A8F3C'), '"#4A8F3C"');
});

test('a failing value is refused with a plain reason', async () => {
  const cases = [
    [{ target: 'settings', key: 'Corner shape', value: 'round' }, /must be one of/],
    [{ target: 'settings', key: 'Label font', value: 'Roboto' }, /must be one of: Public Sans, Archivo Narrow|must be one of: Archivo Narrow, Public Sans/],
    [{ target: 'settings', key: 'Seed color', value: null }, /quoted six digit hex/],
    [{ target: 'settings', key: 'Hue', value: 'green' }, /not a setting/],
    [{ target: 'chart-card', key: 'Series colors', value: ['primary', 'tertiary', 'secondary', 'outline', 'surface container'] }, /needs 3 to 1 \(WCAG AA\)/],
    [{ target: '../../etc', key: 'x', value: 'y' }, /no design setting file/],
  ];
  for (const [edit, reason] of cases) {
    const { problems } = await checkDesignEdit(edit);
    assert.ok(problems.length, JSON.stringify(edit));
    assert.match(problems.join(' '), reason, JSON.stringify(edit));
  }
  const before = readFileSync(SETTINGS, 'utf8');
  await assert.rejects(applyDesignEdit({ target: 'settings', key: 'Corner shape', value: 'round' }), (e) => /must be one of/.test(e.problems.join(' ')));
  assert.equal(readFileSync(SETTINGS, 'utf8'), before);
});

const PNG = Buffer.from('89504e470d0a1a0a', 'hex');

test('a saved site setting writes one line and drops a ticket in the feedback pipeline\'s shape', async () => {
  const before = readFileSync(SETTINGS, 'utf8');
  const dir = mkdtempSync(join(tmpdir(), 'design-edit-'));
  const current = splitFrontmatter(before).data['Corner shape'];
  const next = current === 'large' ? 'small' : 'large';
  try {
    const r = await applyDesignEdit({ target: 'settings', key: 'Corner shape', value: next, feedbackDir: dir, capture: async ({ path }) => { writeFileSync(path, PNG); return true; } });
    assert.equal(readFileSync(SETTINGS, 'utf8'), before.replace(`Corner shape: ${current}`, `Corner shape: ${next}`));
    const files = readdirSync(resolve(dir, 'design-system'));
    const md = files.find((f) => f.endsWith('.md'));
    const base = md.replace(/\.md$/, '');
    assert.deepEqual(files.sort(), [base, md].sort());
    assert.deepEqual(readFileSync(resolve(dir, 'design-system', base, 'component.png')), PNG);
    const { data, body } = parseTicket(readFileSync(resolve(dir, 'design-system', md), 'utf8'));
    assert.deepEqual(Object.keys(data), ['id', 'status', 'title', 'page', 'step', 'components', 'created', 'revised', 'images', 'setting-edits']);
    assert.equal(data.status, 'ACCEPTED');
    assert.equal(data.page, 'design-system');
    assert.equal(data.step, null);
    assert.deepEqual(data.components, []);
    assert.deepEqual(data.images, [{ path: `${base}/component.png`, kind: 'component', spot: null, component: null, url: null }]);
    assert.deepEqual(data['setting-edits'], [{ file: '.design/design-system/settings.md', key: 'Corner shape', old: current, new: next }]);
    assert.equal(data.created, data.revised);
    assert.match(body, new RegExp(`\\]\\(${base}/component\\.png\\)`));
    assert.equal(r.ticket.status, 'ACCEPTED');
  } finally {
    writeFileSync(SETTINGS, before);
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a saved component setting links the component spec and the picture of the component', async () => {
  const spec = resolve(COMPONENTS_DIR, 'button', 'spec.md');
  const before = readFileSync(spec, 'utf8');
  const dir = mkdtempSync(join(tmpdir(), 'design-edit-'));
  const current = splitFrontmatter(before).data.Shape;
  const next = current === 'medium' ? 'small' : 'medium';
  try {
    await applyDesignEdit({ target: 'button', key: 'Shape', value: next, feedbackDir: dir, capture: async ({ path }) => { writeFileSync(path, PNG); return true; } });
    const after = readFileSync(spec, 'utf8');
    assert.deepEqual(changedLines(before, after).length, 2, 'the frontmatter line and its what-you-can-change line');
    const md = readdirSync(resolve(dir, 'design-system')).find((f) => f.endsWith('.md'));
    const { data, body } = parseTicket(readFileSync(resolve(dir, 'design-system', md), 'utf8'));
    assert.deepEqual(data.components, [{ name: 'button', spec: '.design/design-system/components/button/spec.md' }]);
    assert.equal(data.images[0].component, 'button');
    assert.deepEqual(data['setting-edits'], [{ file: '.design/design-system/components/button/spec.md', key: 'Shape', old: current, new: next }]);
    const link = /\[Button\]\(([^)]+)\)/.exec(body);
    assert.equal(resolve(dir, 'design-system', link[1]), resolve(ROOT, '.design/design-system/components/button/spec.md'));
  } finally {
    writeFileSync(spec, before);
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a ticket that would carry a token shaped value is refused and nothing is written', async () => {
  const before = readFileSync(SETTINGS, 'utf8');
  const dir = mkdtempSync(join(tmpdir(), 'design-edit-'));
  try {
    const sanitize = (text) => (/Corner shape/.test(text) ? { text: '[REDACTED:token]', redacted: ['token'] } : { text, redacted: [] });
    await assert.rejects(applyDesignEdit({ target: 'settings', key: 'Corner shape', value: 'square', feedbackDir: dir, sanitize }), /shaped like a secret/);
    assert.equal(readFileSync(SETTINGS, 'utf8'), before);
    assert.equal(existsSync(resolve(dir, 'design-system')), false);
    assert.equal(tokenShaped('token ghp_0123456789abcdefghijABCDEFGHIJ').redacted.length > 0, true);
    assert.equal(tokenShaped('#2D6A4F').redacted.length, 0);
  } finally {
    writeFileSync(SETTINGS, before);
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the public export carries no editing code', (t) => {
  const config = readFileSync(resolve(WEB, 'next.config.ts'), 'utf8');
  assert.match(config, /'design-editor': review \? '\.\/design\/editor\.tsx' : '\.\/design\/editor-off\.tsx'/);
  const off = readFileSync(resolve(WEB, 'design/editor-off.tsx'), 'utf8');
  assert.doesNotMatch(off, /fetch|__design|usePreview/);
  for (const file of ['app/design-system/live.tsx', 'app/design-system/page.tsx', 'app/design-system/parts.tsx']) {
    assert.doesNotMatch(readFileSync(resolve(WEB, file), 'utf8'), /design\/editor'|\.\/editor'|__design/, file);
  }
  const out = resolve(WEB, 'out');
  if (!existsSync(resolve(out, 'design-system/index.html'))) { t.skip('web/out is not built here; npm run web:build builds it'); return; }
  const hits = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = resolve(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(js|html|txt)$/.test(name) && /__design\/|data-design-editor/.test(readFileSync(full, 'utf8'))) hits.push(full);
    }
  };
  walk(out);
  assert.deepEqual(hits, []);
});
