// The settings the owner can change, and the values each one accepts. Shared by the web app (build and
// runtime) and by the repository scripts (scripts/design-system/), which bundle this file with esbuild.
// Settings live in plain YAML frontmatter: .design/design-system/settings.md for the whole site,
// .design/design-system/layout.md for section and navigation order, and each component's spec.md.

export type Value = string | number | string[];
export type Settings = Record<string, Value>;

export type Kind =
  | { type: 'enum'; values: readonly string[] }
  | { type: 'number'; values: readonly number[] }
  | { type: 'hex' }
  | { type: 'list'; values: readonly string[]; min: number }
  | { type: 'width' };

// Material color roles by their plain names. Each maps to --md-sys-color-<name with hyphens>.
export const COLOR_ROLES = [
  'primary', 'on primary', 'primary container', 'on primary container',
  'secondary', 'on secondary', 'secondary container', 'on secondary container',
  'tertiary', 'on tertiary', 'tertiary container', 'on tertiary container',
  'error', 'on error', 'error container', 'on error container',
  'background', 'on background', 'surface', 'surface dim', 'surface bright',
  'surface container lowest', 'surface container low', 'surface container', 'surface container high', 'surface container highest',
  'on surface', 'on surface variant', 'outline', 'outline variant',
  'inverse surface', 'inverse on surface', 'inverse primary', 'scrim', 'shadow',
] as const;
export type ColorRole = (typeof COLOR_ROLES)[number];

export const SHAPES = ['none', 'extra small', 'small', 'medium', 'large', 'extra large', 'full'] as const;

export const TYPE_ROLES = [
  'display large', 'display medium', 'display small',
  'headline large', 'headline medium', 'headline small',
  'title large', 'title medium', 'title small',
  'body large', 'body medium', 'body small',
  'label large', 'label medium', 'label small',
] as const;
export type TypeRole = (typeof TYPE_ROLES)[number];

// The two faces the site loads (web/app/layout.tsx). Figures are always set in Public Sans.
export const FONTS = ['Public Sans', 'Archivo Narrow'] as const;

const cssName = (plain: string) => plain.trim().toLowerCase().replace(/\s+/g, '-');
export const colorVar = (role: string) => `var(--md-sys-color-${cssName(role)})`;
export const shapeVar = (shape: string) => `var(--md-sys-shape-corner-${cssName(shape)})`;
export const typeClass = (role: string) => `type-${cssName(role)}`;
export const elevationLevels = [0, 1, 2, 3, 4, 5] as const;

const enumOf = (values: readonly string[]): Kind => ({ type: 'enum', values });
const numberOf = (values: readonly number[]): Kind => ({ type: 'number', values });
const colorRole = enumOf(COLOR_ROLES.filter((r) => r !== 'scrim' && r !== 'shadow'));
const shape = enumOf(SHAPES);
const typeRole = enumOf(TYPE_ROLES);
const yesNo = enumOf(['yes', 'no']);
const cardStyle = enumOf(['outlined', 'filled', 'elevated']);
const fieldStyle = enumOf(['outlined', 'filled']);
const buttonStyle = enumOf(['filled', 'tonal', 'elevated', 'outlined', 'text']);

// Global settings: .design/design-system/settings.md. Keys are written exactly as here.
export const GLOBAL: Record<string, Kind> = {
  'Seed color': { type: 'hex' },
  'Primary color': { type: 'hex' },
  'Color style': enumOf(['tonal spot', 'neutral', 'vibrant', 'expressive', 'fidelity', 'content']),
  'Surface tint': enumOf(['none', 'seed']),
  'Page background': enumOf(['white', 'scheme']),
  Contrast: enumOf(['standard', 'medium', 'high']),
  'Heading font': enumOf(['Public Sans']),
  'Body font': enumOf(['Public Sans']),
  'Label font': enumOf(FONTS),
  'Corner shape': enumOf(['square', 'small', 'medium', 'large']),
  'Page width': { type: 'width' },
  'Compact margin': numberOf([8, 12, 16, 20, 24]),
  'Wide margin': numberOf([16, 20, 24, 32, 40]),
  'Navigation on wide screens': enumOf(['drawer', 'rail']),
  'Gold medal color': { type: 'hex' },
  'Silver medal color': { type: 'hex' },
  'Bronze medal color': { type: 'hex' },
};

// Optional type size overrides in settings.md, in pixels: for example "Body large size: 17".
export const TYPE_SIZE_KEY = /^(Display|Headline|Title|Body|Label) (large|medium|small) size$/;
export const typeSizeKind: Kind = numberOf(Array.from({ length: 89 }, (_, i) => i + 8));
export const typeSizeKey = (role: TypeRole) => `${role[0].toUpperCase()}${role.slice(1)} size`;

// Page order: .design/design-system/layout.md.
export const SECTIONS = ['settings', 'color', 'type', 'shape', 'elevation', 'components'] as const;
export const SITE_NAVIGATION = ['results', 'breweries', 'beers', 'analysis'] as const;

// Per component settings: .design/design-system/components/<name>/spec.md frontmatter.
export const COMPONENTS: Record<string, Record<string, Kind>> = {
  'filter-chips': { 'Chip style': enumOf(['outlined', 'elevated']), Shape: shape },
  breadcrumb: { Separator: enumOf(['/', '›', '·']), 'Text style': typeRole },
  button: { 'Main action': buttonStyle, 'Other action': buttonStyle, 'Quiet action': buttonStyle, Shape: shape, Density: numberOf([0, -1, -2, -3]) },
  'chart-card': { 'Card style': cardStyle, 'Line width': numberOf([1, 1.5, 2, 3]), 'Point size': numberOf([4, 6, 8, 10, 12]), 'Series colors': { type: 'list', values: colorRole.type === 'enum' ? colorRole.values : [], min: 5 } },
  checkbox: { 'Text style': typeRole },
  'estimate-tooltip': { Shape: shape, Surface: colorRole, Elevation: numberOf(elevationLevels) },
  'filters-dialog': { Shape: shape, 'Width on wide screens': numberOf([480, 560, 640, 720]) },
  'stat-card': { 'Card style': cardStyle, 'Figure style': typeRole, 'Label style': typeRole },
  'page-header': { 'Container color': colorRole, 'Title style': typeRole, 'Current page color': colorRole },
  'state-card': { 'Card style': cardStyle, 'Loading indicator': enumOf(['linear', 'circular']) },
  icon: { Size: numberOf([16, 20, 24, 32]), 'Stroke width': numberOf([1, 1.5, 2]) },
  'medal-mark': { Size: numberOf([16, 20, 24, 28, 32]), 'Show initial': yesNo, 'Ring color': colorRole },
  'medal-record': { 'Tally limit': numberOf([6, 8, 10, 12, 15, 20]) },
  'range-scale': { 'Band color': colorRole, 'Value color': colorRole, 'Outside color': colorRole },
  'callout': { 'Card style': cardStyle, 'Accent color': colorRole },
  'data-table': {
    'Header color': colorRole,
    'Header weight': enumOf(['bold', 'medium', 'regular']),
    'Row height': numberOf([36, 40, 44, 48, 52, 56]),
    'Row dividers': yesNo,
    'Cell wrapping': enumOf(['never', 'allowed']),
    'Cell alignment': enumOf(['left', 'numbers right']),
  },
  'search-field': { 'Field style': fieldStyle },
  'section-header': { 'Title style': typeRole, 'Title color': colorRole, Divider: yesNo },
  select: { 'Field style': fieldStyle },
  'status-chip': { 'Container color': colorRole, Shape: shape },
  'text-link': { Color: colorRole, Underline: enumOf(['always', 'on hover']) },
  // Drawn by the current public site (scripts/build-site.mjs, site/), not yet by web/: no settings until
  // each moves to Material.
  'navigation-rail': { 'Show labels': yesNo, 'Indicator color': colorRole, 'Container color': colorRole },
  'navigation-drawer': { Width: numberOf([280, 320, 360]), 'Indicator color': colorRole, 'Container color': colorRole },
  footer: {},
  tabs: {},
  chips: {},
  'spec-card': {},
  'side-sheet': {},
  'explorer-app': {},
  'beer-profile-card': {
    Variant: cardStyle,
    'Name style': typeRole,
    'Show hop chips': yesNo,
    'Hop chip style': enumOf(['outlined', 'elevated']),
    'Tasting note length': numberOf([80, 120, 160, 200, 240, 320]),
  },
  'hop-profile-card': {
    Variant: cardStyle,
    'Name style': typeRole,
    'Show aroma': yesNo,
    'Show grower farms': yesNo,
    'Farm limit': numberOf([3, 5, 8, 10, 12]),
  },
};

// Identity keys every spec carries besides its settings.
export const SPEC_KEYS = ['name', 'title', 'status', 'code'] as const;
export const STATUSES = ['draft', 'review', 'approved'] as const;

const HEX = /^#[0-9a-fA-F]{6}$/;

// Null when the value is valid for its kind, otherwise the reason.
export function valueProblem(kind: Kind, value: unknown): string | null {
  switch (kind.type) {
    case 'hex':
      return typeof value === 'string' && HEX.test(value) ? null : 'must be a quoted six digit hex color such as "#4A8F3C"';
    case 'enum':
      return typeof value === 'string' && kind.values.includes(value) ? null : `must be one of: ${kind.values.join(', ')}`;
    case 'number':
      return typeof value === 'number' && kind.values.includes(value) ? null : `must be one of: ${kind.values.join(', ')}`;
    case 'width':
      return value === 'full' || (typeof value === 'string' && /^\d+(\.\d+)?rem$/.test(value) && Number.parseFloat(value) >= 30) ? null : 'must be full, or a width of 30rem or more such as 90rem';
    case 'list': {
      const items = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',').map((s) => s.trim()) : null;
      if (!items || items.length < kind.min) return `must list at least ${kind.min} of: ${kind.values.join(', ')}`;
      const bad = items.filter((v) => typeof v !== 'string' || !kind.values.includes(v));
      return bad.length ? `unknown value ${bad.join(', ')}; use: ${kind.values.join(', ')}` : null;
    }
  }
}

const listValue = (v: Value) => (Array.isArray(v) ? v : String(v).split(',').map((s) => s.trim()));

export function globalKind(key: string): Kind | undefined {
  return GLOBAL[key] ?? (TYPE_SIZE_KEY.test(key) ? typeSizeKind : undefined);
}

// Keep each valid value from `next`; fall back to `base` for anything missing or invalid.
export function mergeGlobal(base: Settings, next: Record<string, unknown>): Settings {
  const out: Settings = { ...base };
  for (const [k, v] of Object.entries(next)) {
    const kind = globalKind(k);
    if (kind && !valueProblem(kind, v)) out[k] = v as Value;
  }
  return out;
}

export function mergeComponent(name: string, base: Settings, next: Record<string, unknown>): Settings {
  const schema = COMPONENTS[name] ?? {};
  const out: Settings = { ...base };
  for (const [k, kind] of Object.entries(schema)) {
    if (Object.hasOwn(next, k) && !valueProblem(kind, next[k])) out[k] = kind.type === 'list' ? listValue(next[k] as Value) : (next[k] as Value);
  }
  return out;
}

// Pick the component settings out of a spec's frontmatter.
export function componentSettings(name: string, data: Record<string, unknown>): Settings {
  return mergeComponent(name, {}, data);
}

export type Layout = { Sections: string[]; 'Site navigation': string[]; Components: string[] };
export const LAYOUT_KEYS = ['Sections', 'Site navigation', 'Components'] as const;

export function layoutIds(key: (typeof LAYOUT_KEYS)[number]): readonly string[] {
  if (key === 'Sections') return SECTIONS;
  if (key === 'Site navigation') return SITE_NAVIGATION;
  return Object.keys(COMPONENTS);
}

// Known ids in the listed order, then any the list left out, in their default order.
export function orderList(key: (typeof LAYOUT_KEYS)[number], listed: unknown, fallback?: string[]): string[] {
  const known = layoutIds(key);
  const base = fallback ?? [...known];
  if (!Array.isArray(listed)) return base;
  const picked = [...new Set(listed.filter((x): x is string => typeof x === 'string' && known.includes(x)))];
  return [...picked, ...base.filter((x) => !picked.includes(x))];
}

export function mergeLayout(base: Layout, next: Record<string, unknown>): Layout {
  return {
    Sections: orderList('Sections', next.Sections, base.Sections),
    'Site navigation': orderList('Site navigation', next['Site navigation'], base['Site navigation']),
    Components: orderList('Components', next.Components, base.Components),
  };
}

// The display form of a value, as written in a spec's options list.
export const showValue = (v: Value) => (Array.isArray(v) ? v.join(', ') : String(v));

// The body every spec carries: its image, then its options (## <name>-options), in the frontmatter's order and values.
export function specBody(name: string, title: string, settings: Settings): string {
  const lines = [`![${title}](${name}.png)`, '', `## ${name}-options`, ''];
  for (const k of Object.keys(COMPONENTS[name] ?? {})) if (Object.hasOwn(settings, k)) lines.push(`- ${k}: ${showValue(settings[k])}`);
  if (!Object.keys(COMPONENTS[name] ?? {}).length) lines.push('- Nothing yet: the current public site draws this component, and it gains settings when it moves to Material.');
  return `\n${lines.join('\n')}\n`;
}
