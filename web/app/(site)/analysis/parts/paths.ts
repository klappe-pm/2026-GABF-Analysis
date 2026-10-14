// The addresses of the analysis section. The reports were at /reports/ before the owner moved them to /analysis/;
// the old addresses stay as redirect pages (web/app/reports/). Move these into lib/href.ts when the foundation
// takes the patch that replaces paths.reports and paths.report.
export const analysisPaths = {
  index: '/analysis/',
  report: (slug: string) => `/analysis/${slug}/`,
  explore: '/analysis/explore/',
  method: '/method/',
  savedViews: '/saved-views/',
  oldIndex: '/reports/',
  oldReport: (slug: string) => `/reports/${slug}/`,
};
