import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkMarkdown } from '../scripts/check-prose.mjs';

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
