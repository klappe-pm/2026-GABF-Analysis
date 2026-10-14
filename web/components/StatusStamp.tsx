'use client';

import { useSettings } from '@/design/runtime';
import { color, labelFace, onColor, shape } from '@/design/helpers';

// A data status label (Partial, Not loaded, Estimate) on a small container. Never for categories or tags.
export function StatusStamp({ label, meaning }: { label: string; meaning?: string }) {
  const s = useSettings('status-stamp');
  const role = s['Container color'] ?? 'tertiary container';
  return (
    <span
      className="type-label-medium inline-flex min-h-6 items-center px-2"
      style={{ background: color(role), color: onColor(role), borderRadius: shape(s.Shape ?? 'small'), ...labelFace(label) }}
      title={meaning}
    >
      {label}
      {meaning ? <span className="sr-only">: {meaning}</span> : null}
    </span>
  );
}
