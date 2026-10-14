import type { AnchorHTMLAttributes, ReactNode } from 'react';

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode; tone?: 'ink' | 'red'; state?: string };

// A link reads as a link: underlined, in the text's own ink. Red only inside a red pen note.
export function TextLink({ children, tone = 'ink', className = '', state, ...rest }: Props) {
  const color = tone === 'red' ? 'text-red decoration-red state-hover:decoration-2' : 'text-ink decoration-rule-strong state-hover:decoration-ink';
  return (
    <a data-state={state} className={`underline transition-colors duration-(--gabf-duration-quick) ${color} ${className}`} {...rest}>
      {children}
    </a>
  );
}
