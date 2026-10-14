import type { ReactNode } from 'react';

// A form section header: the heading in judging green over a green rule, with an optional line under it.
export function SectionHeader({ id, title, lead, level = 2, aside }: { id: string; title: string; lead?: ReactNode; level?: 2 | 3; aside?: ReactNode }) {
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <header className={`flex flex-col gap-2 border-b border-green pb-2 ${level === 2 ? 'border-b-2' : ''}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <Heading id={id} className={`scroll-mt-8 text-balance text-green ${level === 2 ? 'text-h2' : 'text-h3'}`}>{title}</Heading>
        {aside}
      </div>
      {lead ? <p className="max-w-measure text-body text-ink-muted">{lead}</p> : null}
    </header>
  );
}
