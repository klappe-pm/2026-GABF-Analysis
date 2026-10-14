// The addresses of the five dashboards, in tab order.
import type { DashboardKind } from './Dashboard';

export const DASHBOARD_PATHS: Record<DashboardKind, string> = {
  overview: '/overview/',
  geography: '/dashboards/geography/',
  categories: '/dashboards/categories/',
  breweries: '/dashboards/breweries/',
  economics: '/dashboards/economics/',
};
export const DASHBOARD_KINDS = Object.keys(DASHBOARD_PATHS) as DashboardKind[];
