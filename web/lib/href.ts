// Addresses inside the site. Every page path starts and ends with a slash (trailingSlash is on), and a
// plain <a> must carry the base path the site is served under; next/link adds it on its own.

export const SITE_ORIGIN = 'https://gabf.beer';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

// A site path for a plain <a>, a Material element's href, or fetch: href('/beers/2026/').
export const href = (path: string) => `${BASE}${path}`;

// The canonical public address of a page.
export const canonical = (path: string) => `${SITE_ORIGIN}${path}`;

// The site paths of the dynamic pages, so every page links to the same address the route builds.
export const paths = {
  home: '/',
  breweries: '/breweries/',
  brewery: (slug: string) => `/breweries/${slug}/`,
  categories: '/categories/',
  category: (slug: string) => `/categories/${slug}/`,
  winners: (year: number | string) => `/beers/${year}/`,
  beer: (year: number | string, stem: string) => `/beers/${year}/${stem}/`,
  firstTime: (year: number | string) => `/first-time-medalists/${year}/`,
  hops: '/hops/',
  hop: (slug: string) => `/hops/${slug}/`,
  hopFarms: '/hop-farms/',
  hopFarm: (slug: string) => `/hop-farms/${slug}/`,
  reports: '/reports/',
  report: (slug: string) => `/reports/${slug}/`,
  dashboards: '/dashboards/',
  explorer: '/explorer/',
  about: '/about/',
  designSystem: '/design-system/',
};
