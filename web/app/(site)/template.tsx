import type { ReactNode } from 'react';
import { WebReview } from 'web-review';

// Mounts the review tools on every site page without touching the site frame (layout.tsx and shell/), which
// the foundation owns. The review settings panel is mounted inside the widget's own panel. In the public
// build the widget is a stand in that renders nothing, so a page here is its children and no more. The alias
// is chosen in next.config.ts. When the foundation mounts the widget in the frame itself, delete this file.
export default function SiteTemplate({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <WebReview />
    </>
  );
}
