// The issue form and the issue body renderer carry the same sections, the labels are the set the
// pipeline creates, titles are plain words, and the body links every component and every image.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { ROOT } from '../scripts/lib/paths.mjs';
import { FEEDBACK_LABEL, KIND_LABELS, NO_RESPONSE, SECTIONS, STATUS_LABELS, issueTitle, labelSpec, labelsFor, plain, renderIssueBody, sectionsOf } from '../scripts/lib/feedback-issue.mjs';
import { loadCategories } from '../scripts/lib/review-store.mjs';

// Built from code points so this source carries no dash glyph itself.
const EN = String.fromCharCode(0x2013);
const EM = String.fromCharCode(0x2014);

const template = parse(readFileSync(resolve(ROOT, '.github/ISSUE_TEMPLATE/design-feedback.yml'), 'utf8'));
const fields = template.body.filter((b) => b.type !== 'markdown');

const ticket = (extra = {}) => ({
  data: {
    id: 'WI-007', status: 'ACCEPTED', title: 'Make the heading clearer', page: 'overview-dashboard', job: 'JOB-1', 'job-title': 'See who wins', step: 'S-01', state: 'overview-default',
    route: '/', hash: '#year=2026',
    spots: [{ n: 1, selector: 'main h1', rect: { x: 1, y: 2, width: 3, height: 4 }, text: 'Medals by year' }],
    components: [{ name: 'chart-figure', spec: '.design/design-system/components/chart-figure/spec.md' }, { name: 'ghost-part', spec: null }],
    images: [{ path: 'wi-007-make/page.png', kind: 'page', spot: null, component: null, url: null }, { path: 'wi-007-make/spot-1.png', kind: 'spot', spot: 1, component: 'chart-figure', url: null }],
    'content-edits': [{ key: 'pages.overview.title', file: '.docs/content-management-system/pages/overview.md', old: 'Medals by year', new: 'Medals each year', instances: [{ kind: 'source', file: 'site/x.mjs', line: 3 }] }],
    categories: ['Content', 'Heading'], ...extra,
  },
  body: 'Make the heading clearer.\n\n## components\n\n- Chart figure',
});

test('the issue form fields are the renderer sections, in order', () => {
  assert.deepEqual(fields.map((f) => f.attributes.label), SECTIONS);
  assert.deepEqual(sectionsOf(renderIssueBody(ticket())), SECTIONS);
});

test('the form lists exactly the review categories', () => {
  const cats = fields.find((f) => f.id === 'categories').attributes.options.map((o) => o.label);
  assert.deepEqual(cats, loadCategories(ROOT));
});

test('an empty section reads as the form leaves it', () => {
  const body = renderIssueBody(ticket({ spots: [], components: [], images: [], 'content-edits': [] }));
  assert.match(body, /### Spots\n\n_No response_/);
  assert.match(body, /### Setting edits\n\n_No response_/);
  assert.ok(body.includes(NO_RESPONSE));
});

test('every component is a link to its spec on main, and one without a file says so', () => {
  const body = renderIssueBody(ticket());
  assert.match(body, /\[Chart figure\]\(https:\/\/github\.com\/klappe-pm\/GABF-Analysis\/blob\/main\/\.design\/design-system\/components\/chart-figure\/spec\.md\)/);
  assert.match(body, /Ghost part, no design system file yet/);
});

test('every image is embedded and also a link that opens it', () => {
  const url = 'https://github.com/klappe-pm/GABF-Analysis/blob/main/docs/feedback/overview-dashboard/wi-007-make/spot-1.png?raw=true';
  const body = renderIssueBody(ticket());
  assert.ok(body.includes(`[![Spot 1, Chart figure](${url})](${url})`));
  assert.ok(body.includes('[![Page](https://github.com/klappe-pm/GABF-Analysis/blob/main/docs/feedback/overview-dashboard/wi-007-make/page.png?raw=true)]'));
  const onBranch = renderIssueBody(ticket(), { ref: 'feedback/wi-007-x' });
  assert.ok(onBranch.includes('/blob/feedback/wi-007-x/docs/feedback/overview-dashboard/wi-007-make/page.png?raw=true'));
});

test('a component image from the design system Save is accepted', () => {
  const body = renderIssueBody(ticket({ images: [{ path: 'wi-8-b/component.png', kind: 'component', spot: null, component: 'button', url: null }] }));
  assert.match(body, /Component, Button/);
});

test('the body has no dash used as punctuation and no data slug in a heading or title', () => {
  const t = ticket({ title: `brewery-detail spacing ${EM} too tight`, state: 'brewery-default', 'content-edits': [] });
  const body = renderIssueBody(t);
  const prose = body.replace(/`[^`]*`/g, '').replace(/\(https?:[^)]*\)/g, '').replace(/^- /gm, '');
  assert.ok(!new RegExp(` - |--|${EN}|${EM}`).test(prose), prose);
  assert.equal(issueTitle(t), 'brewery detail spacing, too tight');
  assert.equal(plain(`a ${EM} b`), 'a, b');
});

test('a copy edit and a setting edit title the issue in plain words', () => {
  assert.equal(issueTitle(ticket()), 'Change "Medals by year" to "Medals each year"');
  assert.equal(issueTitle(ticket({ 'content-edits': [], 'setting-edits': [{ file: 'a.json', key: 'color.brand', old: '#fff', new: '#000' }] })), 'Change color.brand from #fff to #000');
});

test('the labels: feedback, one per category, the page, the kind, and the three statuses', () => {
  assert.deepEqual(labelsFor(ticket().data), [FEEDBACK_LABEL, 'Content', 'Heading', 'page: Overview dashboard', KIND_LABELS.content]);
  assert.equal(labelsFor(ticket({ 'content-edits': [] }).data).at(-1), 'kind: design');
  assert.equal(labelsFor(ticket({ 'content-edits': [], 'setting-edits': [{ file: 'a', key: 'b', old: '1', new: '2' }] }).data).at(-1), 'kind: setting');
  assert.deepEqual(Object.values(STATUS_LABELS), ['status: in progress', 'status: done', 'status: needs attention']);
  for (const name of [FEEDBACK_LABEL, 'Bug', 'page: Brewery detail', 'kind: setting', 'status: done']) {
    const spec = labelSpec(name);
    assert.match(spec.color, /^[0-9a-f]{6}$/);
    assert.ok(spec.description.length > 5);
  }
});
