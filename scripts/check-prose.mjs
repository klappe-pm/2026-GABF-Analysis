#!/usr/bin/env node
// Prose checks for every markdown file in the repository (outside node_modules and dist):
//   1. no dash used as punctuation (em dash, en dash, spaced hyphen, double hyphen),
//   2. no hard-wrapped paragraphs,
//   3. headings in lowercase kebab-case (the root README H1 may carry the project name).
// Public facing files (the root README, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT, CHANGELOG,
// PRODUCT, and DESIGN, anything under .github/, and the site copy under .docs/content-management-system/) may use title or sentence
// case headings; rules 1 and 2 still apply.
// Code fences and frontmatter are skipped.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { ROOT } from './lib/paths.mjs';

// .impeccable holds the design tool's working files (critiques, surface briefs), not site prose.
const SKIP_DIRS = new Set(['node_modules', 'dist', 'dist-review', '.git', 'data', '.impeccable']);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = resolve(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (entry.endsWith('.md')) out.push(full);
  }
  return out;
}

const RESERVED = new Set(['README.md', 'CLAUDE.md', 'AGENTS.md', 'CODEX.md', 'GEMINI.md', 'MEMORY.md']);

// Root level files GitHub shows to visitors; headings there follow normal case.
// PRODUCT.md and DESIGN.md follow the Impeccable design schema, whose headings are title case.
const PUBLIC_FACING = new Set(['README.md', 'CONTRIBUTING.md', 'SECURITY.md', 'CODE_OF_CONDUCT.md', 'CHANGELOG.md', 'PRODUCT.md', 'DESIGN.md']);

// True when a repository relative path (forward slashes) is exempt from the kebab heading rule.
export function isPublicFacing(rel) {
  const path = rel.split('\\').join('/');
  return PUBLIC_FACING.has(path) || path.startsWith('.github/') || path.startsWith('.docs/content-management-system/');
}

export function checkMarkdown(text, { isRootReadme = false, fileName = '', publicFacing = false } = {}) {
  const problems = [];
  const lines = text.split(/\r?\n/);
  let inFence = false;
  let inFrontmatter = false;
  let paragraphRun = [];
  const flushParagraph = () => {
    if (paragraphRun.length > 1) problems.push({ line: paragraphRun[0].n, rule: 'hard-wrap', text: `${paragraphRun.length} consecutive prose lines; join them into one line` });
    paragraphRun = [];
  };
  lines.forEach((line, idx) => {
    const n = idx + 1;
    if (idx === 0 && line.trim() === '---') { inFrontmatter = true; return; }
    if (inFrontmatter) { if (line.trim() === '---') inFrontmatter = false; return; }
    if (/^\s*```/.test(line)) { inFence = !inFence; flushParagraph(); return; }
    if (inFence) return;
    const trimmed = line.trim();
    if (/[–—]/.test(line)) problems.push({ line: n, rule: 'dash', text: 'em or en dash used as punctuation' });
    const withoutMarker = line.replace(/^\s*[-*]\s+/, '').replace(/^\s*\d+\.\s+/, '');
    if (/\s-\s/.test(withoutMarker.replace(/`[^`]*`/g, '')) && !/^\|/.test(trimmed)) problems.push({ line: n, rule: 'dash', text: 'spaced hyphen used as punctuation' });
    if (/(^|[^-`])--([^->]|$)/.test(withoutMarker.replace(/`[^`]*`/g, '').replace(/<!--|-->/g, ''))) problems.push({ line: n, rule: 'dash', text: 'double hyphen used as punctuation' });
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      flushParagraph();
      const textPart = heading[2].trim();
      const allowed = heading[1] === '#' && (isRootReadme || (RESERVED.has(fileName) && textPart === fileName.toUpperCase()));
      if (!allowed && !publicFacing && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(textPart)) problems.push({ line: n, rule: 'heading-case', text: `heading "${textPart}" is not lowercase kebab-case` });
      return;
    }
    const isProse = trimmed.length > 0 && !/^[-*]\s/.test(trimmed) && !/^\d+\.\s/.test(trimmed) && !/^\|/.test(trimmed) && !/^>/.test(trimmed) && !/^<!--/.test(trimmed) && !/^!\[/.test(trimmed);
    if (isProse) paragraphRun.push({ n, line });
    else flushParagraph();
  });
  flushParagraph();
  return problems;
}

// The files the repository holds: tracked Markdown plus new files git would add. Local notes git
// ignores (such as private files under .docs/) are never committed, so they are not checked.
// Outside a git checkout, fall back to walking the tree.
function repositoryMarkdown() {
  try {
    const out = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', '*.md'], { cwd: ROOT, encoding: 'utf8' });
    return [...new Set(out.split('\0').filter(Boolean))]
      .filter((rel) => !rel.split('/').some((part) => SKIP_DIRS.has(part)))
      .map((rel) => resolve(ROOT, rel))
      .filter((full) => existsSync(full));
  } catch {
    return walk(ROOT);
  }
}

function main() {
  const files = repositoryMarkdown();
  let total = 0;
  for (const file of files) {
    const rel = relative(ROOT, file);
    const problems = checkMarkdown(readFileSync(file, 'utf8'), { isRootReadme: rel === 'README.md', fileName: rel.split('/').pop(), publicFacing: isPublicFacing(rel) });
    for (const p of problems) {
      total += 1;
      console.log(`${rel}:${p.line} [${p.rule}] ${p.text}`);
    }
  }
  console.log(`${files.length} markdown files checked, ${total} problems`);
  process.exit(total ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
