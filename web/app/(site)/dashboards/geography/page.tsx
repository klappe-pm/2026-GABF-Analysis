import { DashboardPage, dashboardMetadata } from '../kit/DashboardPage';

export const metadata = dashboardMetadata('geography');

export default function Page() {
  return <DashboardPage kind="geography" />;
}
