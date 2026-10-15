// What the review widget learns from the rendered page: a selector for a picked element, its box and
// visible text, the design system components around it, and the copy entry that drew its words.
import { OPEN, parse, strip } from './markers.mjs';

// The widget's own layer, its modal over a page modal, and the step marker a control plane screen draws: none is ever
// picked or scanned.
export const LAYER = '.gfw-root, .gfw-step, .gfw-modal';

// No feedback is collected at phone width (owner decision on issue #72): below this width the widget shows no
// Feedback entry and no panel, so a ticket only ever records a tablet or desktop device. review.css hides the
// layer at the same width.
export const PHONE_QUERY = '(max-width: 40rem)';
export const deviceOf = (): 'tablet' | 'desktop' => (innerWidth < 1024 ? 'tablet' : 'desktop');
const STABLE_ATTRS = ['data-nav', 'data-state', 'data-setting', 'data-gfw-key'];

export type Rect = { x: number; y: number; width: number; height: number };
export type Spot = {
  id: number;
  n: number;
  selector: string;
  tag: string;
  text: string;
  rect: Rect;
  point: { x: number; y: number };
  offset: { dx: number; dy: number };
  components: string[];
  key: string | null;
};

const cssEscape = (s: string) => (typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(s) : s.replace(/[^\w-]/g, '\\$&'));
export const inLayer = (node: Node | null) => Boolean(node && node instanceof Element && node.closest(LAYER));

function stableOf(el: Element): string | null {
  if (el.id && document.querySelectorAll(`#${cssEscape(el.id)}`).length === 1) return `#${cssEscape(el.id)}`;
  for (const a of STABLE_ATTRS) {
    if (!el.hasAttribute(a) || a === 'data-gfw-key') continue;
    const sel = `${el.tagName.toLowerCase()}[${a}="${String(el.getAttribute(a)).replace(/"/g, '\\"')}"]`;
    if (document.querySelectorAll(sel).length === 1) return sel;
  }
  return null;
}

// An id or a data attribute when the element has one; otherwise a path of tags from the nearest stable ancestor.
export function selectorFor(el: Element): string {
  const own = stableOf(el);
  if (own) return own;
  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node !== document.body && node !== document.documentElement) {
    const stable = stableOf(node);
    if (stable) { parts.unshift(stable); break; }
    const parent: Element | null = node.parentElement;
    const same = parent ? [...parent.children].filter((c) => c.tagName === node!.tagName) : [];
    parts.unshift(`${node.tagName.toLowerCase()}${same.length > 1 ? `:nth-of-type(${same.indexOf(node) + 1})` : ''}`);
    node = parent;
  }
  if (!parts.length || !(parts[0].startsWith('#') || parts[0].includes('['))) parts.unshift('body');
  return parts.join(' > ');
}

export const textOf = (el: Element) => strip((el as HTMLElement).innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 240);

export function docRect(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), width: Math.round(r.width), height: Math.round(r.height) };
}

// The components behind an element: every shared component root carries data-component="<spec name>", so
// the names of the element and its ancestors, innermost first, are the design system components around it.
export function componentsFor(el: Element): string[] {
  const found: string[] = [];
  for (let node: Element | null = el; node && node !== document.documentElement; node = node.parentElement) {
    if (inLayer(node)) return [];
    const name = node.getAttribute('data-component');
    if (name && !found.includes(name)) found.push(name);
  }
  return found;
}

let ids = 0;
export function spotFor(node: Element, point: { x: number; y: number } | null, n: number): Spot {
  const rect = docRect(node);
  const at = point ?? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  const keyed = node.closest<HTMLElement>('[data-gfw-key]');
  return {
    id: ++ids,
    n,
    selector: selectorFor(node),
    tag: node.tagName.toLowerCase(),
    text: textOf(node),
    rect,
    point: { x: Math.round(at.x), y: Math.round(at.y) },
    offset: { dx: Math.round(at.x - rect.x), dy: Math.round(at.y - rect.y) },
    components: componentsFor(node),
    key: keyed && keyed === node ? keyed.dataset.gfwKey ?? null : null,
  };
}

// ---------- the copy-key marking ----------

const ATTRS = ['aria-label', 'placeholder', 'title', 'alt', 'label', 'content'];

// Read the marking t() leaves in a review build and take it out of the page. A text node that is exactly one
// marked piece tags its element with the copy key (data-gfw-key); text built from several pieces is tagged
// data-gfw-multi so the editor can say why it cannot be edited here. Safe to run again: marked text is gone
// after the first pass. Returns the number of elements tagged.
export function scanMarks(root: ParentNode = document.body): number {
  let tagged = 0;
  const walker = document.createTreeWalker(root as Node, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if ((n as Text).data.includes(OPEN)) nodes.push(n as Text);
  for (const node of nodes) {
    const parent = node.parentElement;
    if (!parent || inLayer(parent)) continue;
    const { plain, segments, dangling } = parse(node.data);
    node.data = plain;
    if (!segments.length) { if (dangling) parent.dataset.gfwMulti = '1'; continue; }
    const whole = !dangling && segments.length === 1 && segments[0].text.trim() === plain.trim() && plain.trim();
    if (whole) { parent.dataset.gfwKey = segments[0].key; tagged += 1; } else { parent.dataset.gfwMulti = '1'; }
  }
  for (const el of document.querySelectorAll<HTMLElement>(ATTRS.map((a) => `[${a}]`).join(','))) {
    if (inLayer(el)) continue;
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (v && v.includes(OPEN)) el.setAttribute(a, strip(v));
    }
  }
  if (document.title.includes(OPEN)) document.title = strip(document.title);
  return tagged;
}

// ---------- copy found by its text ----------
// A build that carries no copy marks (t() does not mark its strings) still has editable copy: the visible text leaves
// are sent to the review server (POST /review/inline/resolve), which answers which of them are exactly one copy
// entry, and each answered element is tagged with that entry's key (data-gfw-key), as the static review picker did.
// Answers are kept for the session, so a text is asked about once.
type Resolved = { key: string } | null;
const SKIP_TAGS = /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|INPUT|SELECT|OPTION|TEMPLATE)$/;
const known = new Map<string, Resolved>();
const norm = (t: string | null) => String(t ?? '').replace(/\s+/g, ' ').trim();

function textLeaves(): [HTMLElement, string][] {
  const out: [HTMLElement, string][] = [];
  for (const n of document.body.querySelectorAll<HTMLElement>('*')) {
    if (n.children.length || SKIP_TAGS.test(n.tagName) || inLayer(n) || n.closest('svg')) continue;
    const t = norm(n.textContent);
    if (t.length >= 2 && t.length <= 240 && n.getClientRects().length) out.push([n, t]);
    if (out.length >= 1500) break;
  }
  return out;
}

export async function resolveCopy(screen: string, ask: (texts: string[]) => Promise<Record<string, Resolved>>): Promise<number> {
  const leaves = textLeaves();
  const need = [...new Set(leaves.map(([, t]) => t).filter((t) => !known.has(t)))];
  for (let i = 0; i < need.length; i += 300) {
    const chunk = need.slice(i, i + 300);
    const res = await ask(chunk);
    for (const t of chunk) known.set(t, res[t] ?? null);
  }
  let tagged = 0;
  for (const [n, t] of leaves) {
    const hit = known.get(t);
    if (hit && !n.dataset.gfwKey) { n.dataset.gfwKey = hit.key; tagged += 1; }
  }
  return tagged;
}
