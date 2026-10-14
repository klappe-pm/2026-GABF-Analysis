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

// The live selection when the page owns the filter state (the site shell does); without it the fields
// show their defaults, as the style guide's specimen does.
export type FiltersControls = {
  values: Record<string, string>;
  onField: (id: string, value: string) => void;
  query: string;
  onQuery: (query: string) => void;
  partial: boolean;
  onPartial: (include: boolean) => void;
  onApply: () => void;
  onReset: () => void;
  onOpen?: () => void;
  busy?: string;
};

// The filter fields: a search field, then When, What, Where, and Who as groups of selects.
function Fields({ idPrefix, copy, groups, controls }: { idPrefix: string; copy: FiltersCopy; groups: FilterGroup[]; controls?: FiltersControls }) {
  return (
    <div className="flex flex-col gap-6">
      <SearchField id={`${idPrefix}-search`} label={copy.searchLabel} placeholder={copy.searchPlaceholder} value={controls?.query} onValueChange={controls?.onQuery} />
      {groups.map((g) => (
        <fieldset key={g.key} className="flex flex-col gap-3">
          <legend className="type-title-small mb-3 text-on-surface">{g.title}</legend>
          <div className="grid grid-cols-1 gap-4 medium:grid-cols-2">
            {g.fields.map((f) => (
              <Select
                key={f.id}
                id={`${idPrefix}-${f.id}`}
                label={f.label}
                options={f.options}
                value={controls ? controls.values[f.id] ?? f.options[0]?.value : undefined}
                onValueChange={controls ? (v) => controls.onField(f.id, v) : undefined}
              />
            ))}
          </div>
          {g.key === 'when' ? <Checkbox id={`${idPrefix}-partial`} label={copy.partialLabel} hint={copy.partialNote} checked={controls?.partial} onCheckedChange={controls?.onPartial} /> : null}
        </fieldset>
      ))}
      <p role="status" className="type-title-small tabular-nums text-on-surface">{controls?.busy ?? copy.matchCount}</p>
    </div>
  );
}

// The filters laid out in place, as the sheet shows them when open.
export function FiltersForm({ idPrefix, copy, groups }: { idPrefix: string; copy: FiltersCopy; groups: FilterGroup[] }) {
  const s = useSettings('filters-dialog');
  return (
    <form
      aria-labelledby={`${idPrefix}-title`}
      data-component="filters-dialog"
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
// With controls, the fields show the page's selection, Show results applies it, and Clear all resets it.
export function FiltersDialog({ copy, groups, controls, triggerLabel, triggerAccessibleLabel }: { copy: FiltersCopy; groups: FilterGroup[]; controls?: FiltersControls; triggerLabel?: string; triggerAccessibleLabel?: string }) {
  const s = useSettings('filters-dialog');
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement & { show(): void; close(): void; open: boolean }>(null);
  const onOpen = controls?.onOpen;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.composedPath()[0] as HTMLElement | null;
      if (e.key !== 'f' || e.metaKey || e.ctrlKey || e.altKey || el?.closest?.('input, select, textarea, [contenteditable], md-outlined-text-field, md-filled-text-field')) return;
      if (ref.current && !ref.current.open) { e.preventDefault(); onOpen?.(); ref.current.show(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onOpen]);
  const width = `min(${Number(s['Width on wide screens'] ?? 560)}px, 100% - 48px)`;
  return (
    <>
      <Button variant="secondary" aria-haspopup="dialog" aria-label={triggerAccessibleLabel} onClick={() => { onOpen?.(); ref.current?.show(); }}>{triggerLabel ?? copy.trigger}</Button>
      <md-dialog
        ref={ref}
        data-component="filters-dialog"
        quick={reduce || undefined}
        aria-labelledby="filters-sheet-title"
        style={vars({ '--md-dialog-container-shape': shape(s.Shape ?? 'extra large'), maxWidth: width, width })}
      >
        {/* The page's base reset outranks Material's ::slotted spacing, so each slot sets Material's dialog padding itself. */}
        <div slot="headline" id="filters-sheet-title" className="px-6 pt-6 pb-4">{copy.title}</div>
        <form slot="content" id="filters-sheet-form" method="dialog" className="px-6 pt-2 pb-2" onSubmit={() => controls?.onApply()}>
          <Fields idPrefix="filters-dialog" copy={copy} groups={groups} controls={controls} />
        </form>
        <div slot="actions" className="flex flex-wrap justify-end gap-2 px-6 pt-4 pb-6">
          <Button variant="quiet" onClick={() => ref.current?.close()}>{copy.close}</Button>
          {controls ? <Button variant="secondary" onClick={controls.onReset}>{copy.reset}</Button> : <Button variant="secondary" type="reset" form="filters-sheet-form">{copy.reset}</Button>}
          <Button variant="primary" type="submit" form="filters-sheet-form" value="apply" onClick={controls ? () => { controls.onApply(); ref.current?.close(); } : undefined}>{copy.apply}</Button>
        </div>
      </md-dialog>
    </>
  );
}
