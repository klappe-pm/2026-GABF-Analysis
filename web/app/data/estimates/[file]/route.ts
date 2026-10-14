import { explainFigure, inputItems, type Metric } from '@/app/(site)/breweries/estimate-text';
import { estimateCopy } from '@/app/(site)/breweries/copy';
import { notFound } from 'next/navigation';
import { laneModel } from '@/lib/site-data';

// One small file per brewery at /data/estimates/<brewery-slug>.json: how each estimated figure of its economics row
// was made, and the inputs it used. The economics table loads it when a reader opens an (E), so the page itself does
// not carry the data of every row.
export const dynamic = 'force-static';
export const dynamicParams = false;

type Params = { file: string };
const model = () => laneModel<typeof import('@/lib/models/analysis.mjs')>('analysis');

export async function generateStaticParams(): Promise<Params[]> {
  return (await model()).estimateSlugs().map((slug) => ({ file: `${slug}.json` }));
}

const METRICS: Metric[] = ['barrels', 'arr', 'gross_margin', 'ebitda'];

export async function GET(_request: Request, { params }: { params: Promise<Params> }) {
  const file = (await params).file;
  const found = file.endsWith('.json') ? (await model()).estimateFacts(file.slice(0, -'.json'.length)) : null;
  if (!found) notFound();
  const copy = estimateCopy();
  return Response.json({
    slug: found.slug,
    explanations: Object.fromEntries(METRICS.map((m) => [m, explainFigure(m, found.facts, copy)])),
    inputs: inputItems(found.facts, copy),
  });
}
