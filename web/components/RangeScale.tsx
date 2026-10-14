'use client';

import { useSettings } from '@/design/runtime';
import { color, labelFace } from '@/design/helpers';

// A style range scale: an axis, the style's minimum to maximum as a band, and the beer's value as a mark.
// A value outside the band is a finding, so it takes the spec's outside color. Colors come from the spec.

export type RangeScaleProps = {
  id: string;
  label: string;
  value: number | null;
  valueText: string;
  range: { min: number; max: number; minText: string; maxText: string } | null;
  summary: string;
  source?: string;
};

function niceStep(span: number) {
  const raw = span / 10;
  const pow = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
}

export function RangeScale({ id, label, value, valueText, range, summary, source }: RangeScaleProps) {
  const s = useSettings('range-scale');
  const band = color(s['Band color'] ?? 'primary container');
  const mark = color(s['Value color'] ?? 'on surface');
  const out = color(s['Outside color'] ?? 'error');
  const lowEdge = range ? Math.min(range.min, value ?? range.min) : value ?? 0;
  const highEdge = range ? Math.max(range.max, value ?? range.max) : value ?? 1;
  const pad = Math.max((highEdge - lowEdge) * 0.35, highEdge * 0.05, 0.5);
  const lo = Math.max(0, lowEdge - pad);
  const hi = highEdge + pad;
  const pct = (v: number) => `${(((v - lo) / (hi - lo)) * 100).toFixed(2)}%`;
  const step = niceStep(hi - lo);
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
  const outside = range && value !== null && (value < range.min || value > range.max);

  return (
    <figure className="flex flex-col gap-2" aria-labelledby={`${id}-label`} aria-describedby={`${id}-summary`}>
      <div className="flex items-baseline justify-between gap-3">
        <span id={`${id}-label`} className="type-label-large text-on-surface-variant" style={labelFace(label)}>{label}</span>
        <span className="type-title-large font-plain tabular-nums" style={{ color: value === null ? 'var(--md-sys-color-outline)' : outside ? out : mark }}>{valueText}</span>
      </div>
      <div className="relative h-6 border-b border-outline" aria-hidden="true">
        {ticks.map((v) => (
          <span key={v} className="absolute bottom-0 h-2 border-l border-outline-variant" style={{ left: pct(v) }} />
        ))}
        {range ? (
          <span className="absolute bottom-0 h-4 rounded-t-(--md-sys-shape-corner-extra-small)" style={{ left: pct(range.min), width: `calc(${pct(range.max)} - ${pct(range.min)})`, background: band }} />
        ) : null}
        {value !== null ? (
          <span className="absolute bottom-0 h-6 w-1 -translate-x-1/2 rounded-(--md-sys-shape-corner-full)" style={{ left: pct(value), background: outside ? out : mark }} />
        ) : null}
      </div>
      {range ? (
        <div className="type-label-small relative h-4 font-plain tabular-nums text-on-surface-variant" aria-hidden="true">
          <span className="absolute -translate-x-1/2" style={{ left: pct(range.min) }}>{range.minText}</span>
          <span className="absolute -translate-x-1/2" style={{ left: pct(range.max) }}>{range.maxText}</span>
        </div>
      ) : null}
      <figcaption id={`${id}-summary`} className="type-body-medium" style={{ color: outside ? out : 'var(--md-sys-color-on-surface-variant)' }}>
        {summary}
        {source ? <span className="type-body-small block text-on-surface-variant">{source}</span> : null}
      </figcaption>
    </figure>
  );
}
