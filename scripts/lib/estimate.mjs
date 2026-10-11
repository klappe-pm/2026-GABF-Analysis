// Volume and revenue estimation. Every number here is an estimate (E) unless the
// production table carries a reported figure. Parameters live in
// data/reference/estimation-parameters.json so they can be tuned without code changes.

import { readFileSync } from 'node:fs';

export const BARREL_GALLONS = 31;
export const OUNCES_PER_GALLON = 128;
export const OUNCES_PER_BARREL = BARREL_GALLONS * OUNCES_PER_GALLON; // 3968
export const CASES_24X12_PER_BARREL = OUNCES_PER_BARREL / (24 * 12); // 13.78
export const CANS_16OZ_PER_BARREL = OUNCES_PER_BARREL / 16; // 248
export const CANS_12OZ_PER_BARREL = OUNCES_PER_BARREL / 12; // 330.7
export const PINTS_PER_BARREL = CANS_16OZ_PER_BARREL;

export function loadParameters(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

// Parse a Brewery of the Year bracket such as "5,001 - 15,000 Barrels" or "Over 100,000 Barrels".
export function bracketToRange(bracket) {
  const s = String(bracket ?? '').replace(/,/g, '');
  let m = s.match(/(\d+)\s*[-–—]\s*(\d+)/);
  if (m) return { min: Number(m[1]), max: Number(m[2]) };
  m = s.match(/(?:over|>|more than)\s*(\d+)/i) ?? s.match(/(\d+)\s*\+/);
  if (m) return { min: Number(m[1]) + 1, max: null };
  return null;
}

export function estimateBarrels({ production = [], breweryType = '', locationsCount = 1, botyBracket = '' }, params) {
  const reported = production.filter((p) => p.basis === 'reported' && Number(p.barrels) > 0).sort((a, b) => Number(b.year) - Number(a.year));
  if (reported.length > 0) return { barrels: Number(reported[0].barrels), basis: 'reported', confidence: 'high', year: reported[0].year, source: reported[0].source };
  const bracketRow = production.find((p) => p.basis === 'boty-bracket') ?? (botyBracket ? { barrels: '', notes: botyBracket } : null);
  if (bracketRow) {
    const range = bracketToRange(bracketRow.notes || bracketRow.bracket || botyBracket);
    if (range) {
      const barrels = range.max ? Math.round((range.min + range.max) / 2) : Math.round(range.min * 1.25);
      return { barrels, basis: 'boty-bracket', confidence: 'medium', range, source: bracketRow.source ?? 'GABF Brewery of the Year bracket' };
    }
  }
  const curated = production.find((p) => p.basis === 'estimate' && Number(p.barrels) > 0);
  if (curated) return { barrels: Number(curated.barrels), basis: 'estimate', confidence: curated.confidence || 'low', source: curated.source, notes: curated.notes };
  const perType = params.barrels_by_brewery_type[breweryType] ?? params.barrels_by_brewery_type.default;
  const extra = Math.max(0, Number(locationsCount) - 1) * params.barrels_per_additional_location;
  return { barrels: perType + extra, basis: 'type-heuristic', confidence: 'low', source: 'estimation-parameters.json' };
}

export function volumeBreakdown(barrels, params, breweryType = '') {
  const packagedShare = params.packaged_share_by_brewery_type[breweryType] ?? params.packaged_share_by_brewery_type.default;
  const packagedBarrels = barrels * packagedShare;
  const draftBarrels = barrels - packagedBarrels;
  return {
    barrels,
    gallons: Math.round(barrels * BARREL_GALLONS),
    liters: Math.round(barrels * BARREL_GALLONS * 3.78541),
    packaged_share: packagedShare,
    packaged_barrels: Math.round(packagedBarrels),
    draft_barrels: Math.round(draftBarrels),
    cases_24x12_equivalent: Math.round(barrels * CASES_24X12_PER_BARREL),
    cans_16oz_equivalent: Math.round(packagedBarrels * CANS_16OZ_PER_BARREL),
    pints_equivalent_draft: Math.round(draftBarrels * PINTS_PER_BARREL),
  };
}

export function estimateRevenue(barrels, params, breweryType = '', { locationsCount = 1, hasKitchen = false } = {}) {
  const perBarrel = params.revenue_per_barrel_by_brewery_type[breweryType] ?? params.revenue_per_barrel_by_brewery_type.default;
  const beer = barrels * perBarrel;
  const food = hasKitchen ? Number(locationsCount) * params.food_revenue_per_kitchen_location : 0;
  const total = beer + food;
  return {
    beer_revenue_usd: Math.round(beer),
    food_revenue_usd: Math.round(food),
    total_revenue_usd: Math.round(total),
    low_usd: Math.round(total * params.revenue_range_low_multiplier),
    high_usd: Math.round(total * params.revenue_range_high_multiplier),
    revenue_per_barrel_usd: perBarrel,
    basis: 'estimate',
  };
}
