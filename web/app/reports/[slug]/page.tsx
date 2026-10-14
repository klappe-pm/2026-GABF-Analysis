// The old /reports/<report>/ addresses. Each report moved to /analysis/<report>/; this page forwards to it.
import type { Metadata } from 'next';
import { t } from '@/lib/content';
import { analysis } from '@/app/(site)/analysis/parts/copy';
import { analysisPaths } from '@/app/(site)/analysis/parts/paths';
import { Moved, movedMetadata } from '../moved';

type Params = { slug: string };

export const dynamicParams = false;
export async function generateStaticParams(): Promise<Params[]> {
  return (await analysis()).reportParams();
}

async function target(params: Promise<Params>) {
  const slug = (await params).slug;
  const key = (await analysis()).reportKey(slug) as string;
  return { to: analysisPaths.report(slug), title: t(`pages.analysis-index.reports.${key}.title`) };
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { to, title } = await target(params);
  return movedMetadata(to, title);
}

export default async function ReportMoved({ params }: { params: Promise<Params> }) {
  const { to, title } = await target(params);
  return <Moved to={to} pageTitle={title} />;
}
