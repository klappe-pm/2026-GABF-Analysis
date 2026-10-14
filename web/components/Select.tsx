import { ControlField } from './FormField';
import { Icon } from './Icon';

type Option = { value: string; label: string; disabled?: boolean };

type Props = {
  id: string;
  number: string;
  label: string;
  options: Option[];
  defaultValue?: string;
  disabled?: boolean;
  state?: string;
};

// A native select drawn as a ruled box with a drawn chevron. Native, so keyboard and screen reader behavior is the platform's.
export function Select({ id, number, label, options, defaultValue, disabled, state }: Props) {
  return (
    <ControlField number={number} label={label} htmlFor={id}>
      <span className="relative flex items-center">
        <select
          id={id}
          name={id}
          defaultValue={defaultValue}
          disabled={disabled}
          data-state={state}
          className="w-full border border-rule-strong bg-ground py-2 pr-6 pl-3 text-data text-ink state-hover:border-ink state-disabled:border-rule state-disabled:bg-ground-tone state-disabled:text-ink-faint"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-2 text-ink-muted"><Icon name="chevron-down" /></span>
      </span>
    </ControlField>
  );
}
