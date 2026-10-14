'use client';

import type { MouseEventHandler, ReactNode } from 'react';
import { useSettings } from '@/design/runtime';
import { shape, vars } from '@/design/helpers';

// The three jobs a button does; the button spec says which Material button style each one uses.
export type ButtonVariant = 'primary' | 'secondary' | 'quiet';

const ROLE_KEY: Record<ButtonVariant, string> = { primary: 'Main action', secondary: 'Other action', quiet: 'Quiet action' };
const TAGS = { filled: 'md-filled-button', tonal: 'md-filled-tonal-button', elevated: 'md-elevated-button', outlined: 'md-outlined-button', text: 'md-text-button' } as const;
const PREFIX = { filled: 'filled', tonal: 'filled-tonal', elevated: 'elevated', outlined: 'outlined', text: 'text' } as const;

type Props = {
  variant?: ButtonVariant;
  busy?: boolean;
  busyLabel?: string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  form?: string;
  value?: string;
  onClick?: MouseEventHandler<HTMLElement>;
  children: ReactNode;
  'aria-haspopup'?: 'dialog';
  'aria-label'?: string;
};

// A Material button. Busy buttons are disabled and say what is happening.
export function Button({ variant = 'secondary', busy = false, busyLabel, disabled, type = 'button', children, ...rest }: Props) {
  const s = useSettings('button');
  const style = String(s[ROLE_KEY[variant]] ?? 'outlined') as keyof typeof TAGS;
  const Tag = (TAGS[style] ?? TAGS.outlined) as 'md-filled-button';
  const p = `--md-${PREFIX[style] ?? 'outlined'}-button`;
  const density = Number(s.Density ?? 0);
  return (
    <Tag
      data-component="button"
      type={type}
      disabled={disabled || busy || undefined}
      aria-busy={busy || undefined}
      style={vars({ [`${p}-container-shape`]: shape(s.Shape ?? 'full'), [`${p}-container-height`]: `${40 + 4 * density}px` })}
      {...rest}
    >
      {busy && busyLabel ? busyLabel : children}
    </Tag>
  );
}
