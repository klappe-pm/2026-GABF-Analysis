// Text helpers shared by the parsers.

export const US_STATES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
  CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky',
  LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
  NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota',
  OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia',
  WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', PR: 'Puerto Rico',
};

const NAME_TO_CODE = Object.fromEntries(Object.entries(US_STATES).map(([code, name]) => [name.toLowerCase(), code]));

export function normalizeState(value) {
  const s = String(value ?? '').trim().replace(/\.$/, '');
  if (!s) return '';
  const upper = s.toUpperCase();
  if (US_STATES[upper]) return upper;
  const byName = NAME_TO_CODE[s.toLowerCase()];
  return byName ?? s;
}

export function collapseWhitespace(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}

// PDF extraction often turns straight punctuation into typographic variants.
export function normalizePunctuation(s) {
  return String(s ?? '')
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/ /g, ' ');
}

export function titleCase(s) {
  return String(s ?? '').toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());
}
