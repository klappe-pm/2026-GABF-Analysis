// Winner research profiles (docs/<year>/winner/NNN-*.md): one markdown file per medal with the
// beer's published specs in frontmatter and the research in the body. Shared by the site build
// and the explorer build, so both match profiles to medal rows the same way.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseFrontmatter } from './frontmatter.mjs';
import { ROOT } from './paths.mjs';

// Beer name, medal, and award category are unique within a year. A category matches with or without the word
// Style, which every category name drops.
const withoutStyle = (name) => String(name ?? '').replace(/[-\s]+Style\b/gi, '');
export const matchKey = (beer, medal, category) =>
  [beer, medal, withoutStyle(category)].map((s) => String(s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '')).join('|');

// Profiles start with the category number; AGENTS.md and other notes are skipped.
export function loadWinnerProfiles(year = 2026, dir = resolve(ROOT, 'docs', String(year), 'winner')) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => /^\d{3}-.+\.md$/.test(f)).sort().map((file) => {
    const { data, body } = parseFrontmatter(readFileSync(resolve(dir, file), 'utf8'));
    const stem = file.replace(/\.md$/, '');
    return { year: Number(year), file, stem, fm: data, body, key: matchKey(data.beer, data.medal, data['category-name']) };
  });
}
