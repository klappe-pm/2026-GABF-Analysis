'use client';

// Reads the settings files when a page loads and applies them. The build bakes the same values into the
// page (web/app/layout.tsx), so a slow or failed request leaves the page styled as built. On success the
// Material custom properties are set on the root element, every component re-renders from its spec's
// values, and a "design-settings" event tells drawn things (charts) to redraw.
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { COMPONENTS, mergeComponent, mergeGlobal, type Settings, type Value } from './schema';
import { type DesignState, readState, SETTINGS_PATH, specPath } from './state';
import { schemeFor, type Scheme, themeVars } from './theme';

export const SETTINGS_EVENT = 'design-settings';

const Ctx = createContext<DesignState | null>(null);

// Register the Material web components in the browser only: they need customElements.
function loadMaterial() {
  return Promise.all([
    import('@material/web/button/filled-button.js'),
    import('@material/web/button/filled-tonal-button.js'),
    import('@material/web/button/elevated-button.js'),
    import('@material/web/button/outlined-button.js'),
    import('@material/web/button/text-button.js'),
    import('@material/web/checkbox/checkbox.js'),
    import('@material/web/chips/chip-set.js'),
    import('@material/web/chips/assist-chip.js'),
    import('@material/web/chips/input-chip.js'),
    import('@material/web/dialog/dialog.js'),
    import('@material/web/divider/divider.js'),
    import('@material/web/elevation/elevation.js'),
    import('@material/web/focus/md-focus-ring.js'),
    import('@material/web/progress/linear-progress.js'),
    import('@material/web/progress/circular-progress.js'),
    import('@material/web/select/outlined-select.js'),
    import('@material/web/select/filled-select.js'),
    import('@material/web/select/select-option.js'),
    import('@material/web/textfield/outlined-text-field.js'),
    import('@material/web/textfield/filled-text-field.js'),
    import('@material/web/tabs/tabs.js'),
    import('@material/web/tabs/primary-tab.js'),
    import('@material/web/labs/card/outlined-card.js'),
  ]);
}

async function fetchText(path: string): Promise<string | null> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/${SETTINGS_PATH}/${path}`, { cache: 'no-store' });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

export function DesignSettings({ initial, children }: { initial: DesignState; children: ReactNode }) {
  const [state, setState] = useState(initial);

  useEffect(() => {
    let live = true;
    const root = document.documentElement;
    Promise.all([
      loadMaterial().catch(() => null),
      (async () => {
        const names = Object.keys(COMPONENTS);
        const [settings, layout, ...specs] = await Promise.all([fetchText('settings.md'), fetchText('layout.md'), ...names.map((n) => fetchText(specPath(n)))]);
        const next = readState({ settings, layout, specs: Object.fromEntries(names.map((n, i) => [n, specs[i]])) }, initial);
        if (!live) return;
        for (const [k, v] of Object.entries(themeVars(next.global))) root.style.setProperty(k, v);
        setState(next);
        root.dataset.settings = settings === null ? 'built' : 'loaded';
      })(),
    ]).then(() => {
      if (!live) return;
      // Let React commit the new values before anything measures them.
      requestAnimationFrame(() => {
        root.dataset.settingsApplied = 'true';
        window.dispatchEvent(new Event(SETTINGS_EVENT));
      });
    });
    return () => { live = false; };
  }, [initial]);

  // Show one value without saving it (review mode editors): the page re-themes at once.
  const preview = useCallback((target: string, key: string, value: Value) => {
    setState((prev) => {
      const next = target === 'settings'
        ? { ...prev, global: mergeGlobal(prev.global, { [key]: value }) }
        : { ...prev, components: { ...prev.components, [target]: mergeComponent(target, prev.components[target] ?? {}, { [key]: value }) } };
      if (target === 'settings') for (const [k, v] of Object.entries(themeVars(next.global))) document.documentElement.style.setProperty(k, v);
      requestAnimationFrame(() => window.dispatchEvent(new Event(SETTINGS_EVENT)));
      return next;
    });
  }, []);

  return <Ctx.Provider value={state}><PreviewCtx.Provider value={preview}>{children}</PreviewCtx.Provider></Ctx.Provider>;
}

const PreviewCtx = createContext<(target: string, key: string, value: Value) => void>(() => {});
export const usePreview = () => useContext(PreviewCtx);

export function useDesign(): DesignState {
  const s = useContext(Ctx);
  if (!s) throw new Error('useDesign needs the DesignSettings provider');
  return s;
}

// One component's settings, read from its spec. Every instance reads the same values.
export function useSettings(name: string): Settings {
  return useDesign().components[name] ?? {};
}

export function useScheme(): Scheme {
  const { global } = useDesign();
  return useMemo(() => schemeFor(global), [global]);
}

// True while the user asks for reduced motion.
export function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const q = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduce(q.matches);
    on();
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  return reduce;
}
