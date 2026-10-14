'use client';

// Review mode only (DESIGN_REVIEW=1, npm run design-system:review): the settings of every design system
// component on the page in view, and the site settings, each with the style guide's in place editor
// (web/design/editor.tsx). A change re-themes the page at once; Save sends it to the local review server,
// which checks it (allowed values, approved fonts, WCAG AA contrast, the token shaped scan), writes that
// one key, and files an ACCEPTED ticket under docs/feedback/<page>/. The public build swaps this file for
// settings-panel-off.tsx (see next.config.ts), so none of it ships.
import { useCallback, useEffect, useState } from 'react';
import { ReviewPage } from 'design-editor';
import { useDesign } from '@/design/runtime';
import { COMPONENTS } from '@/design/schema';
import { discoverInstances, markedElements, type Instance, PANEL_ATTR } from './discover';
import { SettingsList } from './settings-list';

export type ReviewSettingsPanelProps = {
  // The page id tickets are filed under (docs/feedback/<page>/). Without it the review server works it
  // out from the route.
  page?: string;
  // Render the panel's content in place, for a host that draws its own container (the feedback widget).
  // Otherwise the panel is a button that opens a sheet at the side of the window.
  inline?: boolean;
  defaultOpen?: boolean;
};

const KNOWN = Object.keys(COMPONENTS);

// The components on the page, kept current as the page changes (a view that loads, a tab that opens).
function useInstances(): Instance[] {
  const order = useDesign().layout.Components;
  const [found, setFound] = useState<Instance[]>([]);
  const orderKey = order.join('|');
  useEffect(() => {
    const list = orderKey.split('|');
    let frame = 0;
    const scan = () => { frame = 0; setFound(discoverInstances(document, KNOWN, list)); };
    scan();
    const mo = new MutationObserver(() => { if (!frame) frame = requestAnimationFrame(scan); });
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-component'] });
    return () => { mo.disconnect(); if (frame) cancelAnimationFrame(frame); };
  }, [orderKey]);
  return found;
}

// Scroll to the first instance and outline it for a moment.
function showFirst(name: string) {
  const el = markedElements(document).find((e) => e.getAttribute('data-component') === name) as HTMLElement | undefined;
  if (!el) return;
  el.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  const { outline, outlineOffset } = el.style;
  el.style.outline = '3px solid var(--md-sys-color-primary)';
  el.style.outlineOffset = '2px';
  window.setTimeout(() => { el.style.outline = outline; el.style.outlineOffset = outlineOffset; }, 1600);
}

function PanelContent({ page }: { page?: string }) {
  const { meta } = useDesign();
  const instances = useInstances();
  return (
    <ReviewPage page={page}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h2 className="type-title-large text-on-surface">Page settings</h2>
          <p className="type-body-medium text-on-surface-variant">
            A change shows on the page at once. Save writes the setting to its file and files an accepted ticket in {page ? `docs/feedback/${page}/` : "this page's folder in docs/feedback/"}.
          </p>
        </div>
        <section className="flex flex-col gap-3" aria-label="Site settings">
          <SettingsList name="settings" heading="Site settings" />
        </section>
        <section className="flex flex-col gap-3" aria-label="Components on this page" data-review-instances={instances.map((i) => `${i.name}:${i.count}`).join(' ')}>
          <h3 className="type-title-medium text-on-surface">Components on this page</h3>
          {instances.length ? null : <p className="type-body-medium text-on-surface-variant">No design system components were found on this page.</p>}
          {instances.map(({ name, count }) => {
            const title = meta[name]?.title ?? name;
            const settings = Object.keys(COMPONENTS[name] ?? {}).length;
            return (
              <details key={name} className="rounded-(--md-sys-shape-corner-medium) border border-outline-variant bg-surface px-3 py-2" data-review-component={name}>
                <summary className="type-title-small cursor-pointer py-1 text-on-surface">
                  {title} <span className="type-body-small font-plain text-on-surface-variant">({count} on this page)</span>
                </summary>
                <div className="flex flex-col gap-3 pt-2 pb-1">
                  <p className="type-body-small text-on-surface-variant">Spec: .design/design-system/components/{name}/spec.md</p>
                  {settings ? <SettingsList name={name} heading="Settings" /> : <p className="type-body-medium text-on-surface-variant">No settings yet: this component gains settings when it moves to Material.</p>}
                  <span><md-text-button onClick={() => showFirst(name)}>Show on the page</md-text-button></span>
                </div>
              </details>
            );
          })}
        </section>
      </div>
    </ReviewPage>
  );
}

export function ReviewSettingsPanel({ page, inline = false, defaultOpen = false }: ReviewSettingsPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const close = useCallback(() => setOpen(false), []);
  useEffect(() => {
    if (!open || inline) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, inline, close]);

  if (inline) return <div {...{ [PANEL_ATTR]: 'inline' }}><PanelContent page={page} /></div>;
  return (
    <div {...{ [PANEL_ATTR]: open ? 'open' : 'closed' }}>
      {open ? (
        <aside
          id="review-settings-panel"
          aria-label="Page settings"
          className="fixed inset-y-0 right-0 z-50 flex w-[min(28rem,100%)] flex-col gap-4 overflow-y-auto bg-surface-container-low p-4"
          style={{ ['--md-elevation-level' as string]: 3 }}
        >
          <md-elevation />
          <span className="flex justify-end"><md-text-button onClick={close}>Close</md-text-button></span>
          <PanelContent page={page} />
        </aside>
      ) : null}
      <span className="fixed bottom-4 left-4 z-50">
        <md-filled-tonal-button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="review-settings-panel">
          {open ? 'Close page settings' : 'Page settings'}
        </md-filled-tonal-button>
      </span>
    </div>
  );
}
