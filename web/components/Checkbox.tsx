'use client';

import { useSettings } from '@/design/runtime';
import { typeOf } from '@/design/helpers';

type Props = { id: string; label: string; hint?: string; defaultChecked?: boolean; disabled?: boolean };

// A Material checkbox with its label beside it; the whole row is the target.
export function Checkbox({ id, label, hint, defaultChecked, disabled }: Props) {
  const s = useSettings('checkbox');
  return (
    <div className="flex items-start gap-1" data-component="checkbox">
      <md-checkbox
        id={id}
        name={id}
        touch-target="wrapper"
        checked={defaultChecked || undefined}
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
