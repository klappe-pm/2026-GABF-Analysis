// The old /explorer/ address. The standalone explorer is retired; its unique features live on Explore under
// Analysis, and this page forwards there.
import type { Metadata } from 'next';
import { t } from '@/lib/content';
import { analysisPaths } from '@/app/(site)/analysis/parts/paths';
import { Moved, movedMetadata } from '@/app/(site)/analysis/parts/moved';

const title = () => t('pages.explore.header.title');

export const generateMetadata = (): Metadata => movedMetadata(analysisPaths.explore, title());

export default function ExplorerMoved() {
  return <Moved to={analysisPaths.explore} pageTitle={title()} />;
}
