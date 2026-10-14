// The rules visible copy follows, in one place so the copy tests and the review tools agree:
// no dash used as punctuation, and no kebab case (a data slug) shown as a word.

// Built from code points so this source carries no dash glyph itself.
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);
export const DASH_GLYPHS = new RegExp(`[${EN}${EM}]`);
const SPACED_HYPHEN = /\s-\s/;
const DOUBLE_HYPHEN = /-{2}/;

// Real compound words that are hyphenated by their owners rather than slugs.
export const COMPOUNDS = new Set(['gluten-free', 'barrel-aged', 'us-atlas']);

export function kebabTokens(text) {
  const plain = String(text).replace(/\{\{[^}]+\}\}/g, '');
  return [...plain.matchAll(/(^|[^\w{\-/])([a-z]+(?:-[a-z0-9]+)+)(?![\w}\-])/g)].map((m) => m[2]).filter((t) => !COMPOUNDS.has(t.toLowerCase()));
}

// Why a line of copy breaks the rules, as sentences a reviewer can act on. A token the old text
// already carried is not new, so editing around an existing compound does not trip the rule.
export function copyProblems(text, { previous = '' } = {}) {
  const problems = [];
  const value = String(text);
  if (!value.trim()) problems.push('The copy cannot be empty.');
  if (/[\r\n]/.test(value)) problems.push('The copy is one line. Remove the line break.');
  if (value.length > 600) problems.push('The copy is longer than 600 characters.');
  if (DASH_GLYPHS.test(value) || SPACED_HYPHEN.test(value) || DOUBLE_HYPHEN.test(value)) problems.push('A dash is used as punctuation. Use a comma, colon, period, or parentheses, and write ranges as "3 to 5".');
  const known = new Set(kebabTokens(previous));
  const kebab = kebabTokens(value).filter((t) => !known.has(t));
  if (kebab.length) problems.push(`"${kebab[0]}" reads as a data slug. Write it as plain words.`);
  return problems;
}
