import { Fragment } from 'react';
import { t } from '@/lib/content';
import { href, paths } from '@/lib/href';

const REPO_URL = 'https://github.com/klappe-pm/GABF-Analysis';

// The footer every page carries: where the data comes from, the estimate mark, the independence notice,
// the About and source links, and the Catalog.beer attribution its license asks for.
export function SiteFooter() {
  // One line of copy (global.site.footer.beer_details); its two names become links.
  const LINKS: Record<string, string> = { 'Catalog.beer': 'https://catalog.beer', 'CC BY 4.0': 'https://creativecommons.org/licenses/by/4.0/' };
  const parts = t('global.site.footer.beer_details').split(/(Catalog\.beer|CC BY 4\.0)/);
  return (
    <footer className="mt-12 bg-surface-container">
      <md-divider />
      <div className="type-body-small mx-auto flex max-w-(--app-page-max) flex-col gap-2 px-(--app-margin) py-6 text-on-surface-variant">
        <nav aria-label={t('global.navigation.footer.source')}>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            <li><a href={href(paths.method)} className="text-primary underline">{t('global.navigation.footer.method')}</a></li>
            <li><a href={href(paths.about)} className="text-primary underline">{t('global.navigation.footer.about')}</a></li>
            <li><a href={href(paths.saved)} className="text-primary underline">{t('global.navigation.footer.saved_views')}</a></li>
            <li><a href={REPO_URL} className="text-primary underline">{t('global.navigation.footer.source')}</a></li>
          </ul>
        </nav>
        <p className="max-w-measure">{t('global.site.footer.sources')} {t('global.site.footer.estimates')}</p>
        <p className="max-w-measure">{t('global.site.footer.independence')}</p>
        <p className="max-w-measure" data-attribution="catalog-beer">
          {parts.map((p, i) => (LINKS[p] ? <a key={i} href={LINKS[p]} className="text-primary underline">{p}</a> : <Fragment key={i}>{p}</Fragment>))}
        </p>
      </div>
    </footer>
  );
}
