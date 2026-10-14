// The parts of a brewery page that do not follow the filter: its profile, ownership, distribution, estimated
// scale, other competitions, and deep dive. Every word is passed in from the copy documents.
import type { ReactNode } from 'react';
import { type Column, DataTable } from '@/components/DataTable';
import { EstimateTooltip } from '@/components/EstimateTooltip';
import { MedalMark, type MedalName } from '@/components/MedalMark';
import { SectionHeader } from '@/components/SectionHeader';
import { StatusChip } from '@/components/StatusChip';
import { TextLink } from '@/components/TextLink';
import { href, paths } from '@/lib/href';
import type { BreweryRecord } from '@/lib/models/breweries.mjs';
import { type EstimateCopy, explain, type Metric, markLabel } from '../estimate-text';
import { fillText, percent, usd, whole } from '../format';

type Copy = Record<string, Record<string, string>>;

const hostOf = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };
const mapLink = (l: BreweryRecord['locations'][number]) => (l.lat && l.lon
  ? `https://www.openstreetmap.org/?mlat=${l.lat}&mlon=${l.lon}#map=15/${l.lat}/${l.lon}`
  : `https://www.openstreetmap.org/search?query=${encodeURIComponent([l.address, l.city, l.state].filter(Boolean).join(', '))}`);

function DefList({ children, label }: { children: ReactNode; label: string }) {
  return <dl aria-label={label} className="grid min-w-0 grid-cols-1 gap-x-6 gap-y-3 medium:grid-cols-[minmax(10rem,14rem)_1fr]">{children}</dl>;
}
function Item({ term, children }: { term: string; children: ReactNode }) {
  return (
    <>
      <dt className="type-label-large text-on-surface-variant">{term}</dt>
      <dd className="type-body-large min-w-0 break-words text-on-surface">{children}</dd>
    </>
  );
}

export function Profile({ b, copy: c, estimate }: { b: BreweryRecord; copy: Copy; estimate: EstimateCopy }) {
  const nd = <span className="text-on-surface-variant">{c.gaps.not_defined}</span>;
  const est = b.estimate;
  const f = est.fin;
  const o = b.ownership;
  const yesNo = (v: boolean | null) => (v === null ? nd : c.yes_no[v ? 'yes' : 'no']);
  const mark = (id: string, metric: Metric) => (
    <EstimateTooltip id={`est-${b.slug}-${id}`} marker={c.est_state.marker} label={markLabel(metric, estimate)} explanation={explain(metric, est, estimate)} linkText={c.scale.method_link} />
  );
  const medalNames = c.medal as Record<MedalName, string>;
  const extLink = (url: string, text?: string) => <TextLink href={url} rel="noopener">{text ?? url.replace(/^https?:\/\//, '').replace(/\/$/, '')}</TextLink>;
  const socials = [['instagram', c.profile_extra.link_instagram], ['untappd', c.profile_extra.link_untappd], ['beeradvocate', c.profile_extra.link_beeradvocate]] as const;
  const socialItems = socials.filter(([k]) => b.links[k]);

  const otherColumns: Column[] = [
    { key: 'year', label: c.medalCols.year }, { key: 'competition', label: c.medalCols.competition }, { key: 'medal', label: c.medalCols.medal },
    { key: 'beer', label: c.medalCols.beer }, { key: 'city', label: c.medalCols.city }, { key: 'category', label: c.medalCols.category },
  ];

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="profile-title" className="flex flex-col gap-3">
        <SectionHeader id="profile-title" title={c.profile.title} />
        <DefList label={c.profile.title}>
          <Item term={c.profile.type}>{b.type ? c.brewery_type[b.type] ?? nd : nd}</Item>
          <Item term={c.profile.headquarters}>{b.hq.city || b.hq.state ? [b.hq.city, b.hq.state].filter(Boolean).join(', ') : nd}</Item>
          <Item term={c.profile.founded}>{b.founded ?? nd}</Item>
          <Item term={c.profile.employees}>{b.employees ? fillText(c.profile.employees_value, { count: whole(b.employees) }) : nd}</Item>
          <Item term={c.profile_extra.kitchen}>{yesNo(b.kitchen)}</Item>
          <Item term={c.profile.website}>{b.website ? extLink(b.website) : nd}</Item>
          <Item term={c.profile_extra.links}>
            {socialItems.length ? (
              <span className="inline-flex flex-wrap gap-x-4">
                {socialItems.map(([k, label]) => <TextLink key={k} href={b.links[k]!} rel="noopener">{label}</TextLink>)}
                {b.links.checked ? <span className="text-on-surface-variant">{fillText(c.profile_extra.links_checked, { date: b.links.checked })}</span> : null}
              </span>
            ) : nd}
          </Item>
          <Item term={c.profile.locations}>
            {b.locations.length ? (
              <ul className="flex flex-col gap-1">
                {b.locations.map((l, i) => {
                  const address = [l.address, l.city, l.state, l.postal].filter(Boolean).join(', ');
                  const extras = [l.opened ? fillText(c.profile.location_opened, { year: l.opened }) : '', l.kitchen ? c.profile.location_kitchen : ''].filter(Boolean).join(', ');
                  return (
                    <li key={`${l.name}-${address}-${i}`}>
                      {fillText(c.profile.location_line, { name: l.name ?? l.city ?? c.gaps.not_defined, address: address || c.gaps.not_defined })}
                      {extras ? ` (${extras})` : ''} <TextLink href={mapLink(l)} rel="noopener">{c.profile.location_map}</TextLink>
                    </li>
                  );
                })}
              </ul>
            ) : b.locationsCount === 1 ? c.profile.locations_missing_one : fillText(c.profile.locations_missing, { count: b.locationsCount })}
          </Item>
          <Item term={c.profile.known_for}>{b.knownFor.length ? b.knownFor.join('; ') : b.topFamilies.length ? <span className="text-on-surface-variant">{b.topFamilies.map((x) => c.style_family[x] ?? x).join(', ')}</span> : c.profile.known_for_missing}</Item>
        </DefList>
        <h3 className="type-title-large text-on-surface">{c.profile_extra.current_beers}</h3>
        {b.currentBeers.length ? b.currentBeers.map((g) => (
          <div key={`${g.source}-${g.asOf}`} className="flex flex-col gap-1">
            <p className="type-body-medium text-on-surface-variant">
              {fillText(c.profile_extra.current_beers_line.split('{{source}}')[0], { date: g.asOf })}
              <TextLink href={g.source} rel="noopener">{hostOf(g.source)}</TextLink>
              {c.profile_extra.current_beers_line.split('{{source}}')[1]}
            </p>
            <ul className="type-body-large">
              {g.beers.map((x) => {
                const detail = [x.style, x.abv ? fillText(c.profile_extra.abv_suffix, { abv: x.abv }) : ''].filter(Boolean).join(', ');
                return <li key={x.name}>{x.name}{detail ? ` ${fillText(c.profile_extra.current_beer_detail, { detail })}` : ''}</li>;
              })}
            </ul>
          </div>
        )) : <p className="type-body-large">{nd}</p>}
      </section>

      <section aria-labelledby="ownership-title" className="flex flex-col gap-3">
        <SectionHeader id="ownership-title" title={c.ownership.title} />
        {o ? (
          <DefList label={c.ownership.title}>
            <Item term={c.ownership.type}>{c.ownership_type[o.type] ?? nd}</Item>
            {o.parent ? <Item term={c.ownership.parent}>{o.parent}{o.parentType ? ` ${fillText(c.profile_extra.parent_type, { type: o.parentType })}` : ''}</Item> : null}
            {o.investor ? <Item term={c.ownership.investors}>{o.investor}</Item> : null}
            {o.stake ? <Item term={c.ownership.stake}>{o.dealYear ? fillText(c.ownership.stake_value, { stake: o.stake, year: o.dealYear }) : o.stake}</Item> : null}
            <Item term={c.ownership.ba_independent}>{o.baIndependent ? c.yes_no[o.baIndependent] ?? o.baIndependent : nd}</Item>
            <Item term={c.ownership.status}>{o.status ?? nd}</Item>
            <Item term={c.ownership.source}>{o.source ?? nd}{o.verified === 'no' ? <span className="block text-on-surface-variant">{c.ownership.unverified}</span> : null}</Item>
          </DefList>
        ) : (
          <>
            <p className="type-body-large">{c.ownership.missing}</p>
            <p className="type-body-medium text-on-surface-variant">{c.ownership.missing_note}</p>
          </>
        )}
      </section>

      <section aria-labelledby="distribution-title" className="flex flex-col gap-3">
        <SectionHeader id="distribution-title" title={c.distribution.title} />
        {b.distributors.length ? (
          <DefList label={c.distribution.title}>
            {b.distributors.map((d, i) => (
              <Item key={`${d.distributor}-${i}`} term={d.channel ? c.distribution_channel[d.channel] ?? c.distribution.channel_fallback : c.distribution.channel_fallback}>
                {[d.distributor, d.territory].filter(Boolean).join(', ')}{d.since ? ` (${fillText(c.distribution.since, { year: d.since })})` : ''}
                {d.verified === 'no' ? <> <StatusChip label={c.distribution.unverified_pill} /></> : null}
                {d.notes ? <span className="block text-on-surface-variant">{d.notes}</span> : null}
                {d.source ? <span className="block text-on-surface-variant">{fillText(c.distribution.source, { source: d.source })}</span> : null}
              </Item>
            ))}
          </DefList>
        ) : <p className="type-body-large">{b.channel ? c.distribution_channel[b.channel] ?? nd : nd}</p>}
      </section>

      <section aria-labelledby="scale-title" className="flex flex-col gap-3">
        <SectionHeader id="scale-title" title={c.scale.title} lead={est.assumed ? c.scale.assumed_note : undefined} />
        <DefList label={c.scale.title}>
          <Item term={c.scale.barrels}>
            {whole(est.barrels)}{' '}
            {est.basis === 'reported'
              ? <span className="text-on-surface-variant">({c.est_state.reported})</span>
              : <>{mark('barrels', 'barrels')} <span className="text-on-surface-variant">{fillText(c.scale.barrels_note, { basis: c.estimate_basis[est.basis] ?? est.basis, confidence: c.confidence[est.confidence ?? 'low'] ?? '' })}</span></>}
          </Item>
          <Item term={c.scale.equivalent}>{fillText(c.scale.equivalent_value, { gallons: whole(est.volume.gallons), cases: whole(est.volume.cases), cans: whole(est.volume.cans), packaged_share: percent(est.volume.packagedShare), pints: whole(est.volume.pints) })}</Item>
          <Item term={c.scale.revenue}>{usd(est.revenue.total)} {mark('arr', 'arr')} <span className="text-on-surface-variant">{fillText(c.scale.revenue_note, { low: usd(est.revenue.low), high: usd(est.revenue.high) })}</span></Item>
          <Item term={c.scale.gross_margin}>{percent(f.grossMargin)} {mark('gross-margin', 'gross_margin')} <span className="text-on-surface-variant">{fillText(c.scale.gross_margin_note, { gross_profit: usd(f.grossProfit) })}</span></Item>
          <Item term={c.scale.ebitda}>{fillText(c.scale.ebitda_value, { ebitda: usd(f.ebitda), margin: percent(f.ebitdaMargin) })} {mark('ebitda', 'ebitda')} <span className="text-on-surface-variant">{fillText(c.scale.ebitda_note, { margin_low: percent(f.ebitdaLowMargin), margin_high: percent(f.ebitdaHighMargin), low: usd(f.ebitdaLow), high: usd(f.ebitdaHigh) })}</span></Item>
          {f.perBarrel ? <Item term={c.scale.per_barrel}>{usd(f.perBarrel)} {mark('per-barrel', 'per_barrel')} <span className="text-on-surface-variant">{fillText(c.scale.per_barrel_note, { cogs: usd(f.cogsPerBarrel) })}</span></Item> : null}
          {f.perLocation ? <Item term={c.scale.per_location}>{usd(f.perLocation)} {mark('per-location', 'per_location')} <span className="text-on-surface-variant">{fillText(est.locations === 1 ? (est.kitchen ? c.scale.per_location_note_kitchen_one : c.scale.per_location_note_one) : est.kitchen ? c.scale.per_location_note_kitchen : c.scale.per_location_note, { count: est.locations })}</span></Item> : null}
          {f.perEmployee ? <Item term={c.scale.per_employee}>{usd(f.perEmployee)} {mark('per-employee', 'per_employee')}</Item> : null}
        </DefList>
        <p className="type-body-medium"><TextLink href={href(paths.about)}>{c.scale.method_link}</TextLink></p>
      </section>

      {b.otherMedals.length ? (
        <section aria-labelledby="other-title" className="flex flex-col gap-3">
          <SectionHeader id="other-title" title={c.other_competitions.title} lead={c.other_competitions.note} />
          <DataTable
            caption={fillText(c.tables.other_caption, { brewery_name: b.name })}
            columns={otherColumns}
            scroll={false}
            rows={b.otherMedals.map((m, i) => ({
              key: `${m.year}-${m.competition}-${m.beer}-${i}`,
              cells: {
                year: m.year,
                competition: c.competition[m.competition] ?? m.competition,
                medal: <span className="inline-flex items-center gap-2"><MedalMark medal={m.medal as MedalName} size="sm" title={medalNames[m.medal as MedalName]} />{medalNames[m.medal as MedalName] ?? m.medal}</span>,
                beer: m.beer,
                city: [m.city, m.state].filter(Boolean).join(', '),
                category: m.category,
              },
            }))}
          />
        </section>
      ) : null}

      <section aria-labelledby="deep-title" className="flex flex-col gap-3">
        <SectionHeader id="deep-title" title={c.deep_dive.title} />
        {b.deepDiveHtml ? <div className="prose min-w-0" dangerouslySetInnerHTML={{ __html: b.deepDiveHtml }} /> : <p className="type-body-large text-on-surface-variant">{c.deep_dive.missing}</p>}
      </section>
    </div>
  );
}
