import { ControlField } from './FormField';
import { Icon } from './Icon';

type Props = {
  id: string;
  number: string;
  label: string;
  placeholder: string;
  defaultValue?: string;
  error?: string;
  disabled?: boolean;
  state?: string;
};

// The search field: a numbered field with a ruled input and a drawn search mark.
export function SearchField({ id, number, label, placeholder, defaultValue, error, disabled, state }: Props) {
  return (
    <ControlField number={number} label={label} htmlFor={id} error={error}>
      <span className="relative flex items-center">
        <span className="pointer-events-none absolute left-2 text-ink-muted"><Icon name="search" /></span>
        <input
          id={id}
          type="search"
          name="q"
          defaultValue={defaultValue}
          placeholder={placeholder}
          disabled={disabled}
          data-state={state}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`w-full border bg-ground py-2 pr-3 pl-6 text-body text-ink placeholder:text-ink-faint state-disabled:bg-ground-tone state-disabled:text-ink-faint ${error ? 'border-red' : 'border-rule-strong'}`}
        />
      </span>
    </ControlField>
  );
}
