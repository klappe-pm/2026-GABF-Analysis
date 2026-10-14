// The copy documents a dashboard reads, whole, for the client view. lib/content.ts looks up single keys;
// the client view walks several groups, so this hands it each document as a tree.
import { parseContent } from '@/lib/content';
import { readRepo } from '@/lib/repo';
import type { CopyNode, CopyTree } from './copy';

const CMS = '.docs/content-management-system';
const doc = (group: 'global' | 'pages', name: string) => parseContent(readRepo(CMS, group, `${name}.md`)) as CopyNode;

export function dashboardCopy(): CopyTree {
  return { page: doc('pages', 'dashboards'), charts: doc('global', 'charts'), states: doc('global', 'states'), labels: doc('global', 'labels'), tables: doc('global', 'tables') };
}
