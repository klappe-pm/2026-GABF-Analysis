// Site copy comes from the copy documents (the only place visible text lives). This reads the Markdown copy
// documents the same way scripts/lib/content-md.mjs does and fills {{tokens}} from data.
import { readRepo, listRepo } from './repo';

type Node = string | string[] | { [key: string]: Node };

const KEY_LINE = /^- `([^`]+)`:(?: (.*))?$/;
const HEADING = /^(#{2,6}) `([^`]+)`\s*$/;

export function parseContent(markdown: string): Record<string, Node> {
  const root: Record<string, Node> = {};
  const stack: { level: number; node: Record<string, Node> | string[]; key?: string; parent?: Record<string, Node> }[] = [{ level: 1, node: root }];
  for (const line of markdown.split(/\r?\n/)) {
    const h = line.match(HEADING);
    if (h) {
      const level = h[1].length;
      while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
      const parent = stack[stack.length - 1].node as Record<string, Node>;
      const node: Record<string, Node> = {};
      parent[h[2]] = node;
      stack.push({ level, node, key: h[2], parent });
      continue;
    }
    const k = line.match(KEY_LINE);
    if (k) {
      const node = stack[stack.length - 1].node as Record<string, Node>;
      node[k[1] === '(blank)' ? '' : k[1]] = k[2] ?? '';
      continue;
    }
    const item = line.match(/^- (.+)$/);
    if (item && stack.length > 1) {
      const top = stack[stack.length - 1];
      if (!Array.isArray(top.node)) {
        top.node = [];
        if (top.parent && top.key) top.parent[top.key] = top.node;
      }
      (top.node as string[]).push(item[1]);
    }
  }
  return root;
}

// The site copy is tracked at .docs/content-management-system.
const CMS = '.docs/content-management-system';

let cache: Record<string, Record<string, Node>> | null = null;

function docs() {
  if (cache) return cache;
  cache = {};
  for (const group of ['global', 'pages']) {
    for (const f of listRepo(CMS, group).filter((x) => x.endsWith('.md'))) {
      cache[`${group}.${f.replace(/\.md$/, '')}`] = parseContent(readRepo(CMS, group, f));
    }
  }
  return cache;
}

// Look up a key such as global.filters.groups.when. Label keys may contain dots or spaces.
export function lookup(key: string): Node | undefined {
  const all = docs();
  const docKey = Object.keys(all).find((k) => key.startsWith(`${k}.`));
  if (!docKey) return undefined;
  let node: Node | undefined = all[docKey];
  let parts = key.slice(docKey.length + 1).split('.');
  while (parts.length) {
    const here: Node | undefined = node;
    const n: number | undefined = [...Array(parts.length).keys()].map((i) => parts.length - i).find((len) => here && typeof here === 'object' && !Array.isArray(here) && Object.hasOwn(here, parts.slice(0, len).join('.')));
    if (!n || !here || typeof here !== 'object' || Array.isArray(here)) return undefined;
    node = here[parts.slice(0, n).join('.')];
    parts = parts.slice(n);
  }
  return node;
}

// The visible string for a key, with {{tokens}} filled. A missing key fails the build.
export function t(key: string, values: Record<string, string | number> = {}): string {
  const v = lookup(key);
  if (typeof v !== 'string') throw new Error(`content key ${key} is missing`);
  return fill(v, values);
}

export function list(key: string): string[] {
  const v = lookup(key);
  if (!Array.isArray(v)) throw new Error(`content list ${key} is missing`);
  return v;
}

export function group(key: string): Record<string, string> {
  const v = lookup(key);
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error(`content group ${key} is missing`);
  return Object.fromEntries(Object.entries(v).filter(([, x]) => typeof x === 'string')) as Record<string, string>;
}

export function fill(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (m, name) => {
    if (!Object.hasOwn(values, name)) throw new Error(`no value for {{${name}}} in "${text}"`);
    return String(values[name]);
  });
}

// A written finding from the analysis copy: its frontmatter title and summary and its first body paragraph.
export function finding(name: string): { title: string; summary: string; lead: string; tokens: string[] } {
  const text = readRepo(CMS, 'analysis',`${name}.md`);
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  const front = m ? m[1] : '';
  const body = m ? m[2] : text;
  const field = (k: string) => (front.match(new RegExp(`^${k}: "?(.*?)"?$`, 'm')) ?? [])[1] ?? '';
  const lead = body.split('\n\n').map((p) => p.trim()).find((p) => p && !p.startsWith('#')) ?? '';
  const tokenLine = (front.match(/^tokens: (.*)$/m) ?? [])[1] ?? '';
  const tokens = [...tokenLine.matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  return { title: field('title'), summary: field('summary'), lead, tokens };
}
