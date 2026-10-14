import { DashboardPage, dashboardMetadata } from '../kit/DashboardPage';

export const metadata = dashboardMetadata('categories');

export default function Page() {
  return <DashboardPage kind="categories" />;
}
