import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkMarkdown, isPublicFacing } from '../scripts/check-prose.mjs';

test('checkMarkdown flags dashes, hard wraps, and heading case', () => {
  const bad = ['# Bad Heading', '', 'A sentence — with an em dash.', 'A line that is wrapped', 'onto a second line.', '', 'Spaced - hyphen here.', ''].join('\n');
  const problems = checkMarkdown(bad);
  const rules = problems.map((p) => p.rule);
  assert.ok(rules.includes('heading-case'));
  assert.ok(rules.includes('dash'));
  assert.ok(rules.includes('hard-wrap'));
});

test('checkMarkdown accepts compliant markdown and skips code fences and frontmatter', () => {
  const good = ['---', 'title: x -- y', '---', '', '# good-heading', '', 'One line paragraph, with a list below.', '', '- item one', '- item two', '', '```bash', 'ls -la --color', '```', '', '| a | b |', '|---|---|', '| 1 | 2 |', ''].join('\n');
  assert.deepEqual(checkMarkdown(good), []);
});

test('public facing files may use normal case headings but keep the dash and hard wrap rules', () => {
  for (const rel of ['README.md', 'CONTRIBUTING.md', 'SECURITY.md', 'CODE_OF_CONDUCT.md', 'CHANGELOG.md', 'PRODUCT.md', 'DESIGN.md', '.github/pull_request_template.md', '.github/ISSUE_TEMPLATE/bug-report.md']) {
    assert.equal(isPublicFacing(rel), true, rel);
  }
  for (const rel of ['docs/x/README.md', 'docs/2026/winner/AGENTS.md', 'CLAUDE.md', 'docs/CONTRIBUTING.md', 'docs/DESIGN.md', 'breweries/template-brewery.md']) {
    assert.equal(isPublicFacing(rel), false, rel);
  }
  const titled = ['# GABF Analysis', '', '## Quick start', '', 'One line paragraph.', ''].join('\n');
  assert.deepEqual(checkMarkdown(titled, { publicFacing: isPublicFacing('CONTRIBUTING.md') }), []);
  const nested = checkMarkdown(titled, { fileName: 'README.md', publicFacing: isPublicFacing('docs/x/README.md') });
  assert.ok(nested.some((p) => p.rule === 'heading-case'));
  const emDash = String.fromCharCode(0x2014);
  const sloppy = ['## Quick start', '', `A sentence ${emDash} with an em dash.`, 'Wrapped onto', 'a second line.', ''].join('\n');
  const rules = checkMarkdown(sloppy, { publicFacing: true }).map((p) => p.rule);
  assert.ok(!rules.includes('heading-case'));
  assert.ok(rules.includes('dash'));
  assert.ok(rules.includes('hard-wrap'));
});

test('the published design system under .design/design-system/ is public facing; lookalike paths are not', () => {
  for (const rel of ['.design/design-system/components/button/spec.md', '.design/design-system/foundations/color.md']) {
    assert.equal(isPublicFacing(rel), true, rel);
  }
  for (const rel of ['.design/other/spec.md', 'design-system/spec.md', '.docs/design/design-system/notes.md', 'docs/design-system/README.md']) {
    assert.equal(isPublicFacing(rel), false, rel);
  }
  const spec = ['---', 'name: button', '---', '', '## Purpose and when to use', '', 'One line paragraph.', ''].join('\n');
  assert.deepEqual(checkMarkdown(spec, { publicFacing: isPublicFacing('.design/design-system/components/button/spec.md') }), []);
  const rules = checkMarkdown('## Purpose\n\nWrapped onto\na second line.\n', { publicFacing: true }).map((p) => p.rule);
  assert.ok(rules.includes('hard-wrap'));
});

test('site copy under .docs/content-management-system/ is public facing; lookalike paths elsewhere are not', () => {
  for (const rel of ['.docs/content-management-system/README.md', '.docs/content-management-system/voice.md', '.docs/content-management-system/analysis/medal-odds-by-category.md']) {
    assert.equal(isPublicFacing(rel), true, rel);
  }
  for (const rel of ['docs/content/README.md', 'content/README.md', '.docs/other/README.md', 'breweries/content.md']) {
    assert.equal(isPublicFacing(rel), false, rel);
  }
  const page = ['---', 'title: "Medal odds"', '---', '', '# Medal odds by category', '', 'One line paragraph.', ''].join('\n');
  assert.deepEqual(checkMarkdown(page, { publicFacing: isPublicFacing('.docs/content-management-system/analysis/medal-odds-by-category.md') }), []);
  assert.ok(checkMarkdown(page, { publicFacing: isPublicFacing('docs/content/README.md') }).some((p) => p.rule === 'heading-case'));
});
