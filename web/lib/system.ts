// Reads the design system for the style guide: resolved tokens and contrast from the published token
// document, and each component's spec from .design/design-system/components/<name>/spec.md.
import { listRepo, readRepo, splitFrontmatter } from './repo';

export type TokenNode = {
  id: string; kind: 'token'; type: string; cssVar: string; tailwind: string | null; description: string;
  value?: unknown; alias?: unknown;
};
export type ContrastRow = { theme: string; token: string; against: string; fg: string; bg: string; ratio: number; min: number; pass: boolean };

type TokenDoc = { nodes: (TokenNode | { kind: 'component' })[]; contrast: ContrastRow[] };

let doc: TokenDoc | null = null;
function tokenDoc(): TokenDoc {
  doc ??= JSON.parse(readRepo('docs', 'design', 'design-system-tokens.json')) as TokenDoc;
  return doc;
}

export const tokens = () => tokenDoc().nodes.filter((n): n is TokenNode => n.kind === 'token');
export const token = (id: string) => {
  const t = tokens().find((n) => n.id === id);
  if (!t) throw new Error(`token ${id} is missing`);
  return t;
};
export const contrastRows = () => tokenDoc().contrast;

export type Spec = { name: string; title: string; status: string; code: string; path: string; sections: Record<string, string> };

export function specs(): Spec[] {
  return listRepo('.design', 'design-system', 'components').sort().map((dir) => {
    const path = `.design/design-system/components/${dir}/spec.md`;
    const { data, body } = splitFrontmatter(readRepo(path));
    const sections: Record<string, string> = {};
    let current = '';
    for (const line of body.split('\n')) {
      const h = line.match(/^## (.+)$/);
      if (h) { current = h[1].trim(); sections[current] = ''; continue; }
      if (current) sections[current] += `${line}\n`;
    }
    for (const k of Object.keys(sections)) sections[k] = sections[k].trim();
    return { name: String(data.name), title: String(data.title), status: String(data.status), code: String(data.code), path, sections };
  });
}

export function spec(name: string): Spec {
  const s = specs().find((x) => x.name === name);
  if (!s) throw new Error(`spec ${name} is missing`);
  return s;
}

// The first paragraph of a spec section, as plain text (inline code marks removed).
export function firstParagraph(text: string): string {
  return (text.split(/\n\s*\n/)[0] ?? '').replace(/`([^`]+)`/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim();
}
