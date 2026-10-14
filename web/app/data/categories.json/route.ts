import { laneModel } from '@/lib/site-data';

// The same address and content as the current site's data/categories.json.
export const dynamic = 'force-static';

export async function GET() {
  const { categoriesFile } = await laneModel<typeof import('@/lib/models/dashboards.mjs')>('dashboards');
  return Response.json(categoriesFile());
}
