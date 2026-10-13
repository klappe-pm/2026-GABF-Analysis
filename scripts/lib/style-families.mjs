// Map an official category name to a coarse style family for browsing and charts.
// Rules run in order; the first match wins. Anything unmatched lands in "Other".

export const STYLE_FAMILIES = [
  'IPA', 'Pale Ale', 'Lager', 'Pilsner', 'Wheat', 'Stout and Porter', 'Belgian and French',
  'Sour and Wild', 'Strong and Barrel-Aged', 'Brown, Amber, and Red', 'British and Irish', 'German Ale',
  'Fruit, Spice, and Specialty', 'Smoke and Wood', 'Gluten-Free and Non-Alcoholic', 'Cider and Mead', 'Pro-Am and Collaboration', 'Other',
];

const RULES = [
  ['Pro-Am and Collaboration', /pro-?am|collaboration/i],
  ['Cider and Mead', /\bcider|perry|mead\b/i],
  ['Gluten-Free and Non-Alcoholic', /gluten|non-?alcohol|hop water|alcohol-free/i],
  ['Smoke and Wood', /smoke|rauch|wood-? ?and-? ?barrel|wood|barrel-aged|barrel aged/i],
  ['Fruit, Spice, and Specialty', /fruit|field|pumpkin|spice|herb|chocolate|coffee|honey|chili|pepper|dessert|pastry|experimental|specialty|historical|indigenous|adjunct|hybrid|crossover|session beer|other strong|craft malt|rice/i],
  ['Sour and Wild', /sour|wild|brett|lambic|gueuze|flanders|gose|berliner|kettle/i],
  ['IPA', /india pale|\bipa\b|hazy|juicy|new england/i],
  ['Pilsner', /pilsener|pilsner|pils\b/i],
  ['Wheat', /wheat|weizen|weisse|weissbier|witbier|wit\b|dunkelweizen/i],
  ['Belgian and French', /belgian|french|saison|bi[eè]re de garde|abbey|trappist|tripel|dubbel|quad|strong golden|blonde ale.*belgian|lambic/i],
  ['Stout and Porter', /stout|porter/i],
  ['Strong and Barrel-Aged', /barley ?wine|wheat wine|imperial|double|strong ale|old ale|scotch ale|wee heavy|strong|bock|doppelbock|eisbock/i],
  ['British and Irish', /english|british|irish|scottish|ordinary bitter|special bitter|extra special|esb|mild ale|brown ale.*english|golden ale.*english|red ale.*irish/i],
  ['German Ale', /k[öo]lsch|altbier|alt\b|german-style ale|roggen|steinbier/i],
  ['Brown, Amber, and Red', /brown|amber|red ale|red lager|dark ale/i],
  ['Pale Ale', /pale ale|blonde|golden ale|cream ale|australian|international-style pale/i],
  ['Lager', /lager|helles|dortmunder|export|m[äa]rzen|oktoberfest|kellerbier|zwickel|schwarz|dunkel|vienna|munich|bohemian|baltic|light lager|american lager|international lager|dark lager|pre-prohibition|cold ipa/i],
];

export function styleFamily(categoryName) {
  const name = String(categoryName ?? '');
  for (const [family, re] of RULES) {
    if (re.test(name)) return family;
  }
  return 'Other';
}

// ABV bands used by the explorer filter. A category's guideline range is placed into
// the band of its midpoint; a beer with a known ABV uses its own value.
export const ABV_BANDS = [
  { id: 'under-4', label: 'Under 4.0%', min: 0, max: 3.99 },
  { id: '4-to-5', label: '4.0% to 4.9%', min: 4, max: 4.99 },
  { id: '5-to-6', label: '5.0% to 5.9%', min: 5, max: 5.99 },
  { id: '6-to-7', label: '6.0% to 6.9%', min: 6, max: 6.99 },
  { id: '7-to-8', label: '7.0% to 7.9%', min: 7, max: 7.99 },
  { id: '8-to-10', label: '8.0% to 9.9%', min: 8, max: 9.99 },
  { id: '10-plus', label: '10.0% and up', min: 10, max: 99 },
];

export function abvBand(abv) {
  if (abv === null || abv === undefined || abv === '') return '';
  const v = Number(abv);
  if (!Number.isFinite(v)) return '';
  const band = ABV_BANDS.find((b) => v >= b.min && v <= b.max);
  return band ? band.id : '';
}

// A "special" category is one judged on an added ingredient, process, or non-standard
// base rather than a classic style: specialty, experimental, fruit, spice, barrel, smoke,
// gluten-free, non-alcohol, cider, Pro-Am, collaboration, hybrid, adjunct, and the catch-all
// session and specialty IPA categories. Classic style categories are everything else.
export function isSpecialCategory(categoryName) {
  const name = String(categoryName ?? '');
  return /specialty|experimental|fruit|field|pumpkin|chili|pepper|herb|spice|coffee|chocolate|cocoa|honey|historical|indigenous|smoke|rauch|wood|barrel|gluten|non-alcohol|alcohol-free|hop water|craft malt|pro-?am|collaboration|cider|perry|mead|hybrid|crossover|adjunct|dessert|pastry|session beer|other strong|vegetable|kombucha/i.test(name);
}
