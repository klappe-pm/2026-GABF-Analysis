'use client';

// Edit one line of page copy where it is drawn. The editor opens over an element the copy-key marking tagged
// (data-gfw-key); the key names the copy entry, so nothing is guessed from the words on the page. The review
// server checks the new words against the copy rules, writes only that entry, lists the other places that
// hold the same words, records an ACCEPTED ticket, and rebuilds; the page then reloads on the new copy.
import { useEffect, useRef, useState } from 'react';
import { api, keyWords, type Preview, ReviewError } from './api';
import { docRect, type Spot } from './dom';

type Props = {
  element: HTMLElement;
  copyKey: string;
  step: string;
  spot: Spot;
  onClose: () => void;
  onSaved: (id: string) => void;
};

export function InlineEditor({ element, copyKey, step, spot, onClose, onSaved }: Props) {
  const [value, setValue] = useState('');
  const [old, setOld] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [take, setTake] = useState<Record<string, boolean>>({});
  const [said, setSaid] = useState('');
  const [bad, setBad] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const box = docRect(element);
  const style = getComputedStyle(element);

  useEffect(() => {
    let live = true;
    api<Preview>('POST', '/review/content', { key: copyKey }).then((p) => {
      if (!live) return;
      setOld(p.old ?? '');
      setValue(p.old ?? '');
      setPreview(p);
      setTake(Object.fromEntries(p.instances.map((i) => [i.id, true])));
    }).catch((e: Error) => { if (live) { setSaid(e.message); setBad(true); } });
    return () => { live = false; };
  }, [copyKey]);

  // Once the current words are in, the field is ready to type in.
  useEffect(() => {
    if (old === null) return;
    input.current?.focus();
    input.current?.select();
  }, [old]);

  // Check the new words as they are typed, after a short pause.
  useEffect(() => {
    if (old === null || value === old) return undefined;
    const t = setTimeout(() => {
      api<Preview>('POST', '/review/content', { key: copyKey, newValue: value }).then((p) => {
        setPreview(p);
        setSaid(p.problems[0] ?? '');
        setBad(p.problems.length > 0);
      }).catch(() => undefined);
    }, 250);
    return () => clearTimeout(t);
  }, [value, old, copyKey]);

  const changed = old !== null && value !== old;
  const save = async () => {
    if (busy) return;
    if (!changed) { setSaid('Nothing changed.'); setBad(false); return; }
    setBusy(true);
    setBad(false);
    setSaid('Saving and rebuilding the page. This takes a few seconds.');
    try {
      const r = await api<{ id: string; rebuilt: boolean }>('POST', '/review/inline/save', {
        screen: step,
        route: location.pathname.replace(process.env.NEXT_PUBLIC_BASE_PATH ?? '', '') || '/',
        hash: location.hash,
        served: 'web',
        key: copyKey,
        newValue: value,
        take: Object.keys(take).filter((k) => take[k]),
        spot: { selector: spot.selector, rect: spot.rect, text: spot.text },
        device: innerWidth < 600 ? 'phone' : innerWidth < 1024 ? 'tablet' : 'desktop',
        viewport: { width: innerWidth, height: innerHeight },
      });
      onSaved(r.id);
      if (r.rebuilt) { setSaid(`Saved as ${r.id}. Reloading the page.`); setTimeout(() => location.reload(), 150); } else { setSaid(`Saved as ${r.id}, but the page could not be rebuilt. Run npm run web:review again to see it.`); setBad(true); setBusy(false); }
    } catch (e) {
      setBusy(false);
      setBad(true);
      setSaid(e instanceof ReviewError && e.problems[0] ? e.problems[0] : (e as Error).message);
    }
  };

  const others = preview?.instances ?? [];
  return (
    <div
      className="gfw-editor"
      role="group"
      aria-label="Edit this text"
      style={{ left: Math.max(4, box.x), top: box.y + box.height + 6, width: Math.min(Math.max(box.width + 16, 280), 520) }}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}
    >
      <p className="gfw-editor-key">{keyWords(copyKey)}</p>
      <input
        ref={input}
        className="gfw-editor-input"
        type="text"
        aria-label="New text"
        value={value}
        placeholder={old === null ? 'Loading the current text' : undefined}
        disabled={busy || old === null}
        style={{ font: style.font, letterSpacing: style.letterSpacing }}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void save(); } }}
      />
      {/\{\{/.test(value) ? <p className="gfw-editor-msg">Words in double braces are filled in by the page.</p> : null}
      {said ? <p role="alert" className={`gfw-editor-msg${bad ? ' bad' : ''}`}>{said}</p> : null}
      {others.length ? (
        <div className="gfw-editor-related">
          <p>The same words also appear in {others.length} other place{others.length === 1 ? '' : 's'}. Checked ones change too.</p>
          <ul>
            {others.map((i) => (
              <li key={i.id}>
                <label>
                  <input type="checkbox" checked={take[i.id] !== false} onChange={(e) => setTake({ ...take, [i.id]: e.target.checked })} />
                  {i.kind === 'copy' ? `Copy entry: ${keyWords(i.key ?? '')}` : `Page code: ${i.file.split('/').pop()}, line ${i.line}`}
                </label>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="gfw-editor-bar">
        <button type="button" className="gfw-send" onClick={() => void save()} disabled={busy || bad}>Save</button>
        <button type="button" className="gfw-btn" onClick={onClose} disabled={busy}>Cancel</button>
      </div>
    </div>
  );
}
