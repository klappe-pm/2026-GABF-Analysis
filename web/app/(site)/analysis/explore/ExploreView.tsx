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
import { INVESTOR_ON } from '@/lib/flags';
import { beerIdOf, PATCHABLE, breweryIdOf, type EnrichKind, ENRICH_KINDS, type ImportedAward, type ImportError, importedAwardId, type Patch, readAwards, readEnrichment } from '@/lib/models/explore-import.mjs';
import type { ExploreRow } from '@/lib/models/analysis.mjs';
import { Count, fill, num, ViewFrame, type ViewCopy } from '@/app/(site)/analysis/parts/kit';

export type ExploreCopy = {
  view: ViewCopy;
  search: { label: string; placeholder: string; hint: string };
  filters: { title: string; reset: string; section: string; sectionAll: string; investors: string; investorsPlaceholder: string; trait: string; traitAll: string; sections: Record<string, string>; traits: Record<string, string> };
  table: { title: string; count: string; sortHint: string; imported: string; importedCount: string; columns: Record<'year' | 'medal' | 'beer' | 'brewery' | 'city' | 'category' | 'family' | 'owner', string>; fields: Record<string, string> };
  import: { title: string; privacy: string; help: string; chooseFile: string; result: string; remove: string; removed: string; reading: string; kind: string; kinds: Record<'new' | EnrichKind, string>; helpById: string; resultById: string; errors: Record<string, string> };
  links: { savedViews: string };
  empty: { awards: string; hint: string };
  families: Record<string, string>;
  ownership: Record<string, string>;
  savedViewsHref: string;
};

const MEDAL_RANK: Record<string, number> = { Gold: 0, Silver: 1, Bronze: 2 };
const words = (s: string) => s.toLowerCase().split(/\s+/).filter(Boolean);

type Entry = ExploreRow & { imported?: boolean; details?: Record<string, string> };

function asRow(a: ImportedAward, ids: { beers: Map<string, string>; breweries: Map<string, string> }): Entry {
  return {
    award_id: importedAwardId(a),
    beer_id: ids.beers.get(`${a.beer}|${a.brewery}`) ?? beerIdOf(a.beer, a.brewery),
    brewery_id: ids.breweries.get(`${a.brewery}|${a.city}|${a.state}`) ?? breweryIdOf(a.brewery, a.city, a.state),
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
  const [kind, setKind] = useState<'new' | EnrichKind>('new');
  const [patches, setPatches] = useState<{ join: string; patch: Patch }[]>([]);
  const [query, setQuery] = useState('');
  const [section, setSection] = useState('');
  const [trait, setTrait] = useState('');
  const [investor, setInvestor] = useState('');
  const picker = useRef<HTMLInputElement>(null);

  // Details matched by identifier fill in the records they name: the owner, the investors, and the brewery type.
  const all = useMemo<Entry[]>(() => {
    const base = [...rows, ...imported];
    if (!patches.length) return base;
    const byJoin = new Map<string, Patch['fields'][]>();
    for (const { join, patch } of patches) byJoin.set(`${join}|${patch.id}`, [...(byJoin.get(`${join}|${patch.id}`) ?? []), patch.fields]);
    return base.map((r) => {
      let out = r as Entry;
      for (const join of Object.values(ENRICH_KINDS)) {
        for (const f of byJoin.get(`${join}|${(r as Record<string, unknown>)[join] as string}`) ?? []) {
          out = { ...out, details: { ...(out.details ?? {}), ...f }, ...(f.ownership ? { parent: f.ownership } : {}), ...(f.investors ? { investor: f.investors } : {}), ...(f.brewery_type ? { brewery_type: f.brewery_type } : {}) } as Entry;
        }
      }
      return out;
    });
  }, [rows, imported, patches]);
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
    const text = await file.text();
    setReading(false);
    if (picker.current) picker.current.value = '';
    if (kind !== 'new') {
      const join = ENRICH_KINDS[kind];
      const known = new Set(all.map((r) => (r as Record<string, unknown>)[join] as string));
      const found = readEnrichment(text, kind, known, file.size);
      if (found.error) { setMessage({ error: true, text: describe(found.error) }); return; }
      setPatches((cur) => [...cur, ...found.patches.map((patch) => ({ join, patch }))]);
      setMessage({ error: false, text: fill(copy.import.resultById, { updated: num(found.patches.length), skipped: num(found.skipped) }) });
      return;
    }
    const result = readAwards(text, file.size);
    if (result.error) { setMessage({ error: true, text: describe(result.error) }); return; }
    const have = new Set(imported.map((r) => [r.year, r.medal, r.beer_name, r.brewery_name, r.city, r.state, r.category_name].join('|').toLowerCase()));
    const fresh = result.awards.filter((a) => !have.has([a.year, a.medal, a.beer, a.brewery, a.city, a.state, a.category].join('|').toLowerCase()));
    const ids = {
      beers: new Map(all.map((r) => [`${r.beer_name}|${r.brewery_name}`, r.beer_id])),
      breweries: new Map(all.map((r) => [`${r.brewery_name}|${r.city}|${r.state}`, r.brewery_id])),
    };
    setImported((cur) => [...cur, ...fresh.map((a) => asRow(a, ids))]);
    setMessage({ error: false, text: fill(copy.import.result, { added: num(fresh.length), skipped: num(result.skipped + result.awards.length - fresh.length) }) });
  }

  // The details imported by identifier: one column for each field some record received (the owner has its own
  // column), and a Not Found cell where a record has none.
  const detailFields = PATCHABLE.filter((f) => f !== 'ownership' && patches.some((x) => f in x.patch.fields));
  const link = (v: string) => (/^https?:\/\//.test(v) ? <a className="text-primary underline" href={v} rel="noopener noreferrer">{v}</a> : v);
  const columns: Column[] = [
    { key: 'year', label: copy.table.columns.year, numeric: true, sortable: true },
    { key: 'medal', label: copy.table.columns.medal, sortable: true },
    { key: 'beer', label: copy.table.columns.beer, sortable: true },
    { key: 'brewery', label: copy.table.columns.brewery, sortable: true },
    { key: 'city', label: copy.table.columns.city, sortable: true },
    { key: 'category', label: copy.table.columns.category, sortable: true },
    { key: 'family', label: copy.table.columns.family, sortable: true },
    { key: 'owner', label: copy.table.columns.owner, sortable: true },
    ...detailFields.map((f) => ({ key: `d_${f}`, label: copy.table.fields[f] ?? f, sortable: true })),
  ];
  const table: Row[] = shown.map((r, i) => {
    const family = r.style_family ? copy.families[r.style_family as string] ?? (r.style_family as string) : '';
    return {
      key: `${r.year}-${r.medal}-${r.beer_name}-${i}`,
      sort: { year: r.year as number, medal: MEDAL_RANK[r.medal as string] ?? 9, beer: r.beer_name as string, brewery: r.brewery_name as string, city: `${r.city}, ${r.state}`, category: r.category_name as string, family, owner: owner(r), ...Object.fromEntries(detailFields.map((f) => [`d_${f}`, r.details?.[f] ?? ''])) },
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
        ...Object.fromEntries(detailFields.map((f) => [`d_${f}`, r.details?.[f] ? link(r.details[f]) : copy.view.notDefined])),
      },
    };
  });
  const reset = () => { setSection(''); setTrait(''); setInvestor(''); };
  const filtersOn = Boolean(section || trait || investor);

  return (
    <>
      <section className="flex flex-col gap-4" aria-labelledby="import">
        <SectionHeader id="import" title={copy.import.title} lead={copy.import.privacy} />
        <Select id="explore-import-kind" label={copy.import.kind} value={kind} onValueChange={(v) => setKind(v as 'new' | EnrichKind)} options={(Object.keys(copy.import.kinds) as ('new' | EnrichKind)[]).map((value) => ({ value, label: copy.import.kinds[value] }))} />
        <p className="type-body-medium max-w-measure text-on-surface-variant">{kind === 'new' ? copy.import.help : fill(copy.import.helpById, { column: ENRICH_KINDS[kind] })}</p>
        <div className="flex flex-wrap items-center gap-3">
          <input ref={picker} type="file" accept=".csv,text/csv" className="sr-only" tabIndex={-1} aria-label={copy.import.chooseFile} onChange={(e) => onFile(e.target.files?.[0])} />
          <Button variant="secondary" busy={reading} busyLabel={copy.import.reading} onClick={() => picker.current?.click()}>{copy.import.chooseFile}</Button>
          {imported.length || patches.length ? <Button variant="quiet" onClick={() => { setImported([]); setPatches([]); setMessage({ error: false, text: copy.import.removed }); }}>{copy.import.remove}</Button> : null}
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
