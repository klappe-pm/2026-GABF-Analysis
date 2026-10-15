'use client';

import { useSettings } from '@/design/runtime';
import { color, onColor } from '@/design/helpers';
import { MedalMark, type MedalName } from './MedalMark';
import type { MedalCounts } from './MedalRecord';

// A year's medals as badges, the way an app icon carries a count: gold, then silver, then bronze, each
// a medal mark with its count in a Material badge. A badge with a link opens that year's beers; its
// accessible name says the count, the medal, the year, and where it goes. A metal with no medal shows a
// dimmed mark with no count and no link (or nothing, when the spec hides zeros).

export type BadgeCopy = { one: string; other: string; none: string };

const ORDER: [keyof MedalCounts, MedalName][] = [['gold', 'Gold'], ['silver', 'Silver'], ['bronze', 'Bronze']];

const fillIn = (text: string, values: Record<string, string | number>) => text.replace(/\{\{(\w+)\}\}/g, (m, k: string) => (k in values ? String(values[k]) : m));

export function MedalBadge({ counts, year, names, copy, links, group }: { counts: MedalCounts; year: number; names: Record<MedalName, string>; copy: BadgeCopy; links: Partial<Record<MedalName, string>>; group: string }) {
  const s = useSettings('medal-badge');
  const box = Math.max(24, Number(s.Size ?? 32));
  const countRole = s['Count color'] ?? 'error';
  const showZero = s['Show zero'] !== 'no';
  return (
    <span data-component="medal-badge" role="group" aria-label={group} className="inline-flex items-center gap-2">
      {ORDER.map(([k, m]) => {
        const n = counts[k];
        const values = { count: n, medal: names[m].toLowerCase(), year };
        if (n === 0) {
          if (!showZero) return null;
          return (
            <span key={k} role="img" aria-label={fillIn(copy.none, values)} className="inline-grid place-items-center opacity-[0.38]" style={{ width: box, height: box }}>
              <span aria-hidden="true" className="inline-flex"><MedalMark medal={m} label={false} /></span>
            </span>
          );
        }
        const face = (
          <>
            <span aria-hidden="true" className="inline-flex transition-transform duration-150 ease-out group-hover/badge:scale-110 motion-reduce:transition-none"><MedalMark medal={m} /></span>
            <span
              aria-hidden="true"
              className="type-label-small font-plain tabular-nums absolute -top-0.5 -right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 leading-none"
              style={{ background: color(countRole), color: onColor(countRole) }}
            >
              {n}
            </span>
          </>
        );
        const name = fillIn(n === 1 ? copy.one : copy.other, values);
        const to = links[m];
        return to ? (
          <a key={k} href={to} aria-label={name} className="group/badge relative inline-grid place-items-center rounded-full" style={{ width: box, height: box }}>
            {face}
          </a>
        ) : (
          <span key={k} role="img" aria-label={name} className="relative inline-grid place-items-center" style={{ width: box, height: box }}>
            {face}
          </span>
        );
      })}
    </span>
  );
}
