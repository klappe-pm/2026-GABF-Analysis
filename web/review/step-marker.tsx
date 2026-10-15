'use client';

// The journey step marker, for a page the design control plane frames. A control plane screen page (on this same
// origin) names its screen on its body; this draws that step's region from the manifest (GET /review/regions) as a
// square blue outline with a small label, and, while the reader points at or focuses an action chip there, the
// control the chip acts on (a message from the screen page). It sits outside the widget, so it shows at phone width
// too, where the widget draws nothing, and it never takes a click. Review build only, like the rest of web/review.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from './api';

type Region = { selector: string | null; name: string };
type Regions = { screens: Record<string, Region | null>; controls: Record<string, Region> };

// The screen the control plane frames this page as, or null when the page is not in a screen page.
export function framedScreen(): string | null {
  try {
    if (window.parent === window) return null;
    return window.parent.document.body.dataset.screen ?? null;
  } catch {
    return null;
  }
}

const find = (selector: string | null) => {
  if (!selector) return null;
  try {
    return [...document.querySelectorAll<HTMLElement>(selector)].find((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }) ?? null;
  } catch {
    return null;
  }
};

export function StepMarker() {
  const [screen, setScreen] = useState<string | null>(null);
  const [regions, setRegions] = useState<Regions | null>(null);
  const [control, setControl] = useState<string | null>(null);
  const [box, setBox] = useState<{ x: number; y: number; width: number; height: number; label: string } | null>(null);
  const scrolled = useRef(false);

  useEffect(() => {
    const id = framedScreen();
    setScreen(id);
    if (id) api<Regions>('GET', '/review/regions').then(setRegions).catch(() => setRegions(null));
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== location.origin || !e.data || e.data.source !== 'gabf-control-plane' || e.data.kind !== 'control') return;
      setControl(typeof e.data.label === 'string' ? e.data.label : null);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // The region is found again as the page settles (data loading, a dialog opening) and on scroll and resize.
  useEffect(() => {
    if (!screen || !regions) return undefined;
    const place = () => {
      const picked = control ? regions.controls[control] ?? null : null;
      const region = picked ?? regions.screens[screen] ?? null;
      const el = find(region?.selector ?? null);
      if (!region || !el) { setBox(null); return; }
      if (!scrolled.current && !control) { scrolled.current = true; el.scrollIntoView({ block: 'nearest' }); }
      const r = el.getBoundingClientRect();
      setBox({ x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height, label: `${control ? '' : `${screen} `}${region.name}`.trim() });
    };
    place();
    const timer = setInterval(place, 500);
    window.addEventListener('scroll', place, { passive: true });
    window.addEventListener('resize', place);
    return () => { clearInterval(timer); window.removeEventListener('scroll', place); window.removeEventListener('resize', place); };
  }, [screen, regions, control]);

  if (!screen || !box) return null;
  return createPortal(
    <div className="gfw-step" aria-hidden="true" style={{ left: box.x, top: box.y, width: box.width, height: box.height }}>
      <span className={`gfw-step-label${box.y < 32 ? ' below' : ''}`}>{box.label}</span>
    </div>,
    document.body,
  );
}
