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
import { api, type ComponentInfo, keyWords, type Recorded, ReviewError, type Step, words } from './api';
import { docRect, inLayer, scanMarks, type Spot, spotFor } from './dom';
import { InlineEditor } from './inline-editor';

const LOCAL = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const routeOf = () => location.pathname.slice(BASE.length) || '/';
const excerpt = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const TAGS: Record<string, string> = { h1: 'heading', h2: 'heading', h3: 'heading', h4: 'heading', a: 'link', button: 'button', p: 'paragraph', table: 'table', th: 'column heading', td: 'table cell', tr: 'table row', figure: 'chart', canvas: 'chart', svg: 'chart', img: 'image', li: 'list item', label: 'label', span: 'text', div: 'area', section: 'section', header: 'header', footer: 'footer', nav: 'navigation', dialog: 'dialog' };
const tagWord = (t: string) => TAGS[t] ?? 'element';
const article = (w: string) => (/^[aeiou]/.test(w) ? 'An' : 'A');

export function WebReview() {
  const [local, setLocal] = useState(false);
  useEffect(() => setLocal(LOCAL.has(location.hostname)), []);
  return local ? <Widget /> : null;
}

function Widget() {
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
    setSaid(`Spot ${spot.n} added. Click the page to add another.`);
    setBad(false);
    setTimeout(() => document.getElementById(`gfw-spot-${spot.n}`)?.scrollIntoView({ block: 'nearest' }), 0);
  }, []);

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
        else setSaid(target.closest('[data-gfw-multi]') ? 'This text is built from several copy entries or filled from data, so it cannot be edited in place.' : 'This is not page copy, so it cannot be edited here. It comes from the data or the page layout.');
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
  }, [open, addSpot, startEdit]);

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
    setSaid('Spot removed.');
    setBad(false);
  };
  const addComponent = () => {
    const name = lists.find((c) => c.name === add.trim() || words(c.name).toLowerCase() === add.trim().toLowerCase())?.name;
    if (!name) { setSaid('That is not a known component. Choose one from the list.'); setBad(true); return; }
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
    if (!note.trim()) { setSaid('Write a note first.'); setBad(true); noteRef.current?.focus(); return; }
    if (!step) { setSaid('Choose a journey step first. Feedback is recorded against a step.'); setBad(true); return; }
    setSending(true);
    setSaid('Sending.');
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
      setSaid(`Registered as ${r.id} and accepted. Screenshots are being taken.${r.redacted?.length ? ' A value shaped like a secret was removed.' : ''}`);
      setTimeout(loadRecorded, 4000);
    } catch (e) {
      setBad(true);
      setSaid(`Not recorded. ${e instanceof ReviewError && e.problems[0] ? e.problems[0] : (e as Error).message}`);
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
          <button key={p.n} type="button" className={`gfw-pin${p.detached ? ' detached' : ''}`} style={{ left: p.x, top: p.y }} aria-label={`Spot ${p.n}`} onClick={(e) => { e.stopPropagation(); document.getElementById(`gfw-spot-${p.n}`)?.scrollIntoView({ block: 'nearest' }); }}>{p.n}</button>
        )) : null}
      </div>
      {!open ? <button type="button" className="gfw-entry" aria-expanded="false" aria-controls="gfw-panel" onClick={() => setOpen(true)}>Feedback</button> : null}
      {open ? (
        <aside id="gfw-panel" className="gfw-panel" aria-label="Feedback">
          <div className="gfw-head">
            <h2>Feedback</h2>
            <button type="button" className="gfw-btn" onClick={() => setOpen(false)}>Close</button>
          </div>
          <div className="gfw-scroll">
            <div className="gfw-field">
              <label htmlFor="gfw-note">Note</label>
              <textarea id="gfw-note" ref={noteRef} rows={4} placeholder="Say what is wrong or what should change." value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div className="gfw-field">
              <label htmlFor="gfw-step">Journey step</label>
              <select id="gfw-step" value={step} onChange={(e) => setStep(e.target.value)}>
                <option value="">{matched.length ? 'Choose a step' : 'This page has no step. Choose one'}</option>
                {matched.length ? <optgroup label="This page">{steps.filter((s) => matched.includes(s.id)).map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</optgroup> : null}
                <optgroup label="All steps">{steps.filter((s) => !matched.includes(s.id)).map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</optgroup>
              </select>
            </div>
            <div className="gfw-field">
              <h3 id="gfw-spots-head">Spots on the page</h3>
              <p className="gfw-hint">Click the page to add a numbered pin. Add as many as the note needs. With none, the ticket is about the whole page. Double click page copy to edit it here.</p>
              <ol className="gfw-spots" aria-labelledby="gfw-spots-head">
                {spots.map((s) => (
                  <li key={s.id} id={`gfw-spot-${s.n}`} className="gfw-spot">
                    <span className="gfw-n" aria-hidden="true">{s.n}</span>
                    <button type="button" className="gfw-spot-label" aria-label={`Show spot ${s.n} on the page`} onClick={() => { try { document.querySelector(s.selector)?.scrollIntoView({ block: 'center' }); } catch { /* the page changed */ } }}>
                      {s.text ? `“${excerpt(s.text, 90)}”` : `${article(tagWord(s.tag))} ${tagWord(s.tag)}`}
                      <small>{s.text ? `${article(tagWord(s.tag))} ${tagWord(s.tag)}` : 'No visible text'}</small>
                    </button>
                    <button type="button" className="gfw-btn small" aria-label={`Remove spot ${s.n}`} onClick={() => removeSpot(s)}>Remove</button>
                  </li>
                ))}
              </ol>
              {spots.length ? null : <p className="gfw-empty">No spots yet.</p>}
            </div>
            <fieldset className="gfw-field">
              <legend>Categories</legend>
              <div className="gfw-cats">
                {(categories ?? []).map((c) => (
                  <label key={c} className="gfw-check">
                    <input type="checkbox" checked={cats.includes(c)} onChange={(e) => setCats(e.target.checked ? [...cats, c] : cats.filter((x) => x !== c))} />
                    {c}
                  </label>
                ))}
                {categories && !categories.length ? <p className="gfw-hint">Categories are unavailable: the review server did not answer.</p> : null}
              </div>
            </fieldset>
            <div className="gfw-field">
              <label htmlFor="gfw-comp-add">Design system components</label>
              {components.length ? (
                <ul className="gfw-tags" aria-label="Linked components">
                  {components.map((name) => {
                    const c = info(name);
                    return (
                      <li key={name} className="gfw-tag">
                        {c?.spec && c.view ? (
                          <>
                            <a href={c.view} target="_blank" rel="noopener" aria-label={`${words(name)}, opens the design system file in a new tab`}>{words(name)}</a>
                            <a className="gfw-obsidian" href={c.obsidian}>Open in Obsidian<span className="gfw-sr">: {words(name)}</span></a>
                          </>
                        ) : (
                          <><span>{words(name)}</span><small>No design system file yet</small></>
                        )}
                        <button type="button" aria-label={`Remove ${words(name)}`} onClick={() => dropComponent(name)}>{'×'}</button>
                      </li>
                    );
                  })}
                </ul>
              ) : <p className="gfw-hint">None linked.</p>}
              <div className="gfw-add">
                <input id="gfw-comp-add" type="text" list="gfw-comp-list" autoComplete="off" placeholder="Add a component" value={add} onChange={(e) => setAdd(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addComponent(); } }} />
                <datalist id="gfw-comp-list">{lists.map((c) => <option key={c.name} value={words(c.name)} />)}</datalist>
                <button type="button" className="gfw-btn" onClick={addComponent}>Add</button>
              </div>
            </div>
            {keys.length ? (
              <div className="gfw-field">
                <h3>Content entries</h3>
                <ul className="gfw-tags" aria-label="Linked content entries">{keys.map((k) => <li key={k} className="gfw-tag"><span>{keyWords(k)}</span></li>)}</ul>
              </div>
            ) : null}
            <div className="gfw-field">
              <h3>Recorded for this step</h3>
              <ul className="gfw-recorded">
                {recorded.length ? recorded.map((t) => (
                  <li key={t.id}>
                    {t.id} {t.status.toLowerCase()}: {excerpt(t.title, 70)}
                    {t.pipeline ? <> <strong>{t.pipeline.label}</strong></> : null}
                    {(t.images ?? []).map((img) => <span key={img.url}> <a href={img.url} target="_blank" rel="noopener">{img.kind === 'page' ? 'Page image' : `Spot ${img.spot} image`}</a></span>)}
                  </li>
                )) : <li>Nothing yet.</li>}
              </ul>
            </div>
          </div>
          <div className="gfw-foot">
            <span className={`gfw-said${bad ? ' bad' : ''}`} role="status" aria-live="polite">{said}</span>
            <button type="button" className="gfw-send" onClick={() => void send()} disabled={sending}>Send</button>
          </div>
        </aside>
      ) : null}
      {open && editing ? <InlineEditor element={editing.element} copyKey={editing.key} step={step} spot={editing.spot} onClose={() => setEditing(null)} onSaved={(id) => { setSaid(`Edited in place and recorded as ${id}, accepted.`); setBad(false); }} /> : null}
    </div>
  );
  return createPortal(nodes, document.body);
}
