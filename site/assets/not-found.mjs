// The one wording for a value the data does not hold. It mirrors the copy key
// global.labels.not_found, and tests/not-found.test.mjs fails if the two disagree, so the build
// (which reads the key) and the browser views (which import this) always show the same text.
export const NOT_FOUND = 'Not Found';
export const NOT_FOUND_HTML = `<span class="muted">${NOT_FOUND}</span>`;
