// The review server's endpoints, as the widget calls them. They answer on the same origin as the page.
export class ReviewError extends Error {
  problems: string[];
  constructor(message: string, problems: string[] = []) {
    super(message);
    this.problems = problems;
  }
}

export async function api<T = unknown>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, method === 'GET' ? undefined : { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ReviewError(json.error || `${res.status} ${res.statusText}`.trim(), json.problems ?? []);
  return json as T;
}

export type Step = { id: string; label: string; page: string; surface: string; route: string; path: string };
export type ComponentInfo = { name: string; spec: string | null; view?: string; obsidian?: string };
export type Pipeline = { label: string; state: string; issueUrl: string | null; prUrl: string | null; error: string | null } | null;
export type Recorded = { id: string; title: string; status: string; step: string; pipeline: Pipeline; images: { kind: string; spot: number | null; url: string }[] };
export type Preview = { old: string | null; problems: string[]; instances: { id: string; kind: string; key?: string; file: string; line?: number }[] };

export const words = (s: string) => {
  const t = String(s).replace(/[-_]+/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

// A copy key reads as words: the group, then the path, never the dotted form.
export function keyWords(key: string): string {
  const [head, ...rest] = String(key).split('.');
  const parts = rest.map((p) => p.replace(/[-_]+/g, ' '));
  const group = parts.shift() ?? head;
  return words(group) + (parts.length ? `, ${parts.join(', ')}` : '');
}
