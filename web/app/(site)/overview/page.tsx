import { DashboardPage, dashboardMetadata } from '../dashboards/kit/DashboardPage';

export const metadata = dashboardMetadata('overview');

export default function Page() {
  return <DashboardPage kind="overview" />;
}
