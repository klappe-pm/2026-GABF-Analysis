'use client';

// Saves the page the visitor is on, with its filter state, under a name they choose. The view is the page
// path and the URL hash the global filter keeps; it is stored only in this browser (lib/saved-views).
import { usePathname } from 'next/navigation';
import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { TextLink } from '@/components/TextLink';
import { shape } from '@/design/helpers';
import { href, paths } from '@/lib/href';
import { useSavedViews } from '@/lib/saved-views';
import { browserStorage, canStore, MAX_NAME } from '@/lib/saved-views-model.mjs';

export type SaveViewCopy = {
  button: string;
  nameLabel: string;
  namePlaceholder: string;
  saved: string;
  submit: string;
  cancel: string;
  nameRequired: string;
  viewAll: string;
  storageError: string;
  titleSuffix: string;
};

// Pages that are not views of the medal record keep no save control.
const HIDDEN = [paths.method, paths.saved];

export function SaveViewControlClient({ copy }: { copy: SaveViewCopy }) {
  const raw = usePathname() ?? '/';
  const pathname = raw.endsWith('/') ? raw : `${raw}/`;
  const { add } = useSavedViews();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLElement>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [blocked, setBlocked] = useState(false);
  const [done, setDone] = useState(false);
  const ids = useId();

  useEffect(() => { setDone(false); }, [pathname]);

  if (HIDDEN.includes(pathname)) return null;

  const open = () => {
    setName('');
    setError('');
    setDone(false);
    setBlocked(!canStore(browserStorage()));
    dialog.current?.showModal();
  };
  const close = () => dialog.current?.close();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(copy.nameRequired);
      input.current?.focus();
      return;
    }
    const title = document.title.endsWith(copy.titleSuffix) ? document.title.slice(0, -copy.titleSuffix.length) : document.title;
    if (add({ name, path: pathname, hash: window.location.hash, title })) {
      setDone(true);
      close();
    } else {
      setBlocked(true);
    }
  };

  const field = 'type-body-large min-h-12 w-full rounded-(--md-sys-shape-corner-extra-small) border border-outline bg-surface px-4 text-on-surface placeholder:text-on-surface-variant focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

  return (
    // It sits in the header's action row, so it takes no page margin of its own and centers on the header's axis.
    // At phone width the button is the bookmark icon (its name stays the accessible label) so the site name keeps one line.
    <div className="flex items-center gap-x-3">
      <span ref={trigger} className="flex">
        <Button variant="quiet" aria-haspopup="dialog" aria-label={copy.button} onClick={open}>
          <span className="flex items-center medium:hidden"><Icon name="bookmark" /></span>
          <span className="hidden medium:inline">{copy.button}</span>
        </Button>
      </span>
      <p role="status" className="type-body-medium sr-only flex-wrap items-center gap-x-3 text-on-surface medium:not-sr-only medium:flex">
        {done ? <><span>{copy.saved}</span><TextLink href={href(paths.saved)}>{copy.viewAll}</TextLink></> : null}
      </p>
      <dialog
        ref={dialog}
        aria-labelledby={`${ids}-title`}
        onClose={() => trigger.current?.querySelector<HTMLElement>('md-text-button, md-outlined-button, md-filled-button, md-filled-tonal-button, md-elevated-button, button')?.focus()}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] bg-surface-container-high p-6 text-on-surface backdrop:bg-[color-mix(in_srgb,var(--md-sys-color-scrim)_32%,transparent)]"
        style={{ borderRadius: shape('extra large') }}
      >
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <h2 id={`${ids}-title`} className="type-title-large">{copy.button}</h2>
          {blocked ? (
            <p className="type-body-medium text-on-surface-variant">{copy.storageError}</p>
          ) : (
            <div className="flex flex-col gap-1">
              <label htmlFor={`${ids}-name`} className="type-label-large text-on-surface-variant">{copy.nameLabel}</label>
              <input
                ref={input}
                id={`${ids}-name`}
                type="text"
                value={name}
                maxLength={MAX_NAME}
                placeholder={copy.namePlaceholder}
                autoComplete="off"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${ids}-error` : undefined}
                onChange={(e) => { setName(e.target.value); setError(''); }}
                className={field}
              />
              {error ? <p id={`${ids}-error`} role="alert" className="type-body-small text-error">{error}</p> : null}
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="quiet" onClick={close}>{copy.cancel}</Button>
            {blocked ? null : <Button variant="primary" type="submit">{copy.submit}</Button>}
          </div>
        </form>
      </dialog>
    </div>
  );
}
