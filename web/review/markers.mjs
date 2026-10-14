// The copy-key marking the in place editor reads. In a review build (WEB_REVIEW=1) the copy lookup t() in
// web/lib/content.ts wraps each string it returns as OPEN key SEP text CLOSE, all invisible characters
// except the key and the text, so the page itself says which copy entry drew each piece of text. The
// public build never marks. The editor strips the marks from the page once it has read them.
export const OPEN = '⁢';
export const SEP = '⁣';
export const CLOSE = '⁤';

export const mark = (key, text) => `${OPEN}${key}${SEP}${text}${CLOSE}`;

const PARTIAL_OPEN = new RegExp(`${OPEN}[^${SEP}${OPEN}${CLOSE}]*${SEP}?`, 'g');
const LOOSE = new RegExp(`[${OPEN}${SEP}${CLOSE}]`, 'g');
const SEGMENT = new RegExp(`${OPEN}([^${SEP}${OPEN}${CLOSE}]+)${SEP}([^${OPEN}${CLOSE}]*)${CLOSE}`, 'g');

// The text with its marks removed, and each marked piece with the key that drew it.
export function parse(text) {
  const source = String(text ?? '');
  const segments = [];
  let plain = '';
  let last = 0;
  let dangling = false;
  // A piece the page code split around a link or other markup leaves its start and end in different text
  // nodes. The key is dropped with the marks; that piece is not one line of copy.
  const clean = (chunk) => {
    const out = chunk.replace(PARTIAL_OPEN, '').replace(LOOSE, '');
    if (out.length !== chunk.length) dangling = true;
    return out;
  };
  for (const m of source.matchAll(SEGMENT)) {
    plain += clean(source.slice(last, m.index));
    segments.push({ key: m[1], text: m[2], start: plain.length, end: plain.length + m[2].length });
    plain += m[2];
    last = m.index + m[0].length;
  }
  plain += clean(source.slice(last));
  return { plain, segments, dangling };
}

export const strip = (text) => parse(text).plain;

// The key behind a whole text, or null when the text is not exactly one marked piece (words built from
// several entries, or from an entry and data, are not one line of copy and are not edited in place).
export function wholeKey(text) {
  const { plain, segments } = parse(text);
  if (segments.length !== 1) return null;
  const [s] = segments;
  return plain.trim() === s.text.trim() && s.text.trim() ? s.key : null;
}
