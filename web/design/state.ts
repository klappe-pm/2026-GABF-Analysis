// The design settings as one value: what the build bakes in and what the browser replaces on load.
import { splitFrontmatter } from './frontmatter';
import { COMPONENTS, type Layout, mergeComponent, mergeGlobal, mergeLayout, type Settings, STATUSES } from './schema';

export type SpecMeta = { title: string; status: string };
export type DesignState = {
  global: Settings;
  layout: Layout;
  components: Record<string, Settings>;
  meta: Record<string, SpecMeta>;
};

export const EMPTY_LAYOUT: Layout = { Sections: [], 'Site navigation': [], Components: [] };

export type Sources = { settings: string | null; layout: string | null; specs: Record<string, string | null> };

// Read the source texts into a state, keeping `base` wherever a file is missing or a value is invalid.
export function readState(src: Sources, base?: DesignState): DesignState {
  const global = src.settings !== null ? mergeGlobal(base?.global ?? {}, splitFrontmatter(src.settings).data) : base?.global ?? {};
  const layout = mergeLayout(base?.layout ?? mergeLayout(EMPTY_LAYOUT, {}), src.layout !== null ? splitFrontmatter(src.layout).data : {});
  const components: Record<string, Settings> = {};
  const meta: Record<string, SpecMeta> = {};
  for (const name of Object.keys(COMPONENTS)) {
    const text = src.specs[name];
    const data = text ? splitFrontmatter(text).data : {};
    components[name] = mergeComponent(name, base?.components[name] ?? {}, data);
    const prev = base?.meta[name] ?? { title: name, status: 'draft' };
    meta[name] = {
      title: typeof data.title === 'string' ? data.title : prev.title,
      status: typeof data.status === 'string' && (STATUSES as readonly string[]).includes(data.status) ? data.status : prev.status,
    };
  }
  return { global, layout, components, meta };
}

// Where the static export serves the settings files (copied there by scripts/design-system/build.mjs).
export const SETTINGS_PATH = 'design-settings';
export const specPath = (name: string) => `components/${name}/spec.md`;
