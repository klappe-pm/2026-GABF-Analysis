// Copy the category and analysis pages share, read on the server and passed to the client views as plain strings.
import { group, lookup, t } from '@/lib/content';
import { laneModel } from '@/lib/site-data';
import type * as Analysis from '@/lib/models/analysis.mjs';
import type { ViewCopy } from './kit';

export const raw = (key: string) => lookup(key) as string;
export const analysis = () => laneModel<typeof Analysis>('analysis');

export const MAIN = 'mx-auto flex max-w-(--app-page-max) flex-col gap-6 px-(--app-margin) py-8';

export const viewCopy = (): ViewCopy => ({
  noResultsTitle: t('global.states.no_results.title'),
  removeHint: t('global.states.no_results.remove_hint'),
  emptyScope: t('global.states.empty_scope.page'),
  partialOne: raw('global.states.partial_notice.one'),
  partialMany: raw('global.states.partial_notice.many'),
  notDefined: t('global.labels.not_found'),
  medals: group('global.labels.medal'),
});

export const labelGroup = (name: string) => group(`global.labels.${name}`);

// The first year with a complete official list, for the partial years notice.
export const firstComplete = async () => {
  const meta = (await analysis()).reportMeta();
  return meta.years.find((y) => meta.coverage[y] === 'complete') ?? null;
};
