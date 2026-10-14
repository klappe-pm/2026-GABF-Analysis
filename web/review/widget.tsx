'use client';

// The review widget, for the web review build only (npm run web:review). It has one entry point, a Feedback
// button, and one docked panel the page reflows beside. While the panel is open each click on the page adds a
// numbered pin; a ticket may carry many pins, a note, categories, the design system components around the pins,
// and the journey step it belongs to. Send writes the ticket to docs/feedback/<page>/ through the review server,
// which also takes the screenshots. Page copy that the copy-key marking tagged can be edited in place.
// The public build swaps this file for widget-off.tsx (see next.config.ts), so none of it is published.
import './review.css';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDesign } from '@/design/runtime';
import { ReviewSettingsPanel } from '@/components/review/ReviewSettingsPanel';
import { api, type ComponentInfo, keyWords, type Recorded, ReviewError, type Step } from './api';
import { docRect, inLayer, scanMarks, type Spot, spotFor } from './dom';
import { InlineEditor } from './inline-editor';
import { copyPageFor } from './pages.mjs';

const LOCAL = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const routeOf = () => location.pathname.slice(BASE.length) || '/';
const excerpt = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

// Every word the widget shows comes from the copy documents (pages/review-mode.md and the Not Found label of
// global/labels.md). The site template reads them at build time and hands them over flat, by dotted key.
export type Copy = Record<string, string>;
const fill = (text: string, values: Record<string, string | number> = {}) => text.replace(/\{\{(\w+)\}\}/g, (m, name) => (name in values ? String(values[name]) : m));

export function WebReview({ copy }: { copy?: Copy }) {
  const [local, setLocal] = useState(false);
  useEffect(() => setLocal(LOCAL.has(location.hostname)), []);
  return local && copy ? <Widget copy={copy} /> : null;
}

function Widget({ copy }: { copy: Copy }) {
  const c = useCallback((key: string, values?: Record<string, string | number>) => {
    const text = copy[key];
    if (text === undefined) { console.error(`review copy key ${key} is missing`); return ''; }
    return fill(text, values);
  }, [copy]);
  const meta = useDesign().meta;
  const settingsCopy = useMemo(() => Object.fromEntries(Object.entries(copy).filter(([k]) => k.startsWith('settings.')).map(([k, v]) => [k.slice('settings.'.length), v])), [copy]);
  const title = (name: string) => meta[name]?.title ?? copy['not_found'];
  const kind = (tag: string) => copy[`elements.${tag}`] ?? c('elements.other');
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [cats, setCats] = useState<string[]>([]);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [added, setAdded] = useState<string[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[] | null>(null);
  const [lists, setLists] = useState<ComponentInfo[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [matched, setMatched] = useState<string[]>([]);
  const [step, setStep] = useState('');
  const [recorded, setRecorded] = useState<Recorded[]>([]);
  const [said, setSaid] = useState('');
  const [bad, setBad] = useState(false);
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState<{ element: HTMLElement; key: string; spot: Spot } | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [tick, setTick] = useState(0);
  const [add, setAdd] = useState('');
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spotsRef = useRef(spots);
  spotsRef.current = spots;
  const editingRef = useRef(editing);
  editingRef.current = editing;

  // The marking is read and taken out of the page whether or not the panel is open, so the page text is clean.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const run = () => { scanMarks(); setTick((t) => t + 1); };
    const soon = () => { if (timer) clearTimeout(timer); timer = setTimeout(run, 60); };
    const first = setTimeout(run, 400);
    const mo = new MutationObserver((records) => { if (records.some((r) => !inLayer(r.target))) soon(); });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener('resize', soon);
    window.addEventListener('load', soon);
    return () => { clearTimeout(first); if (timer) clearTimeout(timer); mo.disconnect(); window.removeEventListener('resize', soon); window.removeEventListener('load', soon); };
  }, []);

  // Open and close: the page reflows beside the panel, and picking turns on.
  useEffect(() => {
    document.documentElement.classList.toggle('gfw-open', open);
    document.documentElement.classList.toggle('gfw-picking', open);
    setTick((t) => t + 1);
    if (!open) { setHover(null); setEditing(null); return; }
    setTimeout(() => noteRef.current?.focus(), 0);
    if (!categories) api<{ categories: string[] }>('GET', '/review/categories').then((r) => setCategories([...r.categories].sort((a, b) => a.localeCompare(b, 'en')))).catch(() => setCategories([]));
    if (!lists.length) api<{ components: ComponentInfo[] }>('GET', '/review/lists').then((r) => setLists(r.components)).catch(() => undefined);
    api<{ matched: string[]; screens: Step[] }>('GET', `/review/web/screens?route=${encodeURIComponent(routeOf())}`).then((r) => {
      setSteps(r.screens);
      setMatched(r.matched);
      setStep((s) => s || r.matched[0] || '');
    }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const loadRecorded = useCallback(() => {
    if (!step) { setRecorded([]); return; }
    api<Recorded[]>('GET', `/review/feedback?step=${encodeURIComponent(step)}`).then((r) => setRecorded(r.slice(-6))).catch(() => undefined);
  }, [step]);
  useEffect(() => {
    if (!open) return undefined;
    loadRecorded();
    const t = setInterval(loadRecorded, 8000);
    return () => clearInterval(t);
  }, [open, loadRecorded]);

  // ---------- picking ----------
  const addSpot = useCallback((target: Element, point: { x: number; y: number }) => {
    const list = spotsRef.current;
    const spot = spotFor(target, point, list.length + 1);
    if (list.some((s) => s.selector === spot.selector && Math.abs(s.point.x - spot.point.x) < 3 && Math.abs(s.point.y - spot.point.y) < 3)) return;
    setSpots([...list, spot]);
    setSaid(c('messages.spot_added', { n: spot.n }));
    setBad(false);
    setTimeout(() => document.getElementById(`gfw-spot-${spot.n}`)?.scrollIntoView({ block: 'nearest' }), 0);
  }, [c]);

  const startEdit = useCallback((element: HTMLElement) => {
    const key = element.dataset.gfwKey;
    if (!key) return;
    setEditing({ element, key, spot: spotFor(element, null, 1) });
    setHover(null);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const picks = (e: Event) => e.isTrusted && !inLayer(e.target as Node) && !editingRef.current;
    const move = (e: PointerEvent) => { if (picks(e) && e.target instanceof Element) setHover(docRect(e.target)); };
    const down = (e: MouseEvent) => { if (picks(e)) e.preventDefault(); };
    // A double click on page copy edits it, so the pin its first click would add waits for the second click.
    const click = (e: MouseEvent) => {
      if (!picks(e) || !(e.target instanceof Element)) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const target = e.target;
      const keyed = target.closest<HTMLElement>('[data-gfw-key]');
      if (e.detail >= 2) {
        if (pending.current) clearTimeout(pending.current);
        pending.current = null;
        if (keyed) startEdit(keyed);
        else setSaid(target.closest('[data-gfw-multi]') ? c('messages.copy_multi') : c('messages.copy_none'));
        return;
      }
      const point = { x: e.pageX, y: e.pageY };
      if (!keyed) { addSpot(target, point); return; }
      if (pending.current) clearTimeout(pending.current);
      pending.current = setTimeout(() => { pending.current = null; addSpot(target, point); }, 260);
    };
    const key = (e: KeyboardEvent) => {
      const typing = e.target instanceof Element && /^(input|select|textarea)$/i.test(e.target.tagName);
      if (e.key === 'Escape') { if (editingRef.current) setEditing(null); else setOpen(false); return; }
      if (typing || inLayer(e.target as Node) || e.metaKey || e.ctrlKey || e.altKey) return;
      const node = document.activeElement;
      if (e.key === 'Enter' && node && node !== document.body) {
        e.preventDefault();
        e.stopPropagation();
        const keyed = (node as HTMLElement).closest<HTMLElement>('[data-gfw-key]');
        if (e.shiftKey || !keyed) addSpot(node, { x: docRect(node).x + docRect(node).width / 2, y: docRect(node).y + docRect(node).height / 2 });
        else startEdit(keyed);
      }
    };
    document.addEventListener('pointermove', move, true);
    document.addEventListener('mousedown', down, true);
    document.addEventListener('click', click, true);
    document.addEventListener('keydown', key, true);
    return () => {
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('mousedown', down, true);
      document.removeEventListener('click', click, true);
      document.removeEventListener('keydown', key, true);
    };
  }, [open, addSpot, startEdit, c]);

  // Shift and F opens and closes the panel from anywhere that is not a field.
  useEffect(() => {
    const toggle = (e: KeyboardEvent) => {
      const typing = e.target instanceof Element && /^(input|select|textarea)$/i.test(e.target.tagName);
      if (e.code === 'KeyF' && e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey && !typing) { e.preventDefault(); setOpen((o) => !o); }
    };
    document.addEventListener('keydown', toggle, true);
    return () => document.removeEventListener('keydown', toggle, true);
  }, []);

  // ---------- the ticket ----------
  const derived = useMemo(() => [...new Set(spots.flatMap((s) => s.components))], [spots]);
  const components = useMemo(() => [...new Set([...derived.filter((n) => !removed.includes(n)), ...added])], [derived, removed, added]);
  const keys = useMemo(() => [...new Set(spots.map((s) => s.key).filter((k): k is string => Boolean(k)))], [spots]);
  const info = (name: string) => lists.find((c) => c.name === name);

  const removeSpot = (spot: Spot) => {
    setSpots(spots.filter((s) => s !== spot).map((s, i) => ({ ...s, n: i + 1 })));
    setSaid(c('messages.spot_removed'));
    setBad(false);
  };
  const addComponent = () => {
    const name = lists.find((x) => x.name === add.trim() || title(x.name).toLowerCase() === add.trim().toLowerCase())?.name;
    if (!name) { setSaid(c('messages.component_unknown')); setBad(true); return; }
    if (!added.includes(name)) setAdded([...added, name]);
    setRemoved(removed.filter((n) => n !== name));
    setAdd('');
    setSaid('');
  };
  const dropComponent = (name: string) => {
    setAdded(added.filter((n) => n !== name));
    if (derived.includes(name)) setRemoved([...removed, name]);
  };

  const send = async () => {
    if (sending) return;
    if (!note.trim()) { setSaid(c('messages.note_required')); setBad(true); noteRef.current?.focus(); return; }
    if (!step) { setSaid(c('messages.step_required')); setBad(true); return; }
    setSending(true);
    setSaid(c('messages.sending'));
    setBad(false);
    try {
      const r = await api<{ id: string; redacted?: string[] }>('POST', '/review/feedback', {
        screen: step,
        route: routeOf(),
        hash: location.hash,
        served: 'web',
        text: note,
        categories: cats,
        spots: spots.map((s) => ({ n: s.n, selector: s.selector, rect: s.rect, text: s.text })),
        components: components.map((name) => ({ name })),
        contentKeys: keys,
        device: innerWidth < 600 ? 'phone' : innerWidth < 1024 ? 'tablet' : 'desktop',
        viewport: { width: innerWidth, height: innerHeight },
      });
      setNote('');
      setCats([]);
      setSpots([]);
      setAdded([]);
      setRemoved([]);
      setSaid(`${c('messages.registered', { id: r.id })}${r.redacted?.length ? ` ${c('messages.redacted')}` : ''}`);
      setTimeout(loadRecorded, 4000);
    } catch (e) {
      setBad(true);
      setSaid(c('messages.not_recorded', { reason: e instanceof ReviewError && e.problems[0] ? e.problems[0] : (e as Error).message }));
    } finally {
      setSending(false);
    }
  };

  // ---------- drawing ----------
  const pins = useMemo(() => {
    void tick;
    return spots.map((s) => {
      let node: Element | null = null;
      try { node = document.querySelector(s.selector); } catch { node = null; }
      let { x, y } = s.point;
      if (node) {
        const r = node.getBoundingClientRect();
        x = r.left + scrollX + Math.min(Math.max(s.offset.dx, 0), r.width);
        y = r.top + scrollY + Math.min(Math.max(s.offset.dy, 0), r.height);
      }
      return { n: s.n, x, y, detached: !node };
    });
  }, [spots, tick, open]);

  const nodes: ReactNode = (
    <div className="gfw-root">
      <div className="gfw-layer" aria-hidden="true">
        {open && hover ? <div className="gfw-hover" style={{ left: hover.x, top: hover.y, width: hover.width, height: hover.height }} /> : null}
        {open ? pins.map((p) => (
          <button key={p.n} type="button" className={`gfw-pin${p.detached ? ' detached' : ''}`} style={{ left: p.x, top: p.y }} aria-label={c('panel.spot_pin_aria', { n: p.n })} onClick={(e) => { e.stopPropagation(); document.getElementById(`gfw-spot-${p.n}`)?.scrollIntoView({ block: 'nearest' }); }}>{p.n}</button>
        )) : null}
      </div>
      {!open ? <button type="button" className="gfw-entry" aria-expanded="false" aria-controls="gfw-panel" onClick={() => setOpen(true)}>{c('panel.entry')}</button> : null}
      {open ? (
        <aside id="gfw-panel" className="gfw-panel" aria-label={c('panel.title')}>
          <div className="gfw-head">
            <h2>{c('panel.title')}</h2>
            <button type="button" className="gfw-btn" onClick={() => setOpen(false)}>{c('panel.close')}</button>
          </div>
          <div className="gfw-scroll">
            <div className="gfw-field">
              <label htmlFor="gfw-note">{c('panel.note_label')}</label>
              <textarea id="gfw-note" ref={noteRef} rows={4} placeholder={c('panel.note_placeholder')} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div className="gfw-field">
              <label htmlFor="gfw-step">{c('panel.step_label')}</label>
              <select id="gfw-step" value={step} onChange={(e) => setStep(e.target.value)}>
                <option value="">{matched.length ? c('panel.step_choose') : c('panel.step_none')}</option>
                {matched.length ? <optgroup label={c('panel.step_group_page')}>{steps.filter((s) => matched.includes(s.id)).map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</optgroup> : null}
                <optgroup label={c('panel.step_group_all')}>{steps.filter((s) => !matched.includes(s.id)).map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</optgroup>
              </select>
            </div>
            <div className="gfw-field">
              <h3 id="gfw-spots-head">{c('panel.spots_heading')}</h3>
              <p className="gfw-hint">{c('panel.spots_hint')}</p>
              <ol className="gfw-spots" aria-labelledby="gfw-spots-head">
                {spots.map((s) => (
                  <li key={s.id} id={`gfw-spot-${s.n}`} className="gfw-spot">
                    <span className="gfw-n" aria-hidden="true">{s.n}</span>
                    <button type="button" className="gfw-spot-label" aria-label={c('panel.spot_show', { n: s.n })} onClick={() => { try { document.querySelector(s.selector)?.scrollIntoView({ block: 'center' }); } catch { /* the page changed */ } }}>
                      {s.text ? `\u201c${excerpt(s.text, 90)}\u201d` : kind(s.tag)}
                      <small>{s.text ? kind(s.tag) : copy['not_found']}</small>
                    </button>
                    <button type="button" className="gfw-btn small" aria-label={c('panel.spot_remove_aria', { n: s.n })} onClick={() => removeSpot(s)}>{c('panel.spot_remove')}</button>
                  </li>
                ))}
              </ol>
              {spots.length ? null : <p className="gfw-empty">{c('panel.spots_empty')}</p>}
            </div>
            <fieldset className="gfw-field">
              <legend>{c('panel.categories_heading')}</legend>
              <div className="gfw-cats">
                {(categories ?? []).map((c) => (
                  <label key={c} className="gfw-check">
                    <input type="checkbox" checked={cats.includes(c)} onChange={(e) => setCats(e.target.checked ? [...cats, c] : cats.filter((x) => x !== c))} />
                    {c}
                  </label>
                ))}
                {categories && !categories.length ? <p className="gfw-hint">{c('panel.categories_unavailable')}</p> : null}
              </div>
            </fieldset>
            <div className="gfw-field">
              <label htmlFor="gfw-comp-add">{c('panel.components_heading')}</label>
              {components.length ? (
                <ul className="gfw-tags" aria-label={c('panel.components_label')}>
                  {components.map((name) => {
                    const ci = info(name);
                    return (
                      <li key={name} className="gfw-tag">
                        {ci?.spec && ci.view ? (
                          <>
                            <a href={ci.view} target="_blank" rel="noopener" aria-label={c('panel.component_open_aria', { name: title(name) })}>{title(name)}</a>
                            <a className="gfw-obsidian" href={ci.obsidian}>{c('panel.component_obsidian')}<span className="gfw-sr">: {title(name)}</span></a>
                          </>
                        ) : (
                          <><span>{title(name)}</span><small>{copy['not_found']}</small></>
                        )}
                        <button type="button" aria-label={c('panel.component_remove_aria', { name: title(name) })} onClick={() => dropComponent(name)}>{'×'}</button>
                      </li>
                    );
                  })}
                </ul>
              ) : <p className="gfw-hint">{c('panel.components_none')}</p>}
              <div className="gfw-add">
                <input id="gfw-comp-add" type="text" list="gfw-comp-list" autoComplete="off" placeholder={c('panel.component_add_placeholder')} value={add} onChange={(e) => setAdd(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addComponent(); } }} />
                <datalist id="gfw-comp-list">{lists.map((x) => <option key={x.name} value={title(x.name)} />)}</datalist>
                <button type="button" className="gfw-btn" onClick={addComponent}>{c('panel.component_add')}</button>
              </div>
            </div>
            <div className="gfw-field gfw-settings">
              <ReviewSettingsPanel page={copyPageFor(routeOf())} inline copy={settingsCopy} />
            </div>
            {keys.length ? (
              <div className="gfw-field">
                <h3>{c('panel.content_heading')}</h3>
                <ul className="gfw-tags" aria-label={c('panel.content_label')}>{keys.map((k) => <li key={k} className="gfw-tag"><span>{keyWords(k)}</span></li>)}</ul>
              </div>
            ) : null}
            <div className="gfw-field">
              <h3>{c('panel.recorded_heading')}</h3>
              <ul className="gfw-recorded">
                {recorded.length ? recorded.map((t) => (
                  <li key={t.id}>
                    {c('panel.recorded_item', { id: t.id, status: t.status.toLowerCase(), title: excerpt(t.title, 70) })}
                    {t.pipeline ? <> <strong>{t.pipeline.label}</strong></> : null}
                    {(t.images ?? []).map((img) => <span key={img.url}> <a href={img.url} target="_blank" rel="noopener">{img.kind === 'page' ? c('panel.image_page') : c('panel.image_spot', { n: img.spot ?? 0 })}</a></span>)}
                  </li>
                )) : <li>{c('panel.recorded_none')}</li>}
              </ul>
            </div>
          </div>
          <div className="gfw-foot">
            <span className={`gfw-said${bad ? ' bad' : ''}`} role="status" aria-live="polite">{said}</span>
            <button type="button" className="gfw-send" onClick={() => void send()} disabled={sending}>{c('panel.send')}</button>
          </div>
        </aside>
      ) : null}
      {open && editing ? <InlineEditor c={c} element={editing.element} copyKey={editing.key} step={step} spot={editing.spot} onClose={() => setEditing(null)} onSaved={(id) => { setSaid(c('messages.edited', { id })); setBad(false); }} /> : null}
    </div>
  );
  return createPortal(nodes, document.body);
}
