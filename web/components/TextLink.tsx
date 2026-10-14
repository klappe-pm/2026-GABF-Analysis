'use client';

import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { useSettings } from '@/design/runtime';
import { color } from '@/design/helpers';

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode; state?: string; tone?: string };

// A link reads as a link: in its spec's color, underlined always or on hover. `tone` names another color role.
export function TextLink({ children, className = '', state, tone, style, ...rest }: Props) {
  const s = useSettings('text-link');
  const underline = s.Underline === 'on hover' ? 'no-underline state-hover:underline' : 'underline state-hover:decoration-2';
  return (
    <a data-state={state} className={`${underline} ${className}`} style={{ color: color(tone ?? s.Color ?? 'primary'), ...style }} {...rest}>
      {children}
    </a>
  );
}
