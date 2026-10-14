// The public build's stand in for the review mode editors (web/design/editor.tsx): it shows the value
// and nothing else, so the published site carries no editing code. next.config.ts picks one of the two.
import type { ReactNode } from 'react';
import type { Value } from './schema';

export const REVIEW = false;

export function ReviewPage({ children }: { page?: string; children: ReactNode }) {
  return <>{children}</>;
}

export function EditableValue({ children }: { target: string; k: string; value: Value; children: ReactNode }) {
  return <>{children}</>;
}
