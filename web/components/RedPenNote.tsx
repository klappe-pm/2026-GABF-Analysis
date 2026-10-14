import type { ReactNode } from 'react';
import { TextLink } from './TextLink';

// A margin note in red pen: the finding a reviewer would write beside the form.
// Red pen is reserved for findings and annotations, so a page carries one or two at most.
export function RedPenNote({ label, children, link }: { label: string; children: ReactNode; link?: { href: string; text: string } }) {
  return (
    <aside aria-label={label} className="flex max-w-measure flex-col gap-2 border-l border-red py-1 pl-4">
      <p className="font-narrow text-label uppercase text-red">{label}</p>
      <p className="text-lead text-red">{children}</p>
      {link ? <p className="text-data"><TextLink href={link.href} tone="red">{link.text}</TextLink></p> : null}
    </aside>
  );
}
