// The link graph between the generated reference files: hop varieties, hop farms, breweries, and
// the 2026 beer profiles (which another process owns and this code only points at).
//
// Two kinds of farm link stay apart everywhere:
//   named  the brewery named this farm for a hop in its 2026 beer profile
//   grown  the farm is published as growing the variety; the beer reaches it only through the variety

import { loadDataset } from './data-model.mjs';
import { byMedalThenBeer } from './hops.mjs';

export const PATHS = {
  variety: (slug) => `docs/hops/varieties/${slug}.md`,
  farm: (slug) => `docs/hops/farms/${slug}.md`,
  brewery: (slug) => `docs/breweries/${slug}.md`,
  beer: (stem) => `docs/2026/winner/${stem}.md`,
  hopsIndex: 'docs/hops/README.md',
  farmsIndex: 'docs/hops/farms/README.md',
  breweriesIndex: 'docs/breweries/README.md',
};

const byName = (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });

// Everything the three builders share, derived once from the dataset.
export function buildGraph(ds = loadDataset({ localProfiles: false })) {
  const model = ds.hops;
  const breweryBySlug = new Map(ds.breweries.map((b) => [b.slug, b]));
  const beersByBrewery = new Map();
  for (const beer of model.beers.values()) {
    if (!breweryBySlug.has(beer.brewery_slug)) continue;
    if (!beersByBrewery.has(beer.brewery_slug)) beersByBrewery.set(beer.brewery_slug, []);
    beersByBrewery.get(beer.brewery_slug).push(beer);
  }
  for (const list of beersByBrewery.values()) list.sort(byMedalThenBeer);
  // A variety has a page when the catalogue lists it; a name the site only meets in a profile has none.
  const hasPage = (v) => v.listed;
  return { ds, model, breweryBySlug, beersByBrewery, hasPage, byName };
}

// The hops, named farms and grown farms of one brewery's 2026 beers.
export function reachOf(graph, brewerySlug) {
  const beers = graph.beersByBrewery.get(brewerySlug) ?? [];
  const varieties = new Map();
  const named = new Map();
  const grown = new Map();
  for (const beer of beers) {
    for (const u of beer.usage) {
      const slot = varieties.get(u.variety.slug) ?? { variety: u.variety, beers: new Set() };
      slot.beers.add(beer.stem);
      varieties.set(u.variety.slug, slot);
      if (u.farm) {
        const n = named.get(u.farm.slug) ?? { farm: u.farm, beers: new Set(), varieties: new Set() };
        n.beers.add(beer.stem);
        n.varieties.add(u.variety.slug);
        named.set(u.farm.slug, n);
      }
      for (const { farm } of u.variety.farms.values()) {
        const g = grown.get(farm.slug) ?? { farm, beers: new Set(), varieties: new Set() };
        g.beers.add(beer.stem);
        g.varieties.add(u.variety.slug);
        grown.set(farm.slug, g);
      }
    }
  }
  return { beers, varieties, named, grown };
}
