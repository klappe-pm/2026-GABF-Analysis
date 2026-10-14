import type { ReactNode } from 'react';
import { SectionHeader } from '@/components/SectionHeader';
import { TextLink } from '@/components/TextLink';
import { t } from '@/lib/content';
import { firstParagraph, spec } from '@/lib/system';
import { SOURCE_URL } from '@/lib/repo';

// A token's color shown as a ruled square, resolved inside a forced theme so both columns are exact.
export function Chip({ cssVar, theme }: { cssVar: string; theme: 'light' | 'dark' }) {
  return (
    <span data-theme={theme} className="inline-flex bg-transparent align-middle">
      <span className="inline-block size-5 border border-rule-strong" style={{ background: `var(${cssVar})` }} />
    </span>
  );
}

// One state of a component, labelled the way a form labels a box.
export function State({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`flex min-w-0 flex-col gap-2 ${wide ? 'md:col-span-2' : ''}`}>
      <p className="font-narrow text-micro uppercase text-ink-muted">{label}</p>
      <div className="flex min-w-0 flex-wrap items-start gap-3">{children}</div>
    </div>
  );
}

// A component's entry: heading, its purpose read from its spec, a link to the spec, and its states.
export function Specimen({ name, title, specLink, children, columns = 'md:grid-cols-2' }: { name: string; title: string; specLink: string; children: ReactNode; columns?: string }) {
  const s = spec(name);
  return (
    <article id={`component-${name}`} className="flex flex-col gap-5 pt-6">
      <SectionHeader
        id={`component-${name}-title`}
        level={3}
        title={title}
        lead={firstParagraph(s.sections['Purpose and when to use'] ?? '')}
        aside={(
          <span className="flex flex-wrap items-baseline gap-4 text-data">
            <span className="text-ink-muted">{t('pages.design-system.status.label')}: {t(`pages.design-system.status.${s.status}`)}</span>
            <TextLink href={`${SOURCE_URL}/${s.path}`}>{specLink}</TextLink>
          </span>
        )}
      />
      <div className={`grid grid-cols-1 gap-6 ${columns}`}>{children}</div>
    </article>
  );
}
