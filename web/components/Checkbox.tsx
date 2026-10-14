import { Icon } from './Icon';

type Props = { id: string; label: string; hint?: string; defaultChecked?: boolean; disabled?: boolean; state?: string };

// A square ruled box, like the tick boxes on a scoresheet. The check is drawn; the input stays native.
export function Checkbox({ id, label, hint, defaultChecked, disabled, state }: Props) {
  return (
    <div className="flex items-start gap-2">
      <span className="relative mt-1 inline-flex size-4 shrink-0">
        <input
          id={id}
          type="checkbox"
          name={id}
          defaultChecked={defaultChecked}
          disabled={disabled}
          data-state={state}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className="peer size-4 cursor-pointer border border-rule-strong bg-ground checked:border-ink checked:bg-ink state-hover:border-ink state-disabled:cursor-not-allowed state-disabled:border-rule state-disabled:bg-ground-tone"
        />
        <span className="pointer-events-none absolute inset-0 hidden text-on-ink peer-checked:flex"><Icon name="check" /></span>
      </span>
      <span className="flex flex-col">
        <label htmlFor={id} className="text-data text-ink peer-disabled:text-ink-faint">{label}</label>
        {hint ? <span id={`${id}-hint`} className="text-data text-ink-muted">{hint}</span> : null}
      </span>
    </div>
  );
}
