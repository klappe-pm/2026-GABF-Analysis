// Published specs of the researched winner profiles, attached to the matching medal rows so every
// table can show a beer's own figures. A value comes only from the profile; a field the profile
// leaves empty stays empty. Nothing is filled from the style range.

import { loadWinnerProfiles, matchKey } from './winner-profiles.mjs';

const isBlank = (v) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
const blankToNull = (v) => (isBlank(v) ? null : v);

function section(body, name) {
  const hit = body.match(new RegExp(`^## ${name}\\s*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm'));
  return hit ? hit[1].trim() : '';
}

// The Source column of the specs table, keyed by the row's field name. A cell that is not a
// markdown link (for example "none found") has no source.
export function specSources(body) {
  const labels = { Style: 'style', ABV: 'abv', IBU: 'ibu', Hops: 'hops', 'Malts and grains': 'malts', Yeast: 'yeast', 'Adjuncts, fruit, spices': 'adjuncts' };
  const out = {};
  for (const line of section(body, 'specs').split('\n')) {
    const cells = line.split('|').map((c) => c.trim());
    const field = labels[cells[1]];
    if (!field) continue;
    const link = cells[3]?.match(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/);
    out[field] = link ? { label: link[1], url: link[2] } : null;
  }
  return out;
}

const plainText = (md) => md.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').trim();

// One profile as the spec object stored on a medal row. Each figure carries its own source.
export function specFromProfile(p) {
  const fm = p.fm;
  const src = specSources(p.body);
  const field = (name, value) => {
    const v = blankToNull(value);
    return { value: v, source: v === null ? null : (src[name] ?? null) };
  };
  const abv = fm.abv === null || fm.abv === undefined || fm.abv === '' ? null : Number(fm.abv);
  const ibu = fm.ibu === null || fm.ibu === undefined || fm.ibu === '' ? null : Number(fm.ibu);
  const description = plainText(section(p.body, 'brewery-description'));
  return {
    page: `beers/${p.year}/${p.stem}/`,
    beer_url: blankToNull(fm['beer-url']),
    abv: field('abv', Number.isFinite(abv) ? abv : null),
    ibu: field('ibu', Number.isFinite(ibu) ? ibu : null),
    style: field('style', fm.style),
    hops: field('hops', fm.hops),
    malts: field('malts', fm.malts),
    yeast: field('yeast', fm.yeast),
    adjuncts: field('adjuncts', fm.adjuncts),
    description: description || null,
  };
}

// Attach the specs to every GABF row of the profile year that matches a profile by beer, medal and
// category. The row's own abv and ibu are the beer's published figures, or stay empty.
export function attachWinnerSpecs(results, { year = 2026, dir } = {}) {
  const profiles = dir ? loadWinnerProfiles(year, dir) : loadWinnerProfiles(year);
  const byKey = new Map(profiles.map((p) => [p.key, p]));
  let matched = 0;
  for (const r of results) {
    r.spec = null;
    r.ibu = null;
    if (r.year !== year || (r.competition && r.competition !== 'GABF')) continue;
    const p = byKey.get(matchKey(r.beer_name, r.medal, r.category_name));
    if (!p) continue;
    r.spec = specFromProfile(p);
    r.abv = r.spec.abv.value ?? r.abv;
    r.ibu = r.spec.ibu.value;
    matched += 1;
  }
  return matched;
}
