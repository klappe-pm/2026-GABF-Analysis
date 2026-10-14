// A scoresheet range scale: a ruled axis, the style's minimum to maximum as a band in judging green,
// and the beer's value as an ink stroke. A value outside the band is a finding, so it is set in red pen.

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
        <span id={`${id}-label`} className="font-narrow text-label uppercase text-ink-muted">{label}</span>
        <span className={`text-lead font-semibold tabular-nums ${value === null ? 'text-ink-faint' : outside ? 'text-red' : 'text-ink'}`}>{valueText}</span>
      </div>
      <div className="relative h-6 border-b border-ink" aria-hidden="true">
        {ticks.map((v) => (
          <span key={v} className="absolute bottom-0 h-2 border-l border-rule-strong" style={{ left: pct(v) }} />
        ))}
        {range ? (
          <span className="absolute bottom-0 h-4 border border-b-0 border-green bg-green-tint" style={{ left: pct(range.min), width: `calc(${pct(range.max)} - ${pct(range.min)})` }} />
        ) : null}
        {value !== null ? (
          <span className={`absolute bottom-0 h-6 border-l-2 ${outside ? 'border-red' : 'border-ink'}`} style={{ left: pct(value) }} />
        ) : null}
      </div>
      {range ? (
        <div className="relative h-4 font-narrow text-micro tabular-nums text-green" aria-hidden="true">
          <span className="absolute -translate-x-1/2" style={{ left: pct(range.min) }}>{range.minText}</span>
          <span className="absolute -translate-x-1/2" style={{ left: pct(range.max) }}>{range.maxText}</span>
        </div>
      ) : null}
      <figcaption id={`${id}-summary`} className={`text-data ${outside ? 'text-red' : 'text-ink-muted'}`}>
        {summary}
        {source ? <span className="block text-ink-faint">{source}</span> : null}
      </figcaption>
    </figure>
  );
}
