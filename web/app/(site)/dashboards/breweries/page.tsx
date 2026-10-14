import { DashboardPage, dashboardMetadata } from '../kit/DashboardPage';

export const metadata = dashboardMetadata('breweries');

export default function Page() {
  return <DashboardPage kind="breweries" />;
}
