import { laneModel } from '@/lib/site-data';

// The results and reference tables as files, at the addresses the current site serves them: /data/csv/<file>.
// Each file name is a static param, so only files that exist are built.
export const dynamic = 'force-static';
export const dynamicParams = false;

const model = () => laneModel<typeof import('@/lib/models/dashboards.mjs')>('dashboards');

export async function generateStaticParams() {
  return (await model()).csvNames().map((file) => ({ file }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const body = (await model()).csvFile(file);
  if (body === null) return new Response('Not found', { status: 404 });
  return new Response(body, { headers: { 'Content-Type': file.endsWith('.json') ? 'application/json; charset=utf-8' : 'text/csv; charset=utf-8' } });
}
