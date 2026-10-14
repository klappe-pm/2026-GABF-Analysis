import type { ReactNode } from 'react';
import { WebReview } from 'web-review';
import { reviewCopy } from '@/review/copy';

// Mounts the review widget on every site page without touching the site frame (layout.tsx and shell/), which
// the foundation owns. The widget's words are read here, on the server, from the copy documents, and only in
// the review build: the public build reads none of them and mounts a stand in that renders nothing, so a
// page here is its children and no more. The review settings panel is mounted inside the widget's own panel.
// The alias is chosen in next.config.ts. When the foundation mounts the widget in the frame, delete this file.
export default function SiteTemplate({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <WebReview copy={reviewCopy()} />
    </>
  );
}
