import { filterData } from '@/lib/site-data';

// Every decorated medal row, the file the global filter and the dashboards read in the browser. Same
// address and content as the current site's data/results.json.
export const dynamic = 'force-static';

export async function GET() {
  return Response.json((await filterData()).results);
}
