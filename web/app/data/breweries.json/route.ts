import { laneModel } from '@/lib/site-data';

// The same address and content as the current site's data/breweries.json.
export const dynamic = 'force-static';

export async function GET() {
  const { breweriesFile } = await laneModel<typeof import('@/lib/models/dashboards.mjs')>('dashboards');
  return Response.json(breweriesFile());
}
