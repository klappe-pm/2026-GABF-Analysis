// The written findings of the analysis pages: each finding's copy with its figures computed from the data. A figure
// the data cannot give shows as a stated gap, never a guess.
import { t } from '@/lib/content';
import { laneModel } from '@/lib/site-data';
import type * as Findings from '@/lib/models/findings.mjs';

export const findingsModel = () => laneModel<typeof Findings>('findings');

export function FindingList({ findings, title, id = 'findings' }: { findings: Findings.Finding[]; title: string; id?: string }) {
  if (!findings.length) return null;
  return (
    <section className="flex flex-col gap-4" aria-labelledby={id}>
      <h2 id={id} className="type-headline-small text-primary">{title}</h2>
      <div className="grid gap-6 medium:grid-cols-2">
        {findings.map((f) => (
          <article key={f.name} className="flex flex-col gap-3 rounded-lg bg-surface-container-low p-5">
            <h3 className="type-title-large text-on-surface">{f.title}</h3>
            {f.blocks.map((b, i) => {
              if (b.type === 'heading') return <h4 key={i} className="type-title-small text-on-surface">{b.text}</h4>;
              if (b.type === 'gap') return <p key={i} className="type-body-medium text-on-surface-variant">{`${t('global.labels.not_found')}: ${b.missing.join(', ')}`}</p>;
              return <p key={i} className="type-body-medium max-w-measure text-on-surface-variant">{b.text}</p>;
            })}
          </article>
        ))}
      </div>
    </section>
  );
}
