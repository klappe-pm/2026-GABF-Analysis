'use client';

// The list of saved views: open, rename, delete, copy link. Views live in this browser's localStorage
// only. Before storage is read the list is empty; if the browser blocks storage the page says so.
import { type FormEvent, useRef, useState } from 'react';
import { Button } from '@/components/Button';
import { StateCard } from '@/components/StateCard';
import { TextLink } from '@/components/TextLink';
import { href } from '@/lib/href';
import { useSavedViews } from '@/lib/saved-views';
import { filterCount, MAX_NAME, type SavedView, viewLink } from '@/lib/saved-views-model.mjs';

export type SavedViewsCopy = {
  open: string; rename: string; delete: string; copyLink: string;
  linkCopied: string; linkFailed: string; renamed: string; deleted: string;
  renameSubmit: string; renameCancel: string; nameLabel: string;
  summaryMany: string; summaryOne: string; summaryNone: string; savedOn: string;
  openLabel: string; renameLabel: string; deleteLabel: string; copyLabel: string;
  emptyTitle: string; emptyBody: string; storageError: string;
};

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in values ? String(values[k]) : m));
const dateOf = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

export function SavedViews({ copy }: { copy: SavedViewsCopy }) {
  const { status, blocked, views, rename, remove } = useSavedViews();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [message, setMessage] = useState('');
  const renameButtons = useRef(new Map<string, HTMLElement>());

  const summary = (v: SavedView) => {
    const count = filterCount(v.hash);
    const template = count === 0 ? copy.summaryNone : count === 1 ? copy.summaryOne : copy.summaryMany;
    return fill(template, { count, page_title: v.title });
  };

  const startRename = (v: SavedView) => { setEditing(v.id); setDraft(v.name); setMessage(''); };
  const stopRename = (id: string) => {
    setEditing(null);
    requestAnimationFrame(() => renameButtons.current.get(id)?.focus());
  };
  const submitRename = (e: FormEvent, v: SavedView) => {
    e.preventDefault();
    if (draft.trim() && rename(v.id, draft)) setMessage(copy.renamed);
    stopRename(v.id);
  };
  const del = (v: SavedView) => {
    if (remove(v.id)) setMessage(copy.deleted);
    requestAnimationFrame(() => document.getElementById('saved-title')?.focus());
  };
  const copyLink = async (v: SavedView) => {
    try {
      await navigator.clipboard.writeText(viewLink(v, window.location.origin, BASE));
      setMessage(copy.linkCopied);
    } catch {
      setMessage(copy.linkFailed);
    }
  };

  return (
    <section className="flex flex-col gap-4">
      <p role="status" className="type-title-small text-on-surface">{message}</p>
      {status === 'pending' ? null : blocked ? (
        <StateCard kind="notice" title={copy.storageError} />
      ) : views.length === 0 ? (
        <StateCard kind="empty" title={copy.emptyTitle}>{copy.emptyBody}</StateCard>
      ) : (
        <ul className="flex flex-col gap-3">
          {views.map((v) => (
            <li key={v.id} className="flex flex-col gap-3 rounded-(--md-sys-shape-corner-medium) border border-outline-variant bg-surface p-4">
              {editing === v.id ? (
                <form onSubmit={(e) => submitRename(e, v)} className="flex flex-col gap-3" onKeyDown={(e) => { if (e.key === 'Escape') stopRename(v.id); }}>
                  <div className="flex flex-col gap-1">
                    <label htmlFor={`rename-${v.id}`} className="type-label-large text-on-surface-variant">{copy.nameLabel}</label>
                    <input
                      id={`rename-${v.id}`}
                      type="text"
                      autoFocus
                      value={draft}
                      maxLength={MAX_NAME}
                      autoComplete="off"
                      onChange={(e) => setDraft(e.target.value)}
                      className="type-body-large min-h-12 w-full max-w-measure rounded-(--md-sys-shape-corner-extra-small) border border-outline bg-surface px-4 text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="primary" type="submit">{copy.renameSubmit}</Button>
                    <Button variant="quiet" onClick={() => stopRename(v.id)}>{copy.renameCancel}</Button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex flex-col gap-1">
                    <h2 className="type-title-medium break-words text-on-surface">{v.name}</h2>
                    <p className="type-body-medium text-on-surface-variant">{summary(v)}</p>
                    {dateOf(v.saved) ? <p className="type-body-small text-on-surface-variant">{fill(copy.savedOn, { date: dateOf(v.saved) })}</p> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <TextLink href={href(v.path) + v.hash} aria-label={fill(copy.openLabel, { name: v.name })} className="type-label-large inline-flex min-h-10 items-center">{copy.open}</TextLink>
                    <span ref={(el) => { if (el) renameButtons.current.set(v.id, el.firstElementChild as HTMLElement); }}>
                      <Button variant="quiet" aria-label={fill(copy.renameLabel, { name: v.name })} onClick={() => startRename(v)}>{copy.rename}</Button>
                    </span>
                    <Button variant="quiet" aria-label={fill(copy.deleteLabel, { name: v.name })} onClick={() => del(v)}>{copy.delete}</Button>
                    <Button variant="quiet" aria-label={fill(copy.copyLabel, { name: v.name })} onClick={() => copyLink(v)}>{copy.copyLink}</Button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
