'use client';

// The Explore page: every award in one searchable table, your own awards added from a CSV (read in this browser,
// never uploaded), and the filters the global Filters panel does not carry. The table also follows Filters.
import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/Button';
import { type Column, DataTable, type Row } from '@/components/DataTable';
import { MedalMark, type MedalName } from '@/components/MedalMark';
import { SearchField } from '@/components/SearchField';
import { SectionHeader } from '@/components/SectionHeader';
import { Select } from '@/components/Select';
import { StateCard } from '@/components/StateCard';
import { TextLink } from '@/components/TextLink';
import { useFilteredRows, usePageScope } from '@/lib/global-filter';
import { href, paths } from '@/lib/href';
import { INVESTOR_ON } from '@/app/(site)/shell/SiteFilters';
import { type ImportError, readAwards } from '@/lib/models/explore-import.mjs';
import type { ExploreRow } from '@/lib/models/analysis.mjs';
import { Count, fill, num, ViewFrame, type ViewCopy } from '@/app/(site)/analysis/parts/kit';

export type ExploreCopy = {
  view: ViewCopy;
  search: { label: string; placeholder: string; hint: string };
  filters: { title: string; reset: string; section: string; sectionAll: string; investors: string; investorsPlaceholder: string; trait: string; traitAll: string; sections: Record<string, string>; traits: Record<string, string> };
  table: { title: string; count: string; sortHint: string; imported: string; importedCount: string; columns: Record<'year' | 'medal' | 'beer' | 'brewery' | 'city' | 'category' | 'family' | 'owner', string> };
  import: { title: string; privacy: string; help: string; chooseFile: string; result: string; remove: string; removed: string; reading: string; errors: Record<string, string> };
  links: { savedViews: string };
  empty: { awards: string; hint: string };
  families: Record<string, string>;
  ownership: Record<string, string>;
  savedViewsHref: string;
};

const MEDAL_RANK: Record<string, number> = { Gold: 0, Silver: 1, Bronze: 2 };
const words = (s: string) => s.toLowerCase().split(/\s+/).filter(Boolean);

type Entry = ExploreRow & { imported?: boolean };

function asRow(a: { year: number; medal: string; beer: string; brewery: string; city: string; state: string; category: string }): Entry {
  return {
    year: a.year, medal: a.medal, beer_name: a.beer, brewery_name: a.brewery, city: a.city, state: a.state, category_name: a.category, partial: false, imported: true,
    category_type: null, style_family: null, abv_band: null, hop_varieties: null, hop_farms_named: null, hop_farms_grown: null, region: null, fed_district_name: null,
    brewery_key: null, brewery_type: null, ownership_type: null, distribution_channel: null, brewery_location: null, state_name: null, search_extra: null,
    category_slug: null, category_number: null, brewery_slug: null, section: null, parent: null, stem: null, investor: null, traits: [],
  } as unknown as Entry;
}

export function ExploreView({ rows, copy, firstCompleteYear }: { rows: ExploreRow[]; copy: ExploreCopy; firstCompleteYear: number | null }) {
  usePageScope({}, []);
  const [imported, setImported] = useState<Entry[]>([]);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const [reading, setReading] = useState(false);
  const [query, setQuery] = useState('');
  const [section, setSection] = useState('');
  const [trait, setTrait] = useState('');
  const [investor, setInvestor] = useState('');
  const picker = useRef<HTMLInputElement>(null);

  const all = useMemo<Entry[]>(() => [...rows, ...imported], [rows, imported]);
  const scoped = useFilteredRows(all);
  const owner = (r: Entry) => (r.parent as string | null) || (r.ownership_type ? copy.ownership[r.ownership_type as string] ?? '' : '');
  const shown = useMemo(() => {
    const need = words(query);
    const inv = investor.trim().toLowerCase();
    return scoped.filter((r) => {
      if (section && r.section !== section) return false;
      if (trait && !r.traits.includes(trait)) return false;
      if (inv && !(r.investor ?? '').toLowerCase().includes(inv)) return false;
      if (!need.length) return true;
      const hay = `${r.beer_name} ${r.brewery_name} ${r.city} ${owner(r)}`.toLowerCase();
      return need.every((w) => hay.includes(w));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoped, query, section, trait, investor]);

  const describe = (e: ImportError) => fill(copy.import.errors[e.code] ?? e.code, { row: e.row ?? '', count: e.count ?? '', expected: e.expected ?? '', column: e.column ?? '' });

  async function onFile(file: File | undefined) {
    if (!file) return;
    setReading(true);
    setMessage(null);
    const result = readAwards(await file.text(), file.size);
    setReading(false);
    if (picker.current) picker.current.value = '';
    if (result.error) { setMessage({ error: true, text: describe(result.error) }); return; }
    const have = new Set(imported.map((r) => [r.year, r.medal, r.beer_name, r.brewery_name, r.city, r.state, r.category_name].join('|').toLowerCase()));
    const fresh = result.awards.filter((a) => !have.has([a.year, a.medal, a.beer, a.brewery, a.city, a.state, a.category].join('|').toLowerCase()));
    setImported((cur) => [...cur, ...fresh.map(asRow)]);
    setMessage({ error: false, text: fill(copy.import.result, { added: num(fresh.length), skipped: num(result.skipped + result.awards.length - fresh.length) }) });
  }

  const columns: Column[] = [
    { key: 'year', label: copy.table.columns.year, numeric: true, sortable: true },
    { key: 'medal', label: copy.table.columns.medal, sortable: true },
    { key: 'beer', label: copy.table.columns.beer, sortable: true },
    { key: 'brewery', label: copy.table.columns.brewery, sortable: true },
    { key: 'city', label: copy.table.columns.city, sortable: true },
    { key: 'category', label: copy.table.columns.category, sortable: true },
    { key: 'family', label: copy.table.columns.family, sortable: true },
    { key: 'owner', label: copy.table.columns.owner, sortable: true },
  ];
  const table: Row[] = shown.map((r, i) => {
    const family = r.style_family ? copy.families[r.style_family as string] ?? (r.style_family as string) : '';
    return {
      key: `${r.year}-${r.medal}-${r.beer_name}-${i}`,
      sort: { year: r.year as number, medal: MEDAL_RANK[r.medal as string] ?? 9, beer: r.beer_name as string, brewery: r.brewery_name as string, city: `${r.city}, ${r.state}`, category: r.category_name as string, family, owner: owner(r) },
      cells: {
        year: r.year,
        medal: (
          <span className="inline-flex items-center gap-2">
            <MedalMark medal={r.medal as MedalName} size="sm" title={copy.view.medals[r.medal as string] ?? (r.medal as string)} />
            {copy.view.medals[r.medal as string] ?? (r.medal as string)}
          </span>
        ),
        beer: (
          <>
            {r.stem ? <TextLink href={href(paths.beer(r.year as number, r.stem))}>{r.beer_name as string}</TextLink> : (r.beer_name as string)}
            {r.imported ? <span className="text-on-surface-variant"> ({copy.table.imported})</span> : null}
          </>
        ),
        brewery: r.brewery_slug ? <TextLink href={href(paths.brewery(r.brewery_slug as string))}>{r.brewery_name as string}</TextLink> : (r.brewery_name as string),
        city: `${r.city}, ${r.state}`,
        category: r.category_slug ? <TextLink href={href(paths.category(r.category_slug as string))}>{r.category_name as string}</TextLink> : (r.category_name as string),
        family,
        owner: owner(r),
      },
    };
  });
  const reset = () => { setSection(''); setTrait(''); setInvestor(''); };
  const filtersOn = Boolean(section || trait || investor);

  return (
    <>
      <section className="flex flex-col gap-4" aria-labelledby="import">
        <SectionHeader id="import" title={copy.import.title} lead={copy.import.privacy} />
        <p className="type-body-medium max-w-measure text-on-surface-variant">{copy.import.help}</p>
        <div className="flex flex-wrap items-center gap-3">
          <input ref={picker} type="file" accept=".csv,text/csv" className="sr-only" tabIndex={-1} aria-label={copy.import.chooseFile} onChange={(e) => onFile(e.target.files?.[0])} />
          <Button variant="secondary" busy={reading} busyLabel={copy.import.reading} onClick={() => picker.current?.click()}>{copy.import.chooseFile}</Button>
          {imported.length ? <Button variant="quiet" onClick={() => { setImported([]); setMessage({ error: false, text: copy.import.removed }); }}>{copy.import.remove}</Button> : null}
        </div>
        {message ? <StateCard kind={message.error ? 'error' : 'notice'} title={message.text} /> : null}
      </section>
      <section className="flex flex-col gap-4" aria-labelledby="filters">
        <SectionHeader id="filters" title={copy.filters.title} />
        <div className="grid gap-4 medium:grid-cols-2 expanded:grid-cols-4">
          <SearchField id="explore-search" label={copy.search.label} placeholder={copy.search.placeholder} value={query} onValueChange={setQuery} />
          <Select id="explore-section" label={copy.filters.section} value={section} onValueChange={setSection} options={[{ value: '', label: copy.filters.sectionAll }, ...Object.entries(copy.filters.sections).map(([value, label]) => ({ value, label }))]} />
          <Select id="explore-trait" label={copy.filters.trait} value={trait} onValueChange={setTrait} options={[{ value: '', label: copy.filters.traitAll }, ...Object.entries(copy.filters.traits).map(([value, label]) => ({ value, label }))]} />
          {INVESTOR_ON ? <SearchField id="explore-investors" label={copy.filters.investors} placeholder={copy.filters.investorsPlaceholder} value={investor} onValueChange={setInvestor} /> : null}
        </div>
        <p className="type-body-small text-on-surface-variant">{copy.search.hint}</p>
        {filtersOn ? <p><Button variant="quiet" onClick={reset}>{copy.filters.reset}</Button></p> : null}
      </section>
      <ViewFrame rows={scoped} scopeCount={all.length} copy={copy.view} firstCompleteYear={firstCompleteYear}>
        <section className="flex flex-col gap-3" aria-labelledby="awards">
          <SectionHeader id="awards" title={copy.table.title} />
          <Count text={`${fill(copy.table.count, { count: num(shown.length), total: num(all.length) })}${imported.length ? `. ${fill(copy.table.importedCount, { count: num(imported.length) })}` : ''}`} />
          {shown.length ? (
            <DataTable caption={copy.table.title} sortHint={copy.table.sortHint} columns={columns} rows={table} initialSort={{ key: 'year', dir: 'descending' }} />
          ) : (
            <StateCard kind="empty" title={copy.empty.awards}>{copy.empty.hint}</StateCard>
          )}
        </section>
      </ViewFrame>
    </>
  );
}
