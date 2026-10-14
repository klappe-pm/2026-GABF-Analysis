// The review widget's words, read from the copy documents on the server. Only the review build reads them:
// the public build returns nothing, so none of this text reaches a public page. The strings come through
// lookup(), not t() or group(), so the copy-key marking never lands in the widget's own text.
import { lookup } from '@/lib/content';

type Node = ReturnType<typeof lookup>;

function flatten(node: Node, prefix: string, out: Record<string, string>) {
  if (typeof node === 'string') { out[prefix] = node; return; }
  if (node && typeof node === 'object' && !Array.isArray(node)) {
    for (const [k, v] of Object.entries(node)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  }
}

export function reviewCopy(): Record<string, string> | undefined {
  if (process.env.WEB_REVIEW !== '1') return undefined;
  const out: Record<string, string> = {};
  for (const group of ['panel', 'messages', 'elements', 'editor']) flatten(lookup(`pages.review-mode.${group}`), group, out);
  const missing = lookup('global.labels.not_found');
  if (typeof missing !== 'string') throw new Error('content key global.labels.not_found is missing');
  out.not_found = missing;
  if (!out['panel.send']) throw new Error('content group pages.review-mode is missing');
  return out;
}
