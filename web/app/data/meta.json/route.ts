import { filterData } from '@/lib/site-data';

// Years, coverage, states, lookups, and shared copy for the browser views. Same address as the current
// site's data/meta.json.
export const dynamic = 'force-static';

export async function GET() {
  return Response.json({ generated_at: new Date().toISOString(), ...(await filterData()).meta });
}
