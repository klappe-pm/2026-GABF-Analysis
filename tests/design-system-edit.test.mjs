import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { applyDesignEdit, checkDesignEdit, setFrontmatterKey, setListLine, yamlValue } from '../scripts/design-system/edit.mjs';
import { SETTINGS, WEB, splitFrontmatter } from '../scripts/design-system/lib.mjs';

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
  const text = '---\nname: chart-frame\nSeries colors:\n  - primary\n  - tertiary\nLine width: 2\n---\n\n- Series colors: primary, tertiary\n- Line width: 2\n';
  const out = setListLine(setFrontmatterKey(text, 'Series colors', ['primary', 'secondary', 'outline']), 'Series colors', 'primary, secondary, outline');
  assert.equal(out, '---\nname: chart-frame\nSeries colors:\n  - primary\n  - secondary\n  - outline\nLine width: 2\n---\n\n- Series colors: primary, secondary, outline\n- Line width: 2\n');
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
    [{ target: 'chart-frame', key: 'Series colors', value: ['primary', 'tertiary', 'secondary', 'outline', 'surface container'] }, /needs 3 to 1 \(WCAG AA\)/],
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

test('a saved change writes one line and records an ACCEPTED ticket with the old and new value', async () => {
  const before = readFileSync(SETTINGS, 'utf8');
  const dir = mkdtempSync(join(tmpdir(), 'design-edit-'));
  const current = splitFrontmatter(before).data['Corner shape'];
  const next = current === 'large' ? 'small' : 'large';
  try {
    const r = await applyDesignEdit({ target: 'settings', key: 'Corner shape', value: next, feedbackDir: dir });
    const after = readFileSync(SETTINGS, 'utf8');
    assert.equal(after, before.replace(`Corner shape: ${current}`, `Corner shape: ${next}`));
    assert.equal(r.ticket.status, 'ACCEPTED');
    const ticket = readFileSync(resolve(dir, 'design-system', readdirSync(resolve(dir, 'design-system'))[0]), 'utf8');
    assert.match(ticket, /status: ACCEPTED/);
    assert.match(ticket, new RegExp(`- old: ${current}`));
    assert.match(ticket, new RegExp(`- new: ${next}`));
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
