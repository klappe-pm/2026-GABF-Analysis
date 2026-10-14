// Small helpers shared by the components.
import type { CSSProperties } from 'react';
import { colorVar, shapeVar, type TypeRole, typeClass } from './schema';

export const hasFigure = (text: string) => /\d/.test(text);

// Labels are set in the label face, except a label that holds a figure: figures are always Public Sans.
export const labelFace = (text: string): CSSProperties | undefined => (hasFigure(text) ? { fontFamily: 'var(--md-ref-typeface-plain)' } : undefined);

export const typeOf = (role: unknown) => typeClass(String(role) as TypeRole);
export const color = (role: unknown) => colorVar(String(role));
export const shape = (s: unknown) => shapeVar(String(s));

// The text color Material pairs with a container color.
export function onColor(role: unknown): string {
  const r = String(role);
  if (r.startsWith('on ')) return colorVar(r.slice(3));
  if (r === 'inverse surface') return colorVar('inverse on surface');
  if (r.startsWith('surface') || r === 'outline' || r === 'outline variant') return colorVar('on surface');
  if (r === 'inverse primary' || r === 'inverse on surface') return colorVar('inverse surface');
  return colorVar(`on ${r}`);
}

// Custom properties as a React style object.
export const vars = (v: Record<string, string | number | undefined>) => v as CSSProperties;

// The same three card looks for an element that must keep its own tag (a list item, a table wrapper).
// An elevated card also renders <md-elevation> inside it.
export function cardSurface(style: unknown): { className: string; style: CSSProperties; elevated: boolean } {
  const s = String(style);
  const base = 'relative rounded-(--md-sys-shape-corner-medium)';
  if (s === 'filled') return { className: base, style: { background: colorVar('surface container highest') }, elevated: false };
  if (s === 'elevated') return { className: base, style: { background: colorVar('surface container low'), ['--md-elevation-level' as string]: 1 } as CSSProperties, elevated: true };
  return { className: base, style: { background: colorVar('surface'), border: `1px solid ${colorVar('outline variant')}` }, elevated: false };
}
