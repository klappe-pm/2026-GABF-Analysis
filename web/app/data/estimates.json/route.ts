import { laneModel } from '@/lib/site-data';

// The same address and content as the current site's data/estimates.json.
export const dynamic = 'force-static';

export async function GET() {
  const { estimatesFile } = await laneModel<typeof import('@/lib/models/dashboards.mjs')>('dashboards');
  return Response.json(estimatesFile());
}
