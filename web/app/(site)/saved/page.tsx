// Saved views at /saved/: the pages and filters a visitor saved, kept only in this browser. The server
// part draws the heading from the copy and hands every word to the client list, which reads storage.
import type { Metadata } from 'next';
import { lookup, t } from '@/lib/content';
import { paths } from '@/lib/href';
import { pageMetadata } from '@/lib/seo';
import { SavedViews, type SavedViewsCopy } from './SavedViews';

// The copy as written: the client list fills {{count}}, {{name}} and the other tokens for each view.
const page = (key: string) => lookup(`pages.saved-views.${key}`) as string;

export function generateMetadata(): Metadata {
  return pageMetadata({
    title: t('global.navigation.page_titles.saved_views'),
    description: t('global.navigation.page_descriptions.saved_views'),
    path: paths.saved,
  });
}

export default function SavedPage() {
  const copy: SavedViewsCopy = {
    open: page('item.open'),
    rename: page('item.rename'),
    delete: page('item.delete'),
    copyLink: page('item.copy_link'),
    linkCopied: page('item.link_copied'),
    linkFailed: page('item.link_failed'),
    renamed: page('item.renamed'),
    deleted: page('item.deleted'),
    renameSubmit: page('item.rename_submit'),
    renameCancel: page('item.rename_cancel'),
    nameLabel: page('save.name_label'),
    summaryMany: page('item.filters_summary'),
    summaryOne: page('item.filters_summary_one'),
    summaryNone: page('item.filters_summary_none'),
    savedOn: page('item.saved_on'),
    openLabel: page('item.open_label'),
    renameLabel: page('item.rename_label'),
    deleteLabel: page('item.delete_label'),
    copyLabel: page('item.copy_label'),
    emptyTitle: page('empty.title'),
    emptyBody: page('empty.body'),
    storageError: page('storage_error.body'),
  };
  return (
    <main id="main" tabIndex={-1} className="mx-auto flex max-w-(--app-page-max) flex-col gap-6 px-(--app-margin) py-8">
      <header className="flex flex-col gap-3">
        <h1 id="saved-title" tabIndex={-1} className="type-display-small text-on-surface">{t('pages.saved-views.header.title')}</h1>
        <p className="type-body-large max-w-measure text-on-surface-variant">{t('pages.saved-views.header.lede')}</p>
      </header>
      <SavedViews copy={copy} />
    </main>
  );
}
