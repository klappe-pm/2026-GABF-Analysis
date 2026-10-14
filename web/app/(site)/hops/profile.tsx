// The hop profile of a beer page: the hops the beer used with their form, use, and farm, a card for each hop,
// the farms that grow those hops, and the beer's brewing details. Draws nothing for a beer with no hop profile.
import { type Column, DataTable } from '@/components/DataTable';
import { HopProfileCard } from '@/components/HopProfileCard';
import { SpecCard } from '@/components/SpecCard';
import { TextLink } from '@/components/TextLink';
import { fill, t } from '@/lib/content';
import { href, paths } from '@/lib/href';
import { beerHopProfile } from './data';
import { hopCardData, notDefined, raw, Sources } from './parts';

const copy = (key: string, values: Record<string, string | number> = {}) => t(`pages.beer-detail.hop_profile.${key}`, values);

export async function HopProfile({ stem }: { stem: string }) {
  const p = await beerHopProfile(stem);
  if (!p) return null;
  const none = notDefined();
  const columns: Column[] = [
    { key: 'hop', label: copy('hop'), sortable: true },
    { key: 'published', label: copy('published'), sortable: true },
    { key: 'form', label: copy('form') },
    { key: 'use', label: copy('use') },
    { key: 'farm', label: copy('farm') },
    { key: 'source', label: copy('source') },
  ];
  return (
    <section aria-labelledby="hop-profile-title" className="flex min-w-0 flex-col gap-6">
      <h2 id="hop-profile-title" className="type-headline-small text-on-surface">{copy('title')}</h2>
      {p.usage.length ? (
        <DataTable
          caption={copy('title')}
          sortHint={copy('sort_hint')}
          columns={columns}
          rows={p.usage.map((u, i) => ({
            key: `${u.hop.slug}-${i}`,
            sort: { hop: u.hop.name, published: u.published },
            cells: {
              hop: <TextLink href={href(paths.hop(u.hop.slug))}>{u.hop.name}</TextLink>,
              published: u.published,
              form: u.form ?? none,
              use: u.use ?? none,
              farm: u.farm ? (
                <>
                  <TextLink href={href(paths.hopFarm(u.farm.slug))}>{u.farm.name}</TextLink>
                  {' '}
                  <span className="type-label-medium text-on-surface-variant">{copy('named_label')}</span>
                </>
              ) : u.lotOrFarm ?? none,
              source: <Sources sources={u.source} />,
            },
          }))}
          scroll={false}
        />
      ) : <p className="type-body-medium text-on-surface-variant">{copy('missing')}</p>}

      {p.cards.length ? (
        <div className="flex flex-col gap-3">
          <h3 className="type-title-large text-on-surface">{t('pages.hop-detail.card.section')}</h3>
          <div className="grid grid-cols-1 gap-4 medium:grid-cols-2">
            {p.cards.map((c) => <HopProfileCard key={c.slug} data={hopCardData(c)} headingLevel={4} />)}
          </div>
        </div>
      ) : null}

      {p.grown.length ? (
        <div className="flex flex-col gap-3">
          <h3 className="type-title-large text-on-surface">{copy('grown_title')}</h3>
          <p className="type-body-medium max-w-measure text-on-surface-variant"><strong>{copy('grown_label')}</strong> {copy('grown_note')}</p>
          {p.grown.map((g) => (
            <details key={g.hop.slug} className="max-w-measure rounded-(--md-sys-shape-corner-medium) border border-outline-variant">
              <summary className="type-label-large cursor-pointer px-4 py-3 text-primary state-hover:bg-surface-container-low">{fill(raw('pages.beer-detail.hop_profile.grown_summary'), { hop: g.hop.name, count: g.farms.length })}</summary>
              <ul className="type-body-medium flex flex-col gap-1 px-4 pb-4">
                {g.farms.map((f) => (
                  <li key={f.slug}>
                    <TextLink href={href(paths.hopFarm(f.slug))}>{f.name}</TextLink>
                    {f.state ? <span className="text-on-surface-variant">{` ${f.state}`}</span> : null}
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      ) : null}

      {p.details.length ? (
        <SpecCard
          id="beer-details"
          title={copy('details_title')}
          headingLevel={3}
          rows={p.details.map((d) => ({
            label: copy(`detail_${d.key}`),
            value: (
              <>
                {d.value}
                <span className="type-body-small block text-on-surface-variant">{copy('source')} <Sources sources={d.source} /></span>
              </>
            ),
          }))}
        />
      ) : null}
    </section>
  );
}
