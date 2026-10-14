'use client';

import { useEffect, useRef } from 'react';
import { Button } from './Button';
import { Checkbox } from './Checkbox';
import { Icon } from './Icon';
import { SearchField } from './SearchField';
import { Select } from './Select';

export type FilterField = { id: string; label: string; options: { value: string; label: string }[] };
export type FilterGroup = { key: string; title: string; fields: FilterField[] };

export type FiltersCopy = {
  trigger: string;
  triggerWithCount?: string;
  triggerAccessible?: string;
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

type FormProps = { idPrefix: string; copy: FiltersCopy; groups: FilterGroup[]; onClose?: () => void };

// The one Filters control as a form: a search field, then When, What, Where, and Who as ruled sections of numbered fields.
export function FiltersForm({ idPrefix, copy, groups, onClose }: FormProps) {
  let n = 1;
  const num = () => String(n++).padStart(2, '0');
  return (
    <form className="flex max-h-full flex-col border-2 border-ink bg-ground" onSubmit={(e) => { e.preventDefault(); onClose?.(); }} aria-labelledby={`${idPrefix}-title`}>
      <div className="flex items-center justify-between gap-3 border-b-2 border-ink bg-ground-tone px-4 py-3">
        <h2 id={`${idPrefix}-title`} className="text-h3 text-ink">{copy.title}</h2>
        {onClose ? (
          <button type="button" onClick={onClose} className="inline-flex min-h-6 items-center gap-1 border border-rule-strong bg-ground px-2 py-1 font-narrow text-label uppercase text-ink state-hover:bg-ground-tone">
            <Icon name="close" />
            {copy.close}
          </button>
        ) : null}
      </div>
      <div className="flex flex-col gap-5 overflow-y-auto px-4 py-4">
        <SearchField id={`${idPrefix}-search`} number={num()} label={copy.searchLabel} placeholder={copy.searchPlaceholder} />
        {groups.map((g) => (
          <fieldset key={g.key} className="flex flex-col gap-3">
            <legend className="mb-3 w-full border-b border-green pb-1 text-h3 text-green">{g.title}</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {g.fields.map((f) => <Select key={f.id} id={`${idPrefix}-${f.id}`} number={num()} label={f.label} options={f.options} />)}
            </div>
            {g.key === 'when' ? <Checkbox id={`${idPrefix}-partial`} label={copy.partialLabel} hint={copy.partialNote} /> : null}
          </fieldset>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-ink bg-ground-tone px-4 py-3">
        <p role="status" className="text-data font-semibold tabular-nums text-ink">{copy.matchCount}</p>
        <div className="flex gap-2">
          <Button variant="secondary" type="reset">{copy.reset}</Button>
          <Button variant="primary" type="submit">{copy.apply}</Button>
        </div>
      </div>
    </form>
  );
}

// The header trigger and the sheet: a bottom sheet on phones and a panel under the header on wide screens,
// both a modal dialog so focus stays inside until it closes. F opens it; Escape closes it.
export function FiltersSheet({ copy, groups, activeCount = 0 }: { copy: FiltersCopy; groups: FilterGroup[]; activeCount?: number }) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = () => ref.current?.close();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.key !== 'f' || e.metaKey || e.ctrlKey || e.altKey || el?.closest('input, select, textarea, [contenteditable]')) return;
      if (ref.current && !ref.current.open) { e.preventDefault(); ref.current.showModal(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  return (
    <>
      <Button
        variant="secondary"
        onClick={() => ref.current?.showModal()}
        aria-haspopup="dialog"
        aria-label={activeCount && copy.triggerAccessible ? copy.triggerAccessible : undefined}
        className="font-narrow uppercase"
      >
        {activeCount && copy.triggerWithCount ? copy.triggerWithCount : copy.trigger}
      </Button>
      <dialog ref={ref} className="filters-sheet" aria-labelledby="filters-sheet-title" onClick={(e) => { if (e.target === ref.current) close(); }}>
        <FiltersForm idPrefix="filters-sheet" copy={copy} groups={groups} onClose={close} />
      </dialog>
    </>
  );
}
