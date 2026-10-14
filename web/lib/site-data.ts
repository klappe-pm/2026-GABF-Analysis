// Build time data for every page. Pages import from here, never from scripts/ directly.
//
// The data comes from site-model.mjs, which runs the repository's own pipeline (scripts/lib/data-model.mjs
// and the decoration in scripts/build-site.mjs). It is loaded with Node's own import rather than bundled,
// so the pipeline resolves its files exactly as it does in the Node build, and one dataset load serves
// every page a build worker renders.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export type { BeerRecord, FilterFields, HopLink, Medal, MedalRow, SiteCounts, SourcedText, WinnerRow } from './site-model.mjs';

type Model = typeof import('./site-model.mjs');

let model: Promise<Model> | null = null;
export function siteModel(): Promise<Model> {
  model ??= import(/* turbopackIgnore: true */ pathToFileURL(resolve(process.cwd(), 'lib', 'site-model.mjs')).href) as Promise<Model>;
  return model;
}

// A port lane's own build time module, web/lib/models/<name>.mjs, loaded the same way. Each lane keeps its
// loaders there (importing site() from ../site-model.mjs) with a <name>.d.mts beside it for types, so no
// two lanes edit this file or site-model.mjs:
//   const brewery = async (slug: string) => (await laneModel<typeof import('./models/breweries.mjs')>('breweries')).brewery(slug);
const lanes = new Map<string, Promise<unknown>>();
export function laneModel<T>(name: string): Promise<T> {
  if (!lanes.has(name)) lanes.set(name, import(/* turbopackIgnore: true */ pathToFileURL(resolve(process.cwd(), 'lib', 'models', `${name}.mjs`)).href));
  return lanes.get(name) as Promise<T>;
}

// generateStaticParams for each dynamic route. Every route that uses one also sets dynamicParams = false,
// so an address outside the dataset is the 404 page rather than a page rendered on demand.
export const staticParams = {
  beers: async () => (await siteModel()).beerParams(),
  breweries: async () => (await siteModel()).breweryParams(),
  categories: async () => (await siteModel()).categoryParams(),
  hops: async () => (await siteModel()).hopParams(),
  hopFarms: async () => (await siteModel()).hopFarmParams(),
};

export const medalRows = async (scope: Record<string, string> = {}) => (await siteModel()).medalRows(scope);
export const winners = async (year?: number) => (await siteModel()).winners(year);
export const beer = async (stem: string) => (await siteModel()).beer(stem);
export const counts = async () => (await siteModel()).counts();
export const filterData = async () => (await siteModel()).filterData();
export const WINNER_YEAR = 2026;
