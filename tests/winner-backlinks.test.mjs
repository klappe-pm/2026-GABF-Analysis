// The related section of each 2026 winner profile: present once, links resolve to existing files,
// grown-farm links never read as though the brewery named the farm, and rerunning changes nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { applyRelated, relatedSection } from '../scripts/apply-winner-backlinks.mjs';
import { ROOT } from '../scripts/lib/paths.mjs';

const dir = resolve(ROOT, 'docs/2026/winner');
const files = readdirSync(dir).filter((f) => /^\d{3}-.+\.md$/.test(f));
const sectionOf = (text) => text.match(/^## related\s*\n([\s\S]*?)(?=^## |(?![\s\S]))/m)?.[1] ?? null;

test('every profile has one related section, placed before the links section', () => {
  for (const f of files) {
    const text = readFileSync(resolve(dir, f), 'utf8');
    assert.equal((text.match(/^## related\s*$/gm) ?? []).length, 1, `${f}: one related section`);
    const links = text.search(/^## links\s*$/m);
    if (links >= 0) assert.ok(text.search(/^## related\s*$/m) < links, `${f}: related comes before links`);
  }
});

test('every link in a related section resolves to an existing file', () => {
  const missing = [];
  for (const f of files) {
    const section = sectionOf(readFileSync(resolve(dir, f), 'utf8')) ?? '';
    for (const m of section.matchAll(/\]\(([^)]+)\)/g)) {
      const target = resolve(dirname(resolve(dir, f)), decodeURIComponent(m[1]));
      if (!existsSync(target)) missing.push(`${f}: ${m[1]}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('grown-farm links are worded as grown by, and the section is replaced, not duplicated', () => {
  const rows = [
    { link_kind: 'brewery', link_text: 'Example Brewing', relative_link: '../../breweries/example.md' },
    { link_kind: 'farm-grown', link_text: 'Example Farm', relative_link: '../../hops/farms/example-farm.md' },
  ];
  const section = relatedSection(rows);
  assert.match(section, /grown by \[Example Farm\]/);
  assert.doesNotMatch(section, /names for this beer/);
  const doc = '---\ndomain: beer\n---\n\n# x\n\n## ingredients\n\nText.\n\n## links\n\n- a\n';
  const once = applyRelated(doc, section);
  assert.equal(applyRelated(once, section), once);
  assert.ok(once.indexOf('## related') < once.indexOf('## links'));
});
