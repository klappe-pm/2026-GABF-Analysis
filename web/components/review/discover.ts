// Which design system components a page shows. Every shared component in web/components marks its root
// element with data-component="<name>", the name of its spec folder; the review settings panel reads
// those marks and leaves out anything inside itself (data-review-panel).

export const COMPONENT_ATTR = 'data-component';
export const PANEL_ATTR = 'data-review-panel';

export type Instance = { name: string; count: number };

// Count the marks by component, keeping only names with a spec. The result follows `order` (the layout
// file's component order) and then the order of first appearance on the page.
export function countInstances(names: readonly (string | null | undefined)[], known: readonly string[], order: readonly string[] = []): Instance[] {
  const counts = new Map<string, number>();
  for (const name of names) if (name && known.includes(name)) counts.set(name, (counts.get(name) ?? 0) + 1);
  const rank = (name: string) => { const i = order.indexOf(name); return i === -1 ? order.length : i; };
  const seen = [...counts.keys()];
  return seen
    .sort((a, b) => rank(a) - rank(b) || seen.indexOf(a) - seen.indexOf(b))
    .map((name) => ({ name, count: counts.get(name) ?? 0 }));
}

// The marked elements under `root`, outside the panel.
export function markedElements(root: ParentNode): Element[] {
  return [...root.querySelectorAll(`[${COMPONENT_ATTR}]`)].filter((el) => !el.closest(`[${PANEL_ATTR}]`));
}

export function discoverInstances(root: ParentNode, known: readonly string[], order: readonly string[] = []): Instance[] {
  return countInstances(markedElements(root).map((el) => el.getAttribute(COMPONENT_ATTR)), known, order);
}
