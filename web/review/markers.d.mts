export const OPEN: string;
export const SEP: string;
export const CLOSE: string;
export function mark(key: string, text: string): string;
export function parse(text: unknown): { plain: string; segments: { key: string; text: string; start: number; end: number }[]; dangling: boolean };
export function strip(text: unknown): string;
export function wholeKey(text: unknown): string | null;
