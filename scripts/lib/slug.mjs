// Slugs and brewery name normalization shared by every stage.

export function slugify(input) {
  return String(input ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const CORPORATE_SUFFIXES = [
  'brewing company', 'brewing co', 'brewing', 'brewery', 'brew co', 'brewers', 'brewhouse',
  'beer company', 'beer co', 'beer', 'ales', 'ale works', 'brewpub', 'brewing corp',
  'cidery', 'cider company', 'cider co', 'cider', 'company', 'co', 'inc', 'llc', 'ltd',
];

// Reduce a printed brewery name to a comparable key. "Green Cheek Beer Co." and
// "Green Cheek Beer Company" both become "green cheek". Location suffixes such as
// " - Costa Mesa" or " (Costa Mesa)" are removed by splitLocationSuffix first.
export function breweryKey(name) {
  let s = String(name ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[.'’,]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  s = s.replace(/^the /, '');
  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of CORPORATE_SUFFIXES) {
      const re = new RegExp(`\\s+${suffix}$`);
      if (re.test(s) && s.replace(re, '').length >= 3) {
        s = s.replace(re, '');
        changed = true;
      }
    }
  }
  return s.trim();
}

// "Green Cheek Beer Co. - Costa Mesa" -> { name: "Green Cheek Beer Co.", location: "Costa Mesa" }
// "Green Cheek Beer Co. (Costa Mesa)"  -> same
export function splitLocationSuffix(printed) {
  const raw = String(printed ?? '').trim();
  let m = raw.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
  if (m && m[1].length > 0) return { name: m[1].trim(), location: m[2].trim() };
  m = raw.match(/^(.*?)\s+[-–—]\s+(.+)$/);
  if (m && m[1].length > 0) return { name: m[1].trim(), location: m[2].trim() };
  return { name: raw, location: '' };
}
