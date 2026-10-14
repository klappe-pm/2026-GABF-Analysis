// Title case for headings, labels, buttons, and column headers (voice.md): every word capitalized,
// except short joining words after the first word. Words already capitalized (IPA, GABF) keep their case.
const SMALL_WORDS = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'for', 'nor', 'of', 'in', 'on', 'at', 'to', 'by', 'per', 'vs', 'from', 'as', 'with', 'into', 'than']);
const ACRONYMS = { url: 'URL', abv: 'ABV', ibu: 'IBU', srm: 'SRM', gabf: 'GABF', ipa: 'IPA', id: 'ID', csv: 'CSV' };
export function titleCase(text) {
  return String(text ?? '').split(' ').map((w, i) => ACRONYMS[w] ?? (i > 0 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
}
