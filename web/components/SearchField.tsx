'use client';

import { useSettings } from '@/design/runtime';
import { Icon } from './Icon';

type Props = { id: string; label: string; placeholder: string; defaultValue?: string; error?: string; disabled?: boolean };

// A Material search field, outlined or filled as its spec says, with a search icon and an error line.
export function SearchField({ id, label, placeholder, defaultValue, error, disabled }: Props) {
  const s = useSettings('search-field');
  const Tag = (s['Field style'] === 'filled' ? 'md-filled-text-field' : 'md-outlined-text-field') as 'md-outlined-text-field';
  return (
    <Tag
      id={id}
      type="search"
      name="q"
      label={label}
      placeholder={placeholder}
      value={defaultValue ?? ''}
      disabled={disabled || undefined}
      error={error ? true : undefined}
      error-text={error}
      className="w-full"
    >
      <Icon name="search" slot="leading-icon" size={24} />
    </Tag>
  );
}
