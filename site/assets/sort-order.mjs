// The one sort order for every dropdown and option list on the site: entries that start with a
// number come first in numeric order (2 before 10), then everything else alphabetically, ignoring
// case and a leading "The". Year controls may instead run newest first (compareYearsNewestFirst).

const LEADING_THE = /^the\s+(?=\S)/i;
const LEADING_NUMBER = /^\d[\d,]*(?:\.\d+)?/;

// The text an entry sorts by: trimmed, without a leading "The".
export function sortText(label) {
  return String(label ?? '').trim().replace(LEADING_THE, '');
}

const numberOf = (text) => {
  const m = LEADING_NUMBER.exec(text);
  return m ? Number(m[0].replace(/,/g, '')) : null;
};

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

export function compareLabels(a, b) {
  const ta = sortText(a);
  const tb = sortText(b);
  const na = numberOf(ta);
  const nb = numberOf(tb);
  if ((na === null) !== (nb === null)) return na === null ? 1 : -1;
  if (na !== null && na !== nb) return na - nb;
  return collator.compare(ta, tb) || (String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0);
}

// Sorts a copy of a list; `label` reads the text an item sorts by (default: the item itself).
export function sortByLabel(list, label = (x) => x) {
  return [...list].sort((x, y) => compareLabels(label(x), label(y)));
}

// For a control that is explicitly a year picker: newest year first.
export const compareYearsNewestFirst = (a, b) => Number(b) - Number(a);
