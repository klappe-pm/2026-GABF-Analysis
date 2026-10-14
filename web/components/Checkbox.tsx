'use client';

import { useEffect, useRef } from 'react';
import { useSettings } from '@/design/runtime';
import { typeOf } from '@/design/helpers';

type Props = { id: string; label: string; hint?: string; defaultChecked?: boolean; checked?: boolean; onCheckedChange?: (checked: boolean) => void; disabled?: boolean };

// A Material checkbox with its label beside it; the whole row is the target. Pass checked and
// onCheckedChange to control it.
export function Checkbox({ id, label, hint, defaultChecked, checked, onCheckedChange, disabled }: Props) {
  const s = useSettings('checkbox');
  const ref = useRef<HTMLElement & { checked: boolean }>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !onCheckedChange) return;
    const onChange = () => onCheckedChange(el.checked);
    el.addEventListener('change', onChange);
    return () => el.removeEventListener('change', onChange);
  }, [onCheckedChange]);
  return (
    <div className="flex items-start gap-1">
      <md-checkbox
        ref={ref}
        id={id}
        name={id}
        touch-target="wrapper"
        checked={(checked ?? defaultChecked) || undefined}
        disabled={disabled || undefined}
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
      <span className="flex flex-col pt-3">
        <label htmlFor={id} className={disabled ? 'text-on-surface-variant' : 'text-on-surface'}>
          <span className={typeOf(s['Text style'] ?? 'body medium')}>{label}</span>
        </label>
        {hint ? <span id={`${id}-hint`} className="type-body-small text-on-surface-variant">{hint}</span> : null}
      </span>
    </div>
  );
}
