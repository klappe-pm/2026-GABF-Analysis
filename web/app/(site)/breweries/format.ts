// Number forms for the breweries pages, as global/formats.md writes them: whole numbers with comma
// separators, compact money with K, M, and B, whole number margins, and one decimal for ABV.
export const whole = (x: number) => Math.round(x).toLocaleString('en-US');

export function compact(value: number): string {
  const x = Math.abs(value);
  const trim = (n: number) => n.toFixed(1).replace(/\.0$/, '');
  if (x >= 1e9) return `${trim(value / 1e9)}B`;
  if (x >= 1e6) return `${trim(value / 1e6)}M`;
  if (x >= 1e4) return `${(value / 1e3).toFixed(0)}K`;
  if (x >= 1e3) return `${trim(value / 1e3)}K`;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export const usd = (value: number) => `$${compact(value)}`;
export const percent = (x: number) => `${Math.round(x * 100)}%`;
export const abv = (x: number) => `${Number.isInteger(x) ? x : x.toFixed(1).replace(/\.0$/, '')}%`;
export const fillText = (text: string, values: Record<string, string | number>) => text.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in values ? String(values[k]) : m));
