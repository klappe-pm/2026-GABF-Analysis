'use client';

import { useSettings } from '@/design/runtime';

type Option = { value: string; label: string; disabled?: boolean };

type Props = { id: string; label: string; options: Option[]; defaultValue?: string; disabled?: boolean };

// A Material select, outlined or filled as its spec says. Keyboard and screen reader behavior are Material's.
export function Select({ id, label, options, defaultValue, disabled }: Props) {
  const s = useSettings('select');
  const Tag = (s['Field style'] === 'filled' ? 'md-filled-select' : 'md-outlined-select') as 'md-outlined-select';
  const value = defaultValue ?? options[0]?.value ?? '';
  return (
    <Tag id={id} name={id} label={label} disabled={disabled || undefined} value={value} className="w-full">
      {options.map((o) => (
        <md-select-option key={o.value} value={o.value} disabled={o.disabled || undefined} selected={o.value === value || undefined}>
          <div slot="headline">{o.label}</div>
        </md-select-option>
      ))}
    </Tag>
  );
}
