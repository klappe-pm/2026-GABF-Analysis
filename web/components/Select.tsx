'use client';

import { useEffect, useRef } from 'react';
import { useSettings } from '@/design/runtime';

type Option = { value: string; label: string; disabled?: boolean };

type Props = { id: string; label: string; options: Option[]; defaultValue?: string; value?: string; onValueChange?: (value: string) => void; disabled?: boolean };

// A Material select, outlined or filled as its spec says. Keyboard and screen reader behavior are Material's.
// Pass value and onValueChange to control it; otherwise it starts at defaultValue (or the first option).
export function Select({ id, label, options, defaultValue, value: controlled, onValueChange, disabled }: Props) {
  const s = useSettings('select');
  const Tag = (s['Field style'] === 'filled' ? 'md-filled-select' : 'md-outlined-select') as 'md-outlined-select';
  const value = controlled ?? defaultValue ?? options[0]?.value ?? '';
  const ref = useRef<HTMLElement & { value: string }>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !onValueChange) return;
    const onChange = () => onValueChange(el.value);
    el.addEventListener('change', onChange);
    return () => el.removeEventListener('change', onChange);
  }, [onValueChange]);
  return (
    <Tag ref={ref} id={id} name={id} label={label} disabled={disabled || undefined} value={value} className="w-full">
      {options.map((o) => (
        <md-select-option key={o.value} value={o.value} disabled={o.disabled || undefined} selected={o.value === value || undefined}>
          <div slot="headline">{o.label}</div>
        </md-select-option>
      ))}
    </Tag>
  );
}
