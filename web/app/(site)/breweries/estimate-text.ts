// How an estimate is explained in words: the templates come from the copy documents (the estimates group of
// pages/brewery-detail.md) and this fills them from the raw facts the model returns. The server page and the
// client views both use it, so the index and a brewery page explain an estimate the same way.
import type { EstimateFacts, IndexEstimate } from '@/lib/models/breweries.mjs';

export type Metric = 'barrels' | 'arr' | 'gross_margin' | 'ebitda' | 'per_barrel' | 'per_location' | 'per_employee';

export type EstimateCopy = {
  templates: Record<string, string>;
  // Label dictionaries: estimate basis, confidence, brewery type, distribution channel, yes and no.
  basis: Record<string, string>;
  confidence: Record<string, string>;
  types: Record<string, string>;
  channels: Record<string, string>;
  yesNo: Record<string, string>;
  notDefined: string;
  metrics: Record<Metric, string>;
};

const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in values ? String(values[k]) : m));
const n = (x: number) => Math.round(x).toLocaleString('en-US');
const usd = (x: number) => `$${n(x)}`;
const pct = (x: number) => `${Math.round(x * 100)}%`;
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

function typePhrase(e: EstimateFacts, c: EstimateCopy) {
  return e.assumed ? c.templates.type_phrase_assumed : fill(c.templates.type_phrase_known, { type: lower(c.types[e.type ?? ''] ?? c.notDefined) });
}

function barrelsText(e: EstimateFacts, c: EstimateCopy) {
  const t = c.templates;
  const barrels = n(e.barrels);
  if (e.basis === 'reported') return e.year ? fill(t.barrels_reported_year, { year: e.year, barrels }) : fill(t.barrels_reported, { barrels });
  if (e.basis === 'boty-bracket') {
    if (e.range?.max) return fill(t.barrels_bracket, { min: n(e.range.min), max: n(e.range.max), barrels });
    return fill(t.barrels_bracket_open, { floor: n((e.range?.min ?? 1) - 1), barrels });
  }
  if (e.basis === 'estimate') return fill(t.barrels_researched, { confidence: lower(c.confidence[e.confidence ?? 'low'] ?? e.confidence ?? ''), barrels });
  const first = fill(t.barrels_typical, { type_phrase: typePhrase(e, c), per_type: n(e.perType) });
  const more = e.locations > 1 ? ` ${fill(t.barrels_locations, { extra: n(e.perExtraLocation), more: e.locations - 1 })}` : '';
  return `${first}${more} ${fill(t.barrels_total, { barrels })}`;
}

function arrText(e: EstimateFacts, c: EstimateCopy) {
  const t = c.templates;
  const r = e.revenue;
  if (r.basis === 'profile estimate') return fill(t.arr_profile, { revenue: usd(r.total), low: usd(r.low), high: usd(r.high) });
  const beer = fill(t.arr_computed, { barrels: n(e.barrels), per_barrel: usd(r.perBarrel ?? 0), type_phrase: typePhrase(e, c), total: usd(r.total), low_multiplier: r.lowMultiplier, high_multiplier: r.highMultiplier });
  const food = r.food ? ` ${fill(t.arr_food, { food_total: usd(r.food), per_location: usd(r.foodPerLocation), count: e.locations })}` : '';
  return `${beer}${food}`;
}

function inputsText(e: EstimateFacts, c: EstimateCopy) {
  const t = c.templates;
  const item = (label: string, value: string) => fill(t.input_item, { label, value });
  const kitchen = e.kitchen === null ? t.value_kitchen_unknown : c.yesNo[e.kitchen ? 'yes' : 'no'];
  return fill(t.inputs, {
    items: [
      item(t.input_barrels, fill(t.value_barrels, { barrels: n(e.barrels), basis: lower(c.basis[e.basis] ?? e.basis).replace(/\s*\(e\)$/, '') })),
      item(t.input_type, e.assumed ? t.value_type_assumed : c.types[e.type ?? ''] ?? c.notDefined),
      item(t.input_locations, String(e.locations)),
      item(t.input_kitchen, kitchen),
      item(t.input_distribution, e.channel ? c.channels[e.channel] ?? c.notDefined : c.notDefined),
      item(t.input_employees, e.employees ? n(e.employees) : c.notDefined),
    ].join('; '),
  });
}

// The explanation shown in an estimate tooltip: how the figure was made, then the inputs behind it.
export function explain(metric: Metric, facts: EstimateFacts | IndexEstimate, c: EstimateCopy): string {
  const t = c.templates;
  const e = facts as EstimateFacts;
  const f = e.fin;
  let body: string;
  switch (metric) {
    case 'barrels': body = barrelsText(e, c); break;
    case 'arr': body = arrText(e, c); break;
    case 'gross_margin': body = fill(t.gross_margin, { arr: usd(f.arr), margin: pct(f.grossMargin), type_phrase: typePhrase(e, c), profit: usd(f.grossProfit) }); break;
    case 'ebitda': body = fill(t.ebitda, { arr: usd(f.arr), margin: pct(f.ebitdaMargin), type_phrase: typePhrase(e, c), ebitda: usd(f.ebitda), low_margin: pct(f.ebitdaLowMargin), high_margin: pct(f.ebitdaHighMargin), channel_phrase: c.templates[`channel_${e.channelKey.replace(/-/g, '_')}`] ?? t.channel_default }); break;
    case 'per_barrel': body = fill(t.per_barrel, { arr: usd(f.arr), barrels: n(e.barrels) }); break;
    case 'per_location': body = fill(t.per_location, { arr: usd(f.arr), count: e.locations }); break;
    default: body = fill(t.per_employee, { arr: usd(f.arr), employees: n(e.employees ?? 0) });
  }
  return `${body} ${inputsText(e, c)}`;
}

export const markLabel = (metric: Metric, c: EstimateCopy) => fill(c.templates.mark_label, { metric: c.metrics[metric] });
