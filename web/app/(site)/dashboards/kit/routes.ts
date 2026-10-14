// The addresses of the five dashboards, in tab order. The overview is the home page.
import type { DashboardKind } from './Dashboard';

export const DASHBOARD_PATHS: Record<DashboardKind, string> = {
  overview: '/',
  geography: '/dashboards/geography/',
  categories: '/dashboards/categories/',
  breweries: '/dashboards/breweries/',
  economics: '/dashboards/economics/',
};
export const DASHBOARD_KINDS = Object.keys(DASHBOARD_PATHS) as DashboardKind[];
