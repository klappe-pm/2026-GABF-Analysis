// Explore at /analysis/explore/: the standalone explorer's unique features inside the site. Every award in a
// searchable table, awards added from a CSV in the browser, and the extra filters. /explorer/ forwards here.
import type { Metadata } from 'next';
import { Breadcrumb } from '@/components/Breadcrumb';
import { TextLink } from '@/components/TextLink';
import { t } from '@/lib/content';
import { href } from '@/lib/href';
import { pageMetadata } from '@/lib/seo';
import { analysis, firstComplete, labelGroup, MAIN, viewCopy } from '../parts/copy';
import { analysisPaths } from '../parts/paths';
import { ExploreView, type ExploreCopy } from './ExploreView';

const page = (key: string) => `pages.explore.${key}`;
const prefixed = (path: string, keys: string[]) => Object.fromEntries(keys.map((k) => [k, t(`${path}.${k}`)]));

export function generateMetadata(): Metadata {
  return pageMetadata({ title: t(page('header.title')), description: t(page('header.lede')), path: analysisPaths.explore });
}

export default async function ExplorePage() {
  const model = await analysis();
  const copy: ExploreCopy = {
    view: viewCopy(),
    search: { label: t(page('search.label')), placeholder: t(page('search.placeholder')), hint: t(page('search.hint')) },
    filters: {
      title: t(page('filters.title')), reset: t(page('filters.reset')), section: t(page('filters.section')), sectionAll: t(page('filters.section_all')), investors: t(page('filters.investors')), investorsPlaceholder: t(page('filters.investors_placeholder')), trait: t(page('filters.trait')), traitAll: t(page('filters.trait_all')),
      sections: prefixed(page('filters.sections'), ['main', 'pro-am', 'collaboration']),
      traits: prefixed(page('filters.traits'), Object.keys(model.TRAITS)),
    },
    table: {
      title: t(page('table.title')), count: t(page('table.count'), { count: '{{count}}', total: '{{total}}' }), sortHint: t(page('table.sort_hint')), imported: t(page('table.imported')), importedCount: t(page('table.imported_count'), { count: '{{count}}' }),
      columns: prefixed(page('table.columns'), ['year', 'medal', 'beer', 'brewery', 'city', 'category', 'family', 'owner']) as ExploreCopy['table']['columns'],
    },
    import: {
      title: t(page('import.title')), privacy: t(page('import.privacy')), help: t(page('import.help')), chooseFile: t(page('import.choose_file')), result: t(page('import.result'), { added: '{{added}}', skipped: '{{skipped}}' }), remove: t(page('import.remove')), removed: t(page('import.removed')), reading: t(page('import.reading')),
      errors: Object.fromEntries(['unclosed_quote', 'no_rows', 'duplicate_columns', 'field_count', 'missing_column', 'blank_required', 'bad_medal', 'bad_year', 'too_many_rows', 'too_large'].map((k) => [k, t(page(`import.errors.${k}`), { row: '{{row}}', count: '{{count}}', expected: '{{expected}}', column: '{{column}}' })])),
    },
    links: { savedViews: t(page('links.saved_views')) },
    empty: { awards: t(page('empty.awards')), hint: t(page('empty.awards_hint')) },
    families: labelGroup('style_family'),
    ownership: labelGroup('ownership_type'),
    savedViewsHref: href(analysisPaths.savedViews),
  };
  return (
    <main id="main" tabIndex={-1} className={MAIN}>
      <header className="flex flex-col gap-3">
        <Breadcrumb label={t('global.navigation.breadcrumbs.all_analysis')} items={[{ href: href(analysisPaths.index), text: t(page('links.back')) }, { text: t(page('header.title')) }]} />
        <h1 className="type-display-small text-on-surface">{t(page('header.title'))}</h1>
        <p className="type-body-large max-w-measure text-on-surface-variant">{t(page('header.lede'))}</p>
        <p className="type-body-large"><TextLink href={copy.savedViewsHref}>{copy.links.savedViews}</TextLink></p>
      </header>
      <ExploreView rows={model.exploreRows()} copy={copy} firstCompleteYear={await firstComplete()} />
    </main>
  );
}
