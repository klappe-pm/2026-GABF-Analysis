// The site's destinations and which sections each one owns, kept free of React so the tests can read them.
// The frame (frame.tsx) labels them from the copy and hands them to the shell; the shell marks the current one.
// Ids follow layout.md "Site navigation" (SITE_NAVIGATION in web/design/schema.ts); copy keys are under
// global.navigation.header.

// The destinations the rail and the tabs show. Each owns the sections listed in its match.
export function primaryDestinations(paths, winnerYear) {
  return [
    { id: 'home', copy: 'home', icon: 'home', path: paths.home, match: [paths.home] },
    // The medal record: the Overview dashboard and the dashboards beside it, and the category pages.
    { id: 'results', copy: 'results', icon: 'medal', path: paths.overview, match: [paths.overview, paths.dashboards, paths.categories] },
    { id: 'breweries', copy: 'breweries', icon: 'brewery', path: paths.breweries, match: [paths.breweries, '/first-time-medalists/'] },
    { id: 'beers', copy: 'beers', icon: 'beer', path: paths.winners(winnerYear), match: ['/beers/'] },
    { id: 'hops', copy: 'hops', icon: 'hop', path: paths.hops, match: [paths.hops] },
    { id: 'hop-farms', copy: 'hop_farms', icon: 'farm', path: paths.hopFarms, match: [paths.hopFarms] },
    // Analysis keeps the old report addresses and the retired explorer, which fold into it.
    { id: 'analysis', copy: 'analysis', icon: 'chart', path: paths.analysis, match: [paths.analysis, paths.reports, paths.explorer] },
  ];
}

// Further sections the drawer lists under the destinations.
export function moreDestinations(paths) {
  return [
    { id: 'categories', copy: 'categories', icon: 'list', path: paths.categories, match: [paths.categories] },
    { id: 'saved-views', copy: 'saved_views', icon: 'bookmark', path: paths.saved, match: [paths.saved] },
  ];
}

// The destination a path belongs to: the item whose match list holds the longest prefix of the path; on a
// tie the earlier item wins. The home match '/' matches the home page only.
export function activeItem(items, pathname) {
  let best;
  for (const item of items) {
    for (const m of item.match) {
      const hit = m === '/' ? pathname === '/' : pathname.startsWith(m);
      if (hit && (!best || m.length > best.len)) best = { id: item.id, len: m.length };
    }
  }
  return best?.id;
}
