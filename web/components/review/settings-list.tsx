'use client';

// The settings of one component (or of the whole site, target "settings"), each value with its in place
// editor. The style guide shows one under every component; the review settings panel shows one for each
// component on the page. In the public build the editor is the stand in that only shows the value.
import { EditableValue } from 'design-editor';
import { useDesign } from '@/design/runtime';
import { COMPONENTS, globalKind, showValue, type Value } from '@/design/schema';
import { color } from '@/design/helpers';

const HEX = /^#[0-9a-fA-F]{6}$/;

export function Swatch({ value }: { value: string }) {
  return <span aria-hidden="true" className="inline-block size-6 shrink-0 rounded-(--md-sys-shape-corner-extra-small) border border-outline-variant" style={{ background: value }} />;
}

// The keys a target lists, in schema order: a component's settings, or every site setting in use.
export function settingKeys(target: string, global: Record<string, Value>): string[] {
  return target === 'settings' ? Object.keys(global).filter((k) => globalKind(k)) : Object.keys(COMPONENTS[target] ?? {});
}

export function SettingsList({ name, heading }: { name: string; heading: string }) {
  const design = useDesign();
  const values = name === 'settings' ? design.global : design.components[name] ?? {};
  return (
    <div className="flex flex-col gap-2">
      <h4 className="type-title-small text-on-surface">{heading}</h4>
      <ul className="type-body-medium flex flex-col gap-1 text-on-surface-variant">
        {settingKeys(name, design.global).map((k) => {
          const v = values[k] ?? '';
          return (
            <li key={k}>
              <span className="text-on-surface">{k}</span>: <EditableValue target={name} k={k} value={v}>
                {HEX.test(String(v))
                  ? <span className="inline-flex items-center gap-2"><Swatch value={String(v)} />{String(v)}</span>
                  : <span style={{ color: color('on surface variant') }}>{showValue(v)}</span>}
              </EditableValue>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
