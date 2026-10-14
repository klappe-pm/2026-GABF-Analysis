import type { ReactNode } from 'react';

type Props = {
  kind: 'empty' | 'loading' | 'error' | 'notice';
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  stamp?: ReactNode;
};

// Empty, loading, error, and notice states written as notes on the form, in place of the view they replace.
export function FormNote({ kind, title, children, action, stamp }: Props) {
  if (kind === 'loading') {
    return (
      <div role="status" aria-live="polite" className="flex flex-col gap-3 border border-rule px-4 py-4">
        <p className="font-narrow text-label uppercase text-ink-muted">{title}</p>
        <div className="flex flex-col gap-2" aria-hidden="true">
          {['w-full', 'w-5/6', 'w-2/3', 'w-3/4'].map((w) => (
            <span key={w} className={`skeleton-line block h-3 border-b border-rule bg-ground-tone ${w}`} />
          ))}
        </div>
      </div>
    );
  }
  const frame = kind === 'error' ? 'border-red bg-red-tint' : kind === 'notice' ? 'border-rule border-l-red' : 'border-rule';
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={`flex flex-col gap-2 border px-4 py-4 ${frame}`}>
      <div className="flex flex-wrap items-center gap-3">
        {stamp}
        <p className={`text-body font-semibold ${kind === 'error' ? 'text-red' : 'text-ink'}`}>{title}</p>
      </div>
      {children ? <div className="max-w-measure text-data text-ink-muted">{children}</div> : null}
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
