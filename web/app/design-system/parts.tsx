import type { ReactNode } from 'react';
import { SectionHeader } from '@/components/SectionHeader';
import { group, t } from '@/lib/content';
import { specRepoPath } from '@/lib/design-source';
import { SOURCE_URL } from '@/lib/repo';
import { SettingsList, SpecimenMeta } from './live';

// One state of a component, with its label.
export function State({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`flex min-w-0 flex-col gap-2 ${wide ? 'md:col-span-2' : ''}`}>
      <p className="type-label-medium text-on-surface-variant">{label}</p>
      <div className="flex min-w-0 flex-wrap items-start gap-3">{children}</div>
    </div>
  );
}

// A component's entry, on a Material outlined card: its name, status, and spec link, its states (the part
// the spec image shows), then what can change, read from its spec.
export function Specimen({ name, title, children, columns = 'md:grid-cols-2' }: { name: string; title: string; children: ReactNode; columns?: string }) {
  return (
    <article id={`component-${name}`} className="scroll-mt-16">
      <md-outlined-card className="flex min-w-0 flex-col gap-4 p-4 sm:p-6">
        <SectionHeader
          id={`component-${name}-title`}
          level={3}
          title={title}
          aside={(
            <SpecimenMeta
              name={name}
              statusLabel={t('pages.design-system.status.label')}
              statuses={group('pages.design-system.status')}
              specLink={t('pages.design-system.page.spec_link')}
              href={`${SOURCE_URL}/${specRepoPath(name)}`}
            />
          )}
        />
        <div id={`component-${name}-sample`} className={`grid min-w-0 grid-cols-1 gap-6 p-1 ${columns}`}>{children}</div>
        <md-divider />
        <SettingsList name={name} heading={t('pages.design-system.page.settings_heading')} />
      </md-outlined-card>
    </article>
  );
}
