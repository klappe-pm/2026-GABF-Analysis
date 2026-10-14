import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';

// The web app builds from the repository: data/, docs/, content/, and .design/ sit one level up.
export const REPO = resolve(process.cwd(), '..');
export const fromRepo = (...parts: string[]) => resolve(REPO, ...parts);
export const readRepo = (...parts: string[]) => readFileSync(fromRepo(...parts), 'utf8');
export const existsInRepo = (...parts: string[]) => existsSync(fromRepo(...parts));
export const listRepo = (...parts: string[]) => readdirSync(fromRepo(...parts));

// Where a repository file is published, for links from the style guide.
export const SOURCE_URL = 'https://github.com/klappe-pm/GABF-Analysis/blob/main';

export function splitFrontmatter(text: string): { data: Record<string, unknown>; body: string } {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: text };
  return { data: (parseYaml(m[1]) ?? {}) as Record<string, unknown>, body: m[2] };
}

// Parse CSV with quoted fields (quotes may hold commas and doubled quotes).
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field); field = '';
      if (row.some((v) => v !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows;
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}
