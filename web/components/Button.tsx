import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet';

const BASE = 'inline-flex min-h-6 items-center justify-center gap-2 border px-4 py-2 font-sans text-data font-semibold transition-colors duration-(--gabf-duration-quick) state-disabled:cursor-not-allowed';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'border-ink bg-ink text-on-ink state-hover:border-ink-muted state-hover:bg-ink-muted state-disabled:border-rule state-disabled:bg-ground-tone state-disabled:text-ink-faint',
  secondary: 'border-rule-strong bg-ground text-ink state-hover:bg-ground-tone state-active:bg-green-tint state-disabled:border-rule state-disabled:bg-ground state-disabled:text-ink-faint',
  quiet: 'border-transparent bg-transparent px-2 text-ink underline decoration-rule-strong state-hover:decoration-ink state-disabled:text-ink-faint state-disabled:no-underline',
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  busy?: boolean;
  busyLabel?: string;
  children: ReactNode;
  state?: string;
};

// A form control: square, ruled, labelled with the action it performs.
export function Button({ variant = 'secondary', busy = false, busyLabel, children, className = '', state, type = 'button', ...rest }: Props) {
  return (
    <button
      type={type}
      aria-busy={busy || undefined}
      data-state={state}
      className={`${BASE} ${VARIANTS[variant]} ${className}`}
      {...rest}
      disabled={rest.disabled || busy}
    >
      {busy && busyLabel ? busyLabel : children}
    </button>
  );
}
