import type { ReactNode } from 'react';
import { SiteFrame } from './shell/frame';

// Every public page sits in this group and gets the site frame. The design system page lives outside
// it, with its own navigation of sections. shell/ holds the frame's parts; with no page file it is not a route.
export default function SiteLayout({ children }: { children: ReactNode }) {
  return <SiteFrame>{children}</SiteFrame>;
}
