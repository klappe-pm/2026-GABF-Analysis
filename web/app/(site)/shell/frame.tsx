// The site frame as the server builds it: every word from the copy documents, then the client shell.
// The site layout wraps every page in it, and the 404 page uses it directly.
import type { ReactNode } from 'react';
import { fill, group, lookup, t } from '@/lib/content';
import { fmt } from '@/lib/data';
import { href, paths } from '@/lib/href';
import { counts, WINNER_YEAR } from '@/lib/site-data';
import { type Destination, moreDestinations, primaryDestinations } from './destinations.mjs';
import { type ShellConfig, type ShellItem, SiteShell } from './SiteShell';

const raw = (key: string) => lookup(key) as string;
const nav = (key: string) => t(`global.navigation.header.${key}`);
const item = (d: Destination): ShellItem => ({ id: d.id, text: nav(d.copy), icon: d.icon, path: d.path, href: href(d.path), match: d.match });

// Values the copy's label dictionary names, by filter dimension.
const LABELLED = ['medal', 'category_type', 'style_family', 'abv_band', 'region', 'ownership_type', 'distribution_channel', 'brewery_type'];


export async function shellConfig(): Promise<ShellConfig> {
  const c = await counts();
  const partialYears = Object.entries(c.coverage).filter(([, s]) => s === 'partial').map(([y]) => Number(y)).sort();
  const f = (key: string) => t(`global.filters.${key}`);
  return {
    brand: t('global.site.identity.name'),
    navLabel: t('global.site.header.nav_label'),
    menuLabel: t('global.site.header.menu_button'),
    skipLabel: t('global.site.header.skip_link'),
    // The destinations of layout.md "Site navigation" (destinations.mjs); each owns the sections in its match.
    nav: primaryDestinations(paths, WINNER_YEAR).map(item),
    // Further sections the drawer lists under the destinations.
    more: moreDestinations(paths).map(item),
    filters: {
      trigger: f('trigger.label'),
      triggerWithCount: raw('global.filters.trigger.label_with_count'),
      accessibleWithCount: raw('global.filters.trigger.accessible_label_with_count'),
      dialog: {
        title: f('panel.title'),
        close: f('panel.close'),
        reset: f('panel.reset'),
        apply: f('panel.apply'),
        searchLabel: f('search.label'),
        searchPlaceholder: f('search.placeholder'),
        partialLabel: partialYears.length ? fill(raw('global.filters.partial_years.include'), { years: fmt.years(partialYears) }) : f('chips.partial_chip'),
        partialNote: f('partial_years.default_note'),
      },
      groups: group('global.filters.groups'),
      dimensions: group('global.filters.dimensions'),
      labels: Object.fromEntries(LABELLED.map((id) => [id, group(`global.labels.${id}`)])),
      all: f('options.all'),
      withCount: raw('global.filters.options.with_count'),
      matchOne: f('panel.match_count_one'),
      matchMany: raw('global.filters.panel.match_count_many'),
      loading: f('panel.loading'),
      loadError: f('panel.load_error'),
      chips: {
        bar: f('chips.bar_label'),
        chip: raw('global.filters.chips.chip'),
        search: raw('global.filters.chips.search_chip'),
        partial: f('chips.partial_chip'),
        fixedTooltip: f('chips.fixed_tooltip'),
        remove: raw('global.filters.chips.remove_label'),
        clear: f('chips.clear_all'),
      },
    },
  };
}

export async function SiteFrame({ children }: { children: ReactNode }) {
  return <SiteShell config={await shellConfig()}>{children}</SiteShell>;
}
