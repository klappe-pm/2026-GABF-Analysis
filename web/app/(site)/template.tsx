import type { ReactNode } from 'react';
import { ReviewSettingsPanel } from 'review-settings-panel';
import { WebReview } from 'web-review';

// Mounts the review tools on every site page without touching the site frame (layout.tsx and shell/), which
// the foundation owns. In the public build both are stand ins that render nothing, so a page here is its
// children and no more. The aliases are chosen in next.config.ts. When the foundation mounts the tools in the
// frame itself, delete this file.
export default function SiteTemplate({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ReviewSettingsPanel />
      <WebReview />
    </>
  );
}
