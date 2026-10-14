'use client';

// The parts of the style guide that show the settings themselves. They read the values the page applied
// (the built values first, then the loaded files), so every value shown is the value in use.
import { type ReactNode, useEffect, useRef } from 'react';
import { RuledTable } from '@/components/RuledTable';
import { useDesign, useScheme } from '@/design/runtime';
import { COMPONENTS, type ColorRole, elevationLevels, globalKind, SHAPES, showValue } from '@/design/schema';
import { contrastReport, corners, typeScale } from '@/design/theme';
import { color, labelFace, typeOf } from '@/design/helpers';

const key = (plain: string) => plain.replace(/ /g, '_');

// Children in the order a layout list gives.
export function Ordered({ list, items }: { list: 'Sections' | 'Components'; items: { id: string; node: ReactNode }[] }) {
  const order = useDesign().layout[list];
  const sorted = [...items].sort((a, b) => (order.indexOf(a.id) + 1 || 999) - (order.indexOf(b.id) + 1 || 999));
  return <>{sorted.map((i) => <div key={i.id} className="contents">{i.node}</div>)}</>;
}

// The sections as Material primary tabs, in the layout file's order. Choosing a tab scrolls to its section;
// scrolling the page moves the active tab.
export function SectionTabs({ label, items }: { label: string; items: { id: string; text: string }[] }) {
  const order = useDesign().layout.Sections;
  const sorted = [...items].sort((a, b) => (order.indexOf(a.id) + 1 || 999) - (order.indexOf(b.id) + 1 || 999));
  const ids = sorted.map((s) => s.id).join('|');
  const ref = useRef<HTMLElement & { activeTabIndex: number }>(null);
  useEffect(() => {
    const tabs = ref.current;
    if (!tabs) return;
    const list = ids.split('|');
    let jumping = false;
    const onChange = () => {
      const target = document.getElementById(list[tabs.activeTabIndex]);
      if (!target) return;
      jumping = true;
      target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      window.setTimeout(() => { jumping = false; }, 800);
    };
    const seen = new Map<string, boolean>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) seen.set(e.target.id, e.isIntersecting);
      if (jumping) return;
      const first = list.findIndex((id) => seen.get(id));
      if (first >= 0 && tabs.activeTabIndex !== first) tabs.activeTabIndex = first;
    }, { rootMargin: '-120px 0px -60% 0px' });
    for (const id of list) { const el = document.getElementById(id); if (el) io.observe(el); }
    tabs.addEventListener('change', onChange);
    return () => { tabs.removeEventListener('change', onChange); io.disconnect(); };
  }, [ids]);
  return (
    <div className="sticky top-0 z-10 bg-surface-container-lowest">
      <md-tabs ref={ref} aria-label={label} className="mx-auto block max-w-page" style={{ ['--md-primary-tab-container-color' as string]: 'var(--md-sys-color-surface-container-lowest)' }}>
        {sorted.map((s, i) => <md-primary-tab key={s.id} id={`tab-${s.id}`} active={i === 0 || undefined}>{s.text}</md-primary-tab>)}
      </md-tabs>
    </div>
  );
}

function Swatch({ value }: { value: string }) {
  return <span aria-hidden="true" className="inline-block size-6 shrink-0 rounded-(--md-sys-shape-corner-extra-small) border border-outline-variant" style={{ background: value }} />;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

export function SettingsTable({ caption, cols }: { caption: string; cols: { setting: string; value: string } }) {
  const { global } = useDesign();
  return (
    <RuledTable
      caption={caption}
      scroll={false}
      columns={[{ key: 'setting', label: cols.setting }, { key: 'value', label: cols.value }]}
      rows={Object.entries(global).filter(([k]) => globalKind(k)).map(([k, v]) => ({
        key: k,
        cells: {
          setting: k,
          value: HEX.test(String(v)) ? <span className="inline-flex items-center gap-2"><Swatch value={String(v)} />{String(v)}</span> : showValue(v),
        },
      }))}
    />
  );
}

export const SCHEME_GROUPS: Record<string, ColorRole[]> = {
  primary: ['primary', 'on primary', 'primary container', 'on primary container'],
  secondary: ['secondary', 'on secondary', 'secondary container', 'on secondary container'],
  tertiary: ['tertiary', 'on tertiary', 'tertiary container', 'on tertiary container'],
  error: ['error', 'on error', 'error container', 'on error container'],
  surfaces: ['surface', 'surface dim', 'surface bright', 'surface container lowest', 'surface container low', 'surface container', 'surface container high', 'surface container highest', 'on surface', 'on surface variant'],
  outlines: ['outline', 'outline variant', 'inverse surface', 'inverse on surface', 'inverse primary'],
};

export function SchemeTable({ group, caption, roleNames, cols }: { group: string; caption: string; roleNames: Record<string, string>; cols: { role: string; value: string } }) {
  const scheme = useScheme();
  return (
    <RuledTable
      caption={caption}
      scroll={false}
      columns={[{ key: 'role', label: cols.role }, { key: 'value', label: cols.value }]}
      rows={SCHEME_GROUPS[group].map((role) => ({
        key: role,
        cells: { role: roleNames[key(role)], value: <span className="inline-flex items-center gap-2"><Swatch value={scheme[role]} />{scheme[role]}</span> },
      }))}
    />
  );
}

export function MedalTable({ caption, names, cols }: { caption: string; names: Record<string, string>; cols: { role: string; value: string } }) {
  const { global } = useDesign();
  const rows = (['gold', 'silver', 'bronze'] as const).map((m) => {
    const v = String(global[`${m[0].toUpperCase()}${m.slice(1)} medal color`]);
    return { key: m, cells: { role: names[m], value: <span className="inline-flex items-center gap-2"><Swatch value={v} />{v}</span> } };
  });
  return <RuledTable caption={caption} scroll={false} columns={[{ key: 'role', label: cols.role }, { key: 'value', label: cols.value }]} rows={rows} />;
}

export function ContrastTable({ caption, roleNames, cols }: { caption: string; roleNames: Record<string, string>; cols: Record<'role' | 'on' | 'ratio' | 'needs' | 'result' | 'pass' | 'fail', string> }) {
  const scheme = useScheme();
  const series = (useDesign().components['chart-frame']?.['Series colors'] ?? []) as ColorRole[];
  return (
    <RuledTable
      caption={caption}
      columns={[
        { key: 'role', label: cols.role },
        { key: 'on', label: cols.on },
        { key: 'ratio', label: cols.ratio, numeric: true },
        { key: 'needs', label: cols.needs, numeric: true },
        { key: 'result', label: cols.result },
      ]}
      rows={contrastReport(scheme, series.map((r) => [r, 'surface'])).map((r) => ({
        key: `${r.fg}|${r.bg}`,
        cells: { role: roleNames[key(r.fg)], on: roleNames[key(r.bg)], ratio: `${r.ratio.toFixed(2)}:1`, needs: `${r.min}:1`, result: r.pass ? cols.pass : cols.fail },
      }))}
    />
  );
}

export function TypeTable({ caption, roleNames, sample, cols }: { caption: string; roleNames: Record<string, string>; sample: string; cols: Record<'use' | 'sample' | 'family' | 'size' | 'line_height' | 'weight', string> }) {
  const { global } = useDesign();
  return (
    <RuledTable
      caption={caption}
      columns={[
        { key: 'use', label: cols.use },
        { key: 'sample', label: cols.sample },
        { key: 'family', label: cols.family },
        { key: 'size', label: cols.size, numeric: true },
        { key: 'line', label: cols.line_height, numeric: true },
        { key: 'weight', label: cols.weight, numeric: true },
      ]}
      rows={typeScale(global).map((r) => ({
        key: r.role,
        cells: {
          use: roleNames[key(r.role)],
          sample: <span className={`${typeOf(r.role)} block max-w-xs truncate`} style={labelFace(sample)}>{sample}</span>,
          family: r.role.startsWith('label') && /\d/.test(sample) ? 'Public Sans' : r.family,
          size: `${r.size}px`,
          line: `${r.line}px`,
          weight: r.weight,
        },
      }))}
    />
  );
}

export function ShapeTable({ caption, names, cols }: { caption: string; names: Record<string, string>; cols: { name: string; value: string; sample: string } }) {
  const { global } = useDesign();
  const c = corners(global);
  return (
    <RuledTable
      caption={caption}
      scroll={false}
      columns={[{ key: 'name', label: cols.name }, { key: 'value', label: cols.value, numeric: true }, { key: 'sample', label: cols.sample }]}
      rows={SHAPES.map((s) => ({
        key: s,
        cells: {
          name: names[key(s)],
          value: c[s.replace(/ /g, '-')] === '9999px' ? names.full : c[s.replace(/ /g, '-')],
          sample: <span className="block h-10 w-20 bg-primary-container" style={{ borderRadius: `var(--md-sys-shape-corner-${s.replace(/ /g, '-')})` }} />,
        },
      }))}
    />
  );
}

export function ElevationRow({ levelLabel }: { levelLabel: string }) {
  return (
    <ul className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
      {elevationLevels.map((n) => (
        <li key={n} className="relative flex h-24 items-end rounded-(--md-sys-shape-corner-medium) bg-surface-container-low p-3" style={{ ['--md-elevation-level' as string]: n }}>
          <md-elevation />
          <span className="type-body-medium text-on-surface">{levelLabel.replace('{{number}}', String(n))}</span>
        </li>
      ))}
    </ul>
  );
}

// Beside each component: its status and what can change, read from its spec.
export function SpecimenMeta({ name, statusLabel, statuses, specLink, href }: { name: string; statusLabel: string; statuses: Record<string, string>; specLink: string; href: string }) {
  const { meta } = useDesign();
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="type-label-large inline-flex min-h-8 items-center rounded-(--md-sys-shape-corner-small) bg-secondary-container px-3 text-on-secondary-container">{statusLabel}: {statuses[meta[name]?.status ?? 'draft']}</span>
      <md-text-button href={href}>{specLink}</md-text-button>
    </span>
  );
}

export function SettingsList({ name, heading }: { name: string; heading: string }) {
  const values = useDesign().components[name] ?? {};
  return (
    <div className="flex flex-col gap-2">
      <h4 className="type-title-small text-on-surface">{heading}</h4>
      <ul className="type-body-medium flex flex-col gap-1 text-on-surface-variant">
        {Object.keys(COMPONENTS[name] ?? {}).map((k) => (
          <li key={k}><span className="text-on-surface">{k}</span>: <span style={{ color: color('on surface variant') }}>{showValue(values[k] ?? '')}</span></li>
        ))}
      </ul>
    </div>
  );
}
