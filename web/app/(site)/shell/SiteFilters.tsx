'use client';

// The Filters button with its dialog, and the active filter chips, wired to the global filter. The
// dialog edits a draft: Show results applies it, Close drops it. Option lists are progressive, as on
// the current site: each lists the values left by the other choices, with their counts.
import { useCallback, useMemo, useState } from 'react';
import { FilterChips } from '@/components/FilterChips';
import { type FilterGroup, FiltersDialog, type FiltersCopy } from '@/components/FiltersDialog';
import { FILTERS, applyFilters, type FilterState, optionList, pruneState, scopeRows } from '@/lib/filter-model.mjs';
import { useGlobalFilter } from '@/lib/global-filter';

export type SiteFiltersConfig = {
  trigger: string;
  triggerWithCount: string;
  accessibleWithCount: string;
  dialog: Omit<FiltersCopy, 'matchCount' | 'trigger'>;
  groups: Record<string, string>;
  dimensions: Record<string, string>;
  labels: Record<string, Record<string, string>>;
  all: string;
  withCount: string;
  matchOne: string;
  matchMany: string;
  loading: string;
  loadError: string;
  chips: { bar: string; chip: string; search: string; partial: string; fixedTooltip: string; remove: string; clear: string };
};

const GROUP_KEYS: Record<string, string> = { When: 'when', What: 'what', Where: 'where', Who: 'who' };
// The option that clears a dimension; never a value in the data.
const ALL = 'all';
// The investor filter is built but hidden until the owner sets NEXT_PUBLIC_FILTER_INVESTOR=on.
const INVESTOR_ON = process.env.NEXT_PUBLIC_FILTER_INVESTOR === 'on';

const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in values ? String(values[k]) : m));

// The label a value shows: the copy's label dictionary first, then the state's name, then the value.
export function useValueLabel(config: SiteFiltersConfig) {
  const { data } = useGlobalFilter();
  return useCallback((id: string, value: string) => {
    const own = config.labels[id]?.[value];
    if (own) return own;
    if (id === 'state') return data?.meta.states?.find((s) => s.state === value)?.name ?? value;
    if (id === 'brewery_key') return String((data?.rows.find((r) => r.brewery_key === value)?.brewery_name as string | undefined) ?? value);
    return value;
  }, [config.labels, data]);
}

function chipText(config: SiteFiltersConfig, s: FilterState, label: (id: string, v: string) => string) {
  const out: { key: string; text: string }[] = [];
  for (const d of FILTERS) if (s[d.id]) out.push({ key: d.id, text: fill(config.chips.chip, { dimension: config.dimensions[d.id] ?? d.id, value: label(d.id, s[d.id]) }) });
  if (s.q) out.push({ key: 'q', text: fill(config.chips.search, { query: s.q }) });
  if (s.years === 'all' && !s.year) out.push({ key: 'years', text: config.chips.partial });
  return out;
}

// The progressive filter fields for a selection, ready for FiltersDialog or FiltersForm: every dimension
// the page's scope leaves open (year, medal, category, style, ABV, hop variety, both hop farm filters,
// region, state, city, Fed district, brewery, brewery type, ownership, distribution), each listing only
// the values the other choices leave, with counts, in the current site's order (site/assets/sort-order.mjs:
// years newest first, ABV bands by range, the rest by label with numbers first). setField drops any other
// choice the new one leaves empty, as the current site does. Rows load on first use (load()).
export function useFilterFields(config: SiteFiltersConfig, draft: FilterState) {
  const { scope, data, status } = useGlobalFilter();
  const label = useValueLabel(config);
  const pool = useMemo(() => (data ? scopeRows(data.rows, scope.scope) : []), [data, scope]);
  const groups: FilterGroup[] = useMemo(() => Object.keys(GROUP_KEYS).map((g) => ({
    key: GROUP_KEYS[g],
    title: config.groups[GROUP_KEYS[g]],
    fields: FILTERS.filter((d) => d.group === g && (!d.hidden || INVESTOR_ON) && !Object.hasOwn(scope.scope, d.id)).map((d) => {
      const opts = data ? optionList(pool, d.id, draft).map((o) => ({ value: o.value, label: fill(config.withCount, { label: label(d.id, o.value), count: o.count }) })) : [];
      const current = draft[d.id];
      if (current && !opts.some((o) => o.value === current)) opts.unshift({ value: current, label: label(d.id, current) });
      return { id: d.id, label: config.dimensions[d.id] ?? d.id, options: [{ value: ALL, label: config.all }, ...opts] };
    }),
  // A group the page's scope fixes entirely (When on a page for one year) is left out, partial years with it.
  })).filter((g) => g.fields.length), [config, data, pool, draft, scope, label]);
  const count = data ? applyFilters(pool, draft).length : null;
  const matchCount = count === null ? '' : count === 1 ? config.matchOne : fill(config.matchMany, { count: count.toLocaleString('en-US') });
  const busy = status === 'error' ? config.loadError : status !== 'ready' ? config.loading : undefined;
  const setField = useCallback((d: FilterState, id: string, value: string): FilterState => {
    const next = { ...d, [id]: value === ALL ? '' : value };
    return pool.length ? pruneState(pool, next, id) : next;
  }, [pool]);
  // Values for the selects, with "All" for a dimension that is not set.
  const values = Object.fromEntries(FILTERS.map((d) => [d.id, draft[d.id] || ALL]));
  return { groups, count, matchCount, busy, setField, values, label };
}

export function SiteFilters({ config }: { config: SiteFiltersConfig }) {
  const { state, setState, load } = useGlobalFilter();
  const [draft, setDraft] = useState<FilterState>(state);
  const { groups, matchCount, busy, setField, values, label } = useFilterFields(config, draft);
  const active = chipText(config, state, label).length;
  const copy: FiltersCopy = { ...config.dialog, trigger: config.trigger, matchCount };

  return (
    <FiltersDialog
      copy={copy}
      groups={groups}
      triggerLabel={active ? fill(config.triggerWithCount, { count: active }) : config.trigger}
      triggerAccessibleLabel={active ? fill(config.accessibleWithCount, { count: active }) : undefined}
      controls={{
        values,
        onField: (id, v) => setDraft((d) => setField(d, id, v)),
        query: draft.q ?? '',
        onQuery: (q) => setDraft((d) => ({ ...d, q })),
        partial: draft.years === 'all',
        onPartial: (on) => setDraft((d) => ({ ...d, years: on ? 'all' : '' })),
        onApply: () => setState(draft),
        onReset: () => setDraft({}),
        onOpen: () => { setDraft(state); load(); },
        busy,
      }}
    />
  );
}

// The chips under the header: one for each filter the reader set (removable) and one for each thing the
// page itself is limited to (fixed). Nothing shows when neither exists.
export function SiteFilterChips({ config }: { config: SiteFiltersConfig }) {
  const { state, remove, clear, scope } = useGlobalFilter();
  const label = useValueLabel(config);
  const set = chipText(config, state, label);
  if (!set.length && !scope.fixed.length) return null;
  const entries = [
    ...scope.fixed.map((text) => ({ text, fixedNote: config.chips.fixedTooltip })),
    ...set.map((c) => ({ text: c.text, removeLabel: fill(config.chips.remove, { chip: c.text }) })),
  ];
  return (
    <div className="mx-auto max-w-(--app-page-max) px-(--app-margin) pt-4">
      <FilterChips
        label={config.chips.bar}
        entries={entries}
        clearLabel={config.chips.clear}
        onRemove={(text) => { const hit = set.find((c) => c.text === text); if (hit) remove(hit.key); }}
        onClear={clear}
      />
    </div>
  );
}
