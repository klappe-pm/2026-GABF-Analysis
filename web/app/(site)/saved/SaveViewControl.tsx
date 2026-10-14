// The "Save this view" control of the site frame. The server part reads every word from the copy
// documents; the client part (SaveViewControlClient) does the saving. Mount it once in the shell,
// in the shell frame (web/app/(site)/shell/frame.tsx), so every filterable page carries it.
import { t } from '@/lib/content';
import { SaveViewControlClient, type SaveViewCopy } from './SaveViewControlClient';

export function SaveViewControl() {
  const page = (key: string) => t(`pages.saved-views.${key}`);
  const copy: SaveViewCopy = {
    button: page('save.button'),
    nameLabel: page('save.name_label'),
    namePlaceholder: page('save.name_placeholder'),
    saved: page('save.saved'),
    submit: page('save.submit'),
    cancel: page('save.cancel'),
    nameRequired: page('save.name_required'),
    viewAll: page('save.view_all'),
    storageError: page('storage_error.body'),
    titleSuffix: t('global.navigation.page_titles.suffix'),
  };
  return <SaveViewControlClient copy={copy} />;
}
