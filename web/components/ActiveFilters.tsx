import { Icon } from './Icon';

type Entry = { text: string; removeLabel?: string; fixedNote?: string };

// The active filters written as ruled entries on a line, each with its own remove box. Square, never pills.
export function ActiveFilters({ label, entries, clearLabel }: { label: string; entries: Entry[]; clearLabel: string }) {
  return (
    <section aria-label={label} className="flex flex-wrap items-center gap-2">
      <h2 className="font-narrow text-label uppercase text-ink-muted">{label}</h2>
      <ul className="flex flex-wrap gap-2">
        {entries.map((e) => (
          <li key={e.text} className={`inline-flex items-stretch border text-data ${e.fixedNote ? 'border-rule bg-ground-tone' : 'border-rule-strong bg-ground'}`} title={e.fixedNote}>
            <span className="px-2 py-1">{e.text}</span>
            {e.removeLabel ? (
              <button type="button" aria-label={e.removeLabel} className="inline-flex items-center border-l border-rule-strong px-2 text-ink-muted state-hover:bg-ground-tone state-hover:text-ink">
                <Icon name="close" />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      <button type="button" className="px-2 py-1 text-data text-ink underline decoration-rule-strong state-hover:decoration-ink">{clearLabel}</button>
    </section>
  );
}
