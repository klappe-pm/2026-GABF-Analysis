'use client';

import { useEffect, useState } from 'react';

const KEY = 'gabf-theme';

function current(): 'light' | 'dark' {
  const set = document.documentElement.dataset.theme;
  if (set === 'light' || set === 'dark') return set;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Switches between the light and dark stock. The label names the action; the choice is kept on this device.
export function ThemeToggle({ darkLabel, lightLabel }: { darkLabel: string; lightLabel: string }) {
  const [theme, setTheme] = useState<'light' | 'dark' | null>(null);
  useEffect(() => {
    setTheme(current());
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setTheme(current());
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      onClick={() => {
        document.documentElement.dataset.theme = next;
        try { localStorage.setItem(KEY, next); } catch { /* storage unavailable: the choice lasts for this page */ }
        setTheme(next);
      }}
      className="inline-flex min-h-6 items-center border border-rule-strong bg-ground px-3 py-1 font-narrow text-label uppercase text-ink state-hover:bg-ground-tone"
    >
      {theme === 'dark' ? lightLabel : darkLabel}
    </button>
  );
}
