'use client';

import { useEffect, useRef } from 'react';
import { useReducedMotion, useSettings } from '@/design/runtime';
import { shape, vars } from '@/design/helpers';
import { Button } from './Button';
import { Checkbox } from './Checkbox';
import { SearchField } from './SearchField';
import { Select } from './Select';

export type FilterField = { id: string; label: string; options: { value: string; label: string }[] };
export type FilterGroup = { key: string; title: string; fields: FilterField[] };

export type FiltersCopy = {
  trigger: string;
  title: string;
  close: string;
  reset: string;
  apply: string;
  matchCount: string;
  searchLabel: string;
  searchPlaceholder: string;
  partialLabel: string;
  partialNote: string;
};

// The filter fields: a search field, then When, What, Where, and Who as groups of selects.
function Fields({ idPrefix, copy, groups }: { idPrefix: string; copy: FiltersCopy; groups: FilterGroup[] }) {
  return (
    <div className="flex flex-col gap-6">
      <SearchField id={`${idPrefix}-search`} label={copy.searchLabel} placeholder={copy.searchPlaceholder} />
      {groups.map((g) => (
        <fieldset key={g.key} className="flex flex-col gap-3">
          <legend className="type-title-small mb-3 text-on-surface">{g.title}</legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {g.fields.map((f) => <Select key={f.id} id={`${idPrefix}-${f.id}`} label={f.label} options={f.options} />)}
          </div>
          {g.key === 'when' ? <Checkbox id={`${idPrefix}-partial`} label={copy.partialLabel} hint={copy.partialNote} /> : null}
        </fieldset>
      ))}
      <p role="status" className="type-title-small tabular-nums text-on-surface">{copy.matchCount}</p>
    </div>
  );
}

// The filters laid out in place, as the sheet shows them when open.
export function FiltersForm({ idPrefix, copy, groups }: { idPrefix: string; copy: FiltersCopy; groups: FilterGroup[] }) {
  const s = useSettings('filters-sheet');
  return (
    <form
      aria-labelledby={`${idPrefix}-title`}
      onSubmit={(e) => e.preventDefault()}
      className="flex flex-col gap-4 bg-surface-container-high p-6"
      style={{ borderRadius: shape(s.Shape ?? 'extra large'), maxWidth: `${Number(s['Width on wide screens'] ?? 560)}px` }}
    >
      <h2 id={`${idPrefix}-title`} className="type-headline-small text-on-surface">{copy.title}</h2>
      <Fields idPrefix={idPrefix} copy={copy} groups={groups} />
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" type="reset">{copy.reset}</Button>
        <Button variant="primary" type="submit">{copy.apply}</Button>
      </div>
    </form>
  );
}

// The Filters button and its Material dialog. F opens it; Escape closes it; focus stays inside while open.
export function FiltersSheet({ copy, groups }: { copy: FiltersCopy; groups: FilterGroup[] }) {
  const s = useSettings('filters-sheet');
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement & { show(): void; close(): void; open: boolean }>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.composedPath()[0] as HTMLElement | null;
      if (e.key !== 'f' || e.metaKey || e.ctrlKey || e.altKey || el?.closest?.('input, select, textarea, [contenteditable], md-outlined-text-field, md-filled-text-field')) return;
      if (ref.current && !ref.current.open) { e.preventDefault(); ref.current.show(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  const width = `min(${Number(s['Width on wide screens'] ?? 560)}px, 100% - 48px)`;
  return (
    <>
      <Button variant="secondary" aria-haspopup="dialog" onClick={() => ref.current?.show()}>{copy.trigger}</Button>
      <md-dialog
        ref={ref}
        quick={reduce || undefined}
        aria-labelledby="filters-sheet-title"
        style={vars({ '--md-dialog-container-shape': shape(s.Shape ?? 'extra large'), maxWidth: width, width })}
      >
        <div slot="headline" id="filters-sheet-title">{copy.title}</div>
        <form slot="content" id="filters-sheet-form" method="dialog">
          <Fields idPrefix="filters-sheet" copy={copy} groups={groups} />
        </form>
        <div slot="actions">
          <Button variant="quiet" onClick={() => ref.current?.close()}>{copy.close}</Button>
          <Button variant="secondary" type="reset" form="filters-sheet-form">{copy.reset}</Button>
          <Button variant="primary" type="submit" form="filters-sheet-form" value="apply">{copy.apply}</Button>
        </div>
      </md-dialog>
    </>
  );
}
