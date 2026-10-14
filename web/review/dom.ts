// What the review widget learns from the rendered page: a selector for a picked element, its box and
// visible text, the design system components around it, and the copy entry that drew its words.
import { COMPONENT_MAP } from './component-map.mjs';
import { OPEN, parse, strip } from './markers.mjs';

export const LAYER = '.gfw-root';
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

// The components behind an element: every map entry that matches it or an ancestor, innermost first.
export function componentsFor(el: Element): string[] {
  const found: string[] = [];
  for (let node: Element | null = el; node && node !== document.documentElement; node = node.parentElement) {
    if (inLayer(node)) return [];
    for (const e of COMPONENT_MAP) {
      let hit = false;
      try { hit = node.matches(e.selector); } catch { hit = false; }
      if (hit && !found.includes(e.component)) found.push(e.component);
    }
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
