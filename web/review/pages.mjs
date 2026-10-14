// The copy page id of each route: the name of the file under .docs/content-management-system/pages/ that
// holds the page's words. The review settings panel files its tickets under it (docs/feedback/<page>/), and
// the panel works out a wrong id for some routes when it is not told, so the widget always tells it.
// A segment written <x> stands for any one segment (a year, a slug).
const TABLE = [
  ['/', 'home'],
  ['/dashboards/', 'dashboards'],
  ['/dashboards/<x>/', 'dashboards'],
  ['/explorer/', 'explorer'],
  ['/beers/<x>/', 'beers-index'],
  ['/beers/<x>/<x>/', 'beer-detail'],
  ['/first-time-medalists/<x>/', 'first-time-medalists'],
  ['/breweries/', 'breweries-index'],
  ['/breweries/<x>/', 'brewery-detail'],
  ['/categories/', 'results-by-category'],
  ['/categories/<x>/', 'category-detail'],
  ['/reports/', 'analysis-index'],
  ['/reports/<x>/', 'analysis-report'],
  ['/about/', 'about'],
  ['/method/', 'method'],
  ['/saved-views/', 'saved-views'],
  ['/hops/', 'hops'],
  ['/hops/<x>/', 'hop-detail'],
  ['/hop-farms/', 'hop-farms'],
  ['/hop-farms/<x>/', 'hop-farm-detail'],
  ['/design-system/', 'design-system'],
];

export const PAGES = TABLE;

const parts = (route) => String(route).split(/[?#]/)[0].split('/').filter(Boolean);

// The page id for a route, or undefined when the table has none (the 404 page, a route not ported yet).
export function copyPageFor(route) {
  const want = parts(route);
  const hit = TABLE.find(([pattern]) => {
    const have = parts(pattern);
    return have.length === want.length && have.every((p, i) => p === '<x>' || p === want[i]);
  });
  return hit ? hit[1] : undefined;
}
