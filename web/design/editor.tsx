'use client';

// Review mode only (npm run design-system:review): edit a design setting in place on the style guide.
// A change shows at once across the page; Save sends it to the local review server, which checks it
// (allowed values, approved fonts, WCAG AA contrast), writes only that key to the settings file or the
// component's spec, and records an ACCEPTED ticket. A refused value comes back with a plain reason.
// The public build swaps this file for editor-off.tsx (see next.config.ts).
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { usePreview } from './runtime';
import { COMPONENTS, globalKind, type Kind, showValue, type Value } from './schema';

export const REVIEW = true;

const ENDPOINT = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/__design/edit`;

const kindOf = (target: string, k: string): Kind | undefined => (target === 'settings' ? globalKind(k) : COMPONENTS[target]?.[k]);

function Field({ kind, value, onValue, label }: { kind: Kind; value: Value; onValue: (v: Value) => void; label: string }) {
  const ref = useRef<HTMLElement & { value: string }>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const on = () => {
      const raw = el.value;
      if (kind.type === 'number') { if (raw !== '' && Number.isFinite(Number(raw))) onValue(Number(raw)); return; }
      if (kind.type === 'list') { onValue(raw.split(',').map((s) => s.trim()).filter(Boolean)); return; }
      onValue(raw);
    };
    el.addEventListener('input', on);
    el.addEventListener('change', on);
    return () => { el.removeEventListener('input', on); el.removeEventListener('change', on); };
  }, [kind, onValue]);
  if (kind.type === 'hex') {
    return (
      <span className="inline-flex items-center gap-2">
        <input ref={ref as never} type="color" aria-label={label} defaultValue={String(value)} className="h-10 w-14 cursor-pointer rounded-(--md-sys-shape-corner-small) border border-outline" />
        <span className="type-body-medium tabular-nums">{String(value).toUpperCase()}</span>
      </span>
    );
  }
  if (kind.type === 'enum' || (kind.type === 'number' && kind.values.length <= 12)) {
    return (
      <md-outlined-select ref={ref} label={label} value={String(value)}>
        {kind.values.map((v) => (
          <md-select-option key={String(v)} value={String(v)} selected={String(v) === String(value) || undefined}><div slot="headline">{String(v)}</div></md-select-option>
        ))}
      </md-outlined-select>
    );
  }
  return <md-outlined-text-field ref={ref} label={label} type={kind.type === 'number' ? 'number' : 'text'} value={showValue(value)} />;
}

export function EditableValue({ target, k, value, children }: { target: string; k: string; value: Value; children: ReactNode }) {
  const preview = usePreview();
  const kind = kindOf(target, k);
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<Value>(value);
  const [draft, setDraft] = useState<Value>(value);
  const [problems, setProblems] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  // The saved value follows the page's settings (built, then loaded) while no edit is open.
  useEffect(() => { if (!open) setSaved(value); }, [value, open]);
  if (!kind) return <>{children}</>;

  const change = (v: Value) => { setDraft(v); setProblems([]); preview(target, k, v); };
  const cancel = () => { preview(target, k, saved); setDraft(saved); setProblems([]); setOpen(false); };
  const save = async () => {
    setBusy(true);
    try {
      const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ target, key: k, value: draft }) });
      const body = await res.json();
      if (!res.ok) { setProblems(body.problems ?? ['The value was not saved.']); return; }
      setSaved(draft);
      setOpen(false);
      setNote(`Saved to ${body.file}${body.ticket ? `, ticket ${body.ticket.id}` : ''}`);
    } catch {
      setProblems(['The review server did not answer. Start it with npm run design-system:review.']);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2" data-design-editor="">
        {children}
        <md-text-button onClick={() => { setDraft(saved); setOpen(true); setNote(''); }} aria-label={`Change ${k}`}>Change</md-text-button>
        {note ? <span role="status" className="type-body-small text-on-surface-variant">{note}</span> : null}
      </span>
    );
  }
  return (
    <span className="inline-flex flex-col gap-2 rounded-(--md-sys-shape-corner-medium) bg-surface-container-high p-3" data-design-editor="open">
      <Field kind={kind} value={draft} onValue={change} label={k} />
      {problems.length ? <span role="alert" className="type-body-small max-w-measure text-error">{problems.join(' ')}</span> : null}
      <span className="flex gap-2">
        <md-filled-button onClick={save} disabled={busy || undefined}>Save</md-filled-button>
        <md-text-button onClick={cancel}>Cancel</md-text-button>
      </span>
    </span>
  );
}
