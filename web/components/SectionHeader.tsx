'use client';

import type { ReactNode } from 'react';
import { useSettings } from '@/design/runtime';
import { color, typeOf } from '@/design/helpers';

// A section header: the title in its spec's type role and color, an optional line under it, and a divider.
// A level 3 header steps down one type role.
const STEP_DOWN: Record<string, string> = {
  'display large': 'display medium', 'display medium': 'display small', 'display small': 'headline large',
  'headline large': 'headline medium', 'headline medium': 'headline small', 'headline small': 'title large',
  'title large': 'title medium', 'title medium': 'title small', 'title small': 'title small',
};

export function SectionHeader({ id, title, lead, level = 2, aside }: { id: string; title: string; lead?: ReactNode; level?: 2 | 3; aside?: ReactNode }) {
  const s = useSettings('section-header');
  const Heading = level === 2 ? 'h2' : 'h3';
  const role = String(s['Title style'] ?? 'headline small');
  return (
    <header className="flex flex-col gap-2 pb-3" data-component="section-header">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <Heading id={id} className={`scroll-mt-24 text-balance ${typeOf(level === 2 ? role : STEP_DOWN[role] ?? role)}`} style={{ color: color(s['Title color'] ?? 'primary') }}>{title}</Heading>
        {aside}
      </div>
      {lead ? <p className="type-body-medium max-w-measure text-on-surface-variant">{lead}</p> : null}
      {s.Divider === 'no' ? null : <md-divider />}
    </header>
  );
}
