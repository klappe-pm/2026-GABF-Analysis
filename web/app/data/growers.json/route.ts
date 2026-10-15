import { laneModel } from '@/lib/site-data';

// The same address and content as the current site's data/growers.json: one record per hop grower.
export const dynamic = 'force-static';

export async function GET() {
  const { growersFile } = await laneModel<typeof import('@/lib/models/hops.mjs')>('hops');
  return Response.json(growersFile());
}
