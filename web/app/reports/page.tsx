// The old /reports/ address. The reports moved to /analysis/; this page forwards to it.
import type { Metadata } from 'next';
import { t } from '@/lib/content';
import { analysisPaths } from '@/app/(site)/analysis/parts/paths';
import { Moved, movedMetadata } from './moved';

const title = () => t('pages.analysis-index.header.title');

export const generateMetadata = (): Metadata => movedMetadata(analysisPaths.index, title());

export default function ReportsMoved() {
  return <Moved to={analysisPaths.index} pageTitle={title()} />;
}
