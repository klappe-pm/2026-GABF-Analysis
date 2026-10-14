// Content tagging: resolving a copy key from picked text, the minimal diff write, related
// instances, rejection of rule breaking text, and component derivation. Every test runs against a
// temporary copy of the copy folder and a temporary source tree; the real
// .docs/content-management-system/ is never written.

import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ROOT } from '../scripts/lib/paths.mjs';
import { replaceContentValue, scanContent } from '../scripts/lib/content-md.mjs';
import { copyProblems } from '../scripts/lib/copy-rules.mjs';
import { applyContentEdit, escapeFor, findInstances, findLiterals, loadCopy, matchContent, usedBy } from '../scripts/lib/review-content.mjs';
import { componentsForScreen, componentsForSpot, knownComponents } from '../scripts/lib/review-components.mjs';

const sanitize = (text) => (text.includes('SECRETVALUE') ? { text: text.replace(/SECRETVALUE/g, '[REDACTED:test_shape]'), redacted: ['test_shape'] } : { text, redacted: [] });

const SITE_MD = `---
note: frontmatter stays
---
# Site

Prose for the reader.

## \`footer\`

Where: footer, on every page.

- \`sources\`: Results come from the official winners lists.
- \`skip\`: Skip to content
- \`blank\`:

### \`deep\`

- \`label\`: Skip to content
`;
const HOME_MD = '# Home\r\n\r\n## `hero`\r\n\r\nWhere: top.\r\n\r\n- `title`: Great results  \r\n- `skip_again`: Skip to content\r\n- `other`: Something else\r\n';

function scratch() {
  const root = mkdtempSync(join(tmpdir(), 'gabf-content-'));
  const cms = join(root, '.docs/content-management-system');
  mkdirSync(join(cms, 'global'), { recursive: true });
  mkdirSync(join(cms, 'pages'), { recursive: true });
  writeFileSync(join(cms, 'global/site.md'), SITE_MD);
  writeFileSync(join(cms, 'pages/home.md'), HOME_MD);
  writeFileSync(join(cms, 'inventory.csv'), 'page,location,current_text,new_key\nevery page,skip link,Skip to content,global.site.footer.skip\n');
  mkdirSync(join(root, 'site/assets'), { recursive: true });
  mkdirSync(join(root, 'site/review'), { recursive: true });
  mkdirSync(join(root, 'scripts'), { recursive: true });
  writeFileSync(join(root, 'site/assets/page.mjs'), `const a = 'Skip to content';\nconst b = "Skip to content and more";\nconst html = '<a href="#main">Skip to content</a>';\nconst c = \`Skip to content\`;\n`);
  writeFileSync(join(root, 'scripts/build.mjs'), `export const layout = '<a class="skip-link" href="#main">Skip to content</a>';\n`);
  writeFileSync(join(root, 'site/review/hidden.mjs'), `const x = 'Skip to content';\n`);
  return { root, cms };
}

test('the key mapping resolves a dotted key and a line from a copy document', () => {
  const entries = scanContent(SITE_MD);
  assert.deepEqual(entries.map((e) => e.key), ['footer.sources', 'footer.skip', 'footer.blank', 'footer.deep.label']);
  assert.equal(entries[1].value, 'Skip to content');
  assert.equal(entries[2].value, '');
  const { cms } = scratch();
  const copy = loadCopy(cms);
  assert.ok(copy.some((e) => e.key === 'global.site.footer.skip' && e.file === 'global/site.md'));
  assert.ok(copy.some((e) => e.key === 'pages.home.hero.title' && e.value === 'Great results  '));
});

test('picked text resolves to its copy key: exactly, through the inventory, and by containment', () => {
  const { cms } = scratch();
  const copy = loadCopy(cms);
  const exact = matchContent('Skip to content', copy);
  assert.deepEqual(exact.map((e) => e.key).sort(), ['global.site.footer.deep.label', 'global.site.footer.skip', 'pages.home.hero.skip_again']);
  assert.ok(exact.every((e) => e.match === 'exact'));
  const edited = copy.map((e) => (e.key === 'global.site.footer.skip' ? { ...e, value: 'Jump to content' } : e));
  const viaInventory = matchContent('Skip to content', edited.filter((e) => e.key === 'global.site.footer.skip'), [{ current_text: 'Skip to content', new_key: 'global.site.footer.skip' }]);
  assert.equal(viaInventory[0].match, 'inventory');
  const inside = matchContent('Intro. Results come from the official winners lists. More.', copy);
  assert.equal(inside[0].key, 'global.site.footer.sources');
  assert.equal(inside[0].match, 'inside');
  assert.deepEqual(matchContent('Nothing like it', copy), []);
});

test('a value with placeholders matches only text its own words mostly make up', () => {
  const copy = [
    { key: 'a.title', file: 'a.md', line: 0, value: 'Great American Beer Festival {{year}}' },
    { key: 'a.only', file: 'a.md', line: 1, value: '{{year}}' },
  ];
  assert.deepEqual(matchContent('Great American Beer Festival 2026', copy).map((e) => e.key), ['a.title']);
  assert.deepEqual(matchContent('Great American Beer Festival results dashboards', copy), []);
  assert.deepEqual(matchContent('2026', copy), []);
});

test('the write changes one value and keeps every other byte, line endings included', () => {
  const entry = scanContent(SITE_MD)[0];
  const next = replaceContentValue(SITE_MD, entry.line, entry.name, entry.value, 'Results come from the winners lists.');
  const a = SITE_MD.split('\n');
  const b = next.split('\n');
  assert.equal(a.length, b.length);
  const changed = a.map((l, i) => (l === b[i] ? null : i)).filter((i) => i !== null);
  assert.deepEqual(changed, [entry.line]);
  assert.equal(b[entry.line], '- `sources`: Results come from the winners lists.');
  assert.ok(next.startsWith('---\nnote: frontmatter stays\n---\n# Site'));
  const crlf = scanContent(HOME_MD).find((e) => e.name === 'skip_again');
  const out = replaceContentValue(HOME_MD, crlf.line, crlf.name, crlf.value, 'Jump to content');
  assert.equal(out, HOME_MD.replace('Skip to content', 'Jump to content'));
  assert.ok(out.includes('- `title`: Great results  \r\n'), 'trailing spaces and CRLF of the neighbors are untouched');
  assert.throws(() => replaceContentValue(SITE_MD, entry.line, entry.name, 'not the value', 'x'), /changed since it was read/);
});

test('related instances: other copy keys and hard coded strings with the identical text', () => {
  const { root, cms } = scratch();
  const primary = loadCopy(cms).find((e) => e.key === 'global.site.footer.skip');
  const found = findInstances(root, cms, primary, 'Skip to content');
  const kinds = found.map((i) => `${i.kind}:${i.key ?? i.file}`).sort();
  assert.deepEqual(kinds, [
    'copy:global.site.footer.deep.label',
    'copy:pages.home.hero.skip_again',
    'source:scripts/build.mjs',
    'source:site/assets/page.mjs',
    'source:site/assets/page.mjs',
    'source:site/assets/page.mjs',
  ]);
  assert.ok(!found.some((i) => i.file === 'site/review/hidden.mjs'), 'the review tools are not instances');
  assert.ok(!found.some((i) => i.excerpt?.includes('and more')), 'a longer sentence is not an instance');
  assert.deepEqual(findLiterals("x = 'Menu button'", 'Menu'), []);
  assert.equal(findLiterals("x = 'Menu'", 'Menu').length, 1);
});

test('the edit updates the key and every checked instance, and nothing unchecked', () => {
  const { root, cms } = scratch();
  const all = findInstances(root, cms, loadCopy(cms).find((e) => e.key === 'global.site.footer.skip'), 'Skip to content');
  const skipHome = all.find((i) => i.key === 'pages.home.hero.skip_again');
  const skipBuild = all.find((i) => i.file === 'scripts/build.mjs');
  const take = all.filter((i) => i.id !== skipHome.id && i.id !== skipBuild.id).map((i) => i.id);
  const record = applyContentEdit(root, { cmsDir: cms, key: 'global.site.footer.skip', newValue: "Don't skip to content", take, sanitize });
  assert.equal(record.old, 'Skip to content');
  assert.equal(record.new, "Don't skip to content");
  assert.equal(record.file, '.docs/content-management-system/global/site.md');
  assert.equal(record.instances.length, take.length);
  const site = readFileSync(join(cms, 'global/site.md'), 'utf8');
  assert.ok(site.includes("- `skip`: Don't skip to content\n"));
  assert.ok(site.includes('- `label`: Don\'t skip to content\n'));
  assert.ok(readFileSync(join(cms, 'pages/home.md'), 'utf8').includes('- `skip_again`: Skip to content\r\n'), 'an unchecked copy key stays');
  const page = readFileSync(join(root, 'site/assets/page.mjs'), 'utf8');
  assert.ok(page.includes("const a = 'Don\\'t skip to content';"));
  assert.ok(page.includes('<a href="#main">Don\'t skip to content</a>'));
  assert.ok(page.includes('const b = "Skip to content and more";'));
  assert.ok(page.includes('const c = `Don\'t skip to content`;'));
  assert.ok(readFileSync(join(root, 'scripts/build.mjs'), 'utf8').includes('>Skip to content</a>'), 'an unchecked source string stays');
  assert.ok(readFileSync(join(root, 'site/review/hidden.mjs'), 'utf8').includes('Skip to content'));
});

test('escaping follows the quote the old text sat in', () => {
  assert.equal(escapeFor("'", "it's"), "it\\'s");
  assert.equal(escapeFor('"', 'say "hi"'), 'say \\"hi\\"');
  assert.equal(escapeFor('`', 'a ${b} `c`'), 'a \\${b} \\`c\\`');
  assert.equal(escapeFor('>', 'Fish & <chips>'), 'Fish &amp; &lt;chips&gt;');
});

test('text that breaks the prose rules or looks like a secret is refused and nothing is written', () => {
  const { root, cms } = scratch();
  const before = readFileSync(join(cms, 'global/site.md'), 'utf8');
  const em = String.fromCharCode(0x2014);
  const bad = [
    [`Skip ${em} to content`, /dash/],
    ['Skip - to content', /dash/],
    ['Skip -- to content', /dash/],
    ['Skip to content-now-here', /data slug/],
    ['Skip SECRETVALUE', /secret/],
    ['', /empty/],
    ['Two\nlines', /one line/],
  ];
  for (const [text, why] of bad) {
    assert.throws(() => applyContentEdit(root, { cmsDir: cms, key: 'global.site.footer.skip', newValue: text, take: [], sanitize }), (error) => { assert.match(error.problems.join(' '), why); return true; });
  }
  assert.throws(() => applyContentEdit(root, { cmsDir: cms, key: 'global.site.footer.nope', newValue: 'x', take: [], sanitize }), /No copy entry/);
  assert.throws(() => applyContentEdit(root, { cmsDir: cms, key: 'global.site.footer.skip', newValue: 'Skip to content', take: [], sanitize }), /same as the current/);
  assert.equal(readFileSync(join(cms, 'global/site.md'), 'utf8'), before);
  assert.deepEqual(copyProblems('Strong and barrel-aged, gluten-free', { previous: '' }), []);
  assert.deepEqual(copyProblems('Channel: self-distribution', { previous: 'Channel: self-distribution' }), []);
  assert.equal(copyProblems('Ranges run 3 to 5.').length, 0);
});

test('usedBy names the components that list the key and the screens whose copy carries the text', () => {
  const { root, cms } = scratch();
  const spec = join(root, '.design/design-system/components/form-note');
  mkdirSync(spec, { recursive: true });
  writeFileSync(join(spec, 'spec.md'), '---\ncontent:\n  - global.site.footer.skip\nname: form-note\n---\n# spec\n');
  const manifest = { nodes: { 'copy:skip': { kind: 'copy', content: 'Skip to content', consumes: [] }, 'screen:S-01': { kind: 'screen', consumes: ['copy:skip'] }, 'screen:S-02': { kind: 'screen', consumes: [] } } };
  const primary = loadCopy(cms).find((e) => e.key === 'global.site.footer.skip');
  const used = usedBy(root, cms, primary, 'Skip to content', manifest);
  assert.deepEqual(used.components, ['form-note']);
  assert.deepEqual(used.screens, ['S-01']);
  assert.deepEqual(used.pages, ['every page']);
});

// ---------- components ----------

test('a picked spot links to the design system component the source map names for its region', () => {
  const root = mkdtempSync(join(tmpdir(), 'gabf-components-'));
  cpSync(resolve(ROOT, 'site/review'), join(root, 'site/review'), { recursive: true });
  const spot = { matches: [{ via: 'dialog.filter-panel', instance: 'dialog.filter-panel' }, { via: '.filter-trigger' }, { via: 'data-src' }] };
  const none = componentsForSpot(root, spot);
  assert.deepEqual(none.map((c) => c.name), ['filters-sheet']);
  assert.deepEqual(none[0], { name: 'filters-sheet', spec: null, instance: 'dialog.filter-panel' });
  mkdirSync(join(root, '.design/design-system/components/filters-sheet'), { recursive: true });
  writeFileSync(join(root, '.design/design-system/components/filters-sheet/spec.md'), '# spec\n');
  assert.equal(componentsForSpot(root, spot)[0].spec, '.design/design-system/components/filters-sheet/spec.md');
  assert.deepEqual(componentsForSpot(root, { matches: [] }), []);
});

test('a whole page links to the components its screen consumes, and the absence of .design/ is no error', () => {
  const manifest = JSON.parse(readFileSync(resolve(ROOT, 'docs/design/design-nodes.json'), 'utf8'));
  const root = mkdtempSync(join(tmpdir(), 'gabf-components-'));
  cpSync(resolve(ROOT, 'site/review'), join(root, 'site/review'), { recursive: true });
  const names = componentsForScreen(root, manifest, 'S-02').map((c) => c.name);
  assert.ok(names.includes('active-filters'));
  assert.ok(names.includes('chart-frame'));
  assert.ok(componentsForScreen(root, manifest, 'S-02').every((c) => c.spec === null));
  assert.deepEqual(componentsForScreen(root, manifest, 'S-99'), []);
  assert.ok(knownComponents(root, manifest).includes('estimate-popover'));
  assert.ok(!existsSync(join(root, '.design')));
});

test('the real copy folder, when the checkout has one, resolves a known label to its key', () => {
  const cms = resolve(ROOT, '.docs/content-management-system');
  if (!existsSync(cms)) return;
  const copy = loadCopy(cms);
  assert.ok(copy.length > 500);
  const hit = matchContent('Skip to content', copy);
  assert.ok(hit.some((e) => e.key === 'global.site.header.skip_link'));
});
