'use client';

import { useEffect, useRef } from 'react';
import { useSettings } from '@/design/runtime';
import { Icon } from './Icon';

type Props = { id: string; label: string; placeholder: string; defaultValue?: string; value?: string; onValueChange?: (value: string) => void; error?: string; disabled?: boolean };

// A Material search field, outlined or filled as its spec says, with a search icon and an error line.
// Pass value and onValueChange to control it.
export function SearchField({ id, label, placeholder, defaultValue, value, onValueChange, error, disabled }: Props) {
  const s = useSettings('search-field');
  const Tag = (s['Field style'] === 'filled' ? 'md-filled-text-field' : 'md-outlined-text-field') as 'md-outlined-text-field';
  const ref = useRef<HTMLElement & { value: string }>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !onValueChange) return;
    const onInput = () => onValueChange(el.value);
    el.addEventListener('input', onInput);
    return () => el.removeEventListener('input', onInput);
  }, [onValueChange]);
  return (
    <Tag
      ref={ref}
      data-component="search-field"
      id={id}
      type="search"
      name="q"
      label={label}
      placeholder={placeholder}
      value={value ?? defaultValue ?? ''}
      disabled={disabled || undefined}
      error={error ? true : undefined}
      error-text={error}
      className="w-full"
    >
      <Icon name="search" slot="leading-icon" size={24} />
    </Tag>
  );
}
