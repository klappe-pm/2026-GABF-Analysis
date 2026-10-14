// Number and text formats the category and analysis pages share. Plain functions, so server and client both use them.
export const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in values ? String(values[k]) : m));
export const num = (n: number | null | undefined) => (n === null || n === undefined ? '' : n.toLocaleString('en-US'));
export const compact = (n: number | null | undefined) => {
  if (n === null || n === undefined || !Number.isFinite(n)) return '';
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(1).replace(/\.0$/, '')}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (a >= 1e4) return `${(n / 1e3).toFixed(0)}K`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
};
export const usd = (n: number | null | undefined) => (n === null || n === undefined ? '' : `$${compact(n)}`);
export const percent = (x: number | null | undefined) => (x === null || x === undefined ? '' : `${Math.round(x * 100)}%`);
export const share = (part: number, whole: number) => (whole ? `${((100 * part) / whole).toFixed(1)}%` : '0%');
export const years = (list: (number | string)[]) => (list.length <= 1 ? list.join('') : list.length === 2 ? list.join(' and ') : `${list.slice(0, -1).join(', ')}, and ${list[list.length - 1]}`);
