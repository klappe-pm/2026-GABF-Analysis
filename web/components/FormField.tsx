import type { ReactNode } from 'react';

// A numbered form field: a ruled box with its number in judging green, its label in the narrow face,
// and its value or control below. Fields sit in a FieldGrid that shares hairlines between boxes.

export function FieldGrid({ children, columns = 'sm:grid-cols-2 lg:grid-cols-4', label }: { children: ReactNode; columns?: string; label?: string }) {
  return (
    <dl aria-label={label} className={`grid grid-cols-1 border-t border-l border-rule ${columns}`}>
      {children}
    </dl>
  );
}

function FieldHead({ number, label, htmlFor, id }: { number: string; label: string; htmlFor?: string; id?: string }) {
  const text = <span className="font-narrow text-label uppercase text-ink-muted">{label}</span>;
  return (
    <span className="flex items-baseline gap-2">
      <span className="font-narrow text-micro tabular-nums text-green" aria-hidden="true">{number}</span>
      {htmlFor ? <label htmlFor={htmlFor} id={id}>{text}</label> : <span id={id}>{text}</span>}
    </span>
  );
}

// A field showing a recorded value (inside a FieldGrid, so it is a term and its description).
export function Field({ number, label, children, note, wide = false, size = 'figure' }: { number: string; label: string; children: ReactNode; note?: ReactNode; wide?: boolean; size?: 'figure' | 'text' }) {
  return (
    <div className={`flex flex-col gap-2 border-r border-b border-rule px-3 py-3 ${wide ? 'sm:col-span-2' : ''}`}>
      <dt><FieldHead number={number} label={label} /></dt>
      <dd className={size === 'figure' ? 'text-figure tabular-nums' : 'text-lead font-medium'}>{children}</dd>
      {note ? <dd className="text-data text-ink-muted">{note}</dd> : null}
    </div>
  );
}

// A field holding an input control; the label is a real label for the control.
export function ControlField({ number, label, htmlFor, children, hint, error, className = '' }: { number: string; label: string; htmlFor: string; children: ReactNode; hint?: string; error?: string; className?: string }) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <FieldHead number={number} label={label} htmlFor={htmlFor} />
      {children}
      {hint ? <p id={`${htmlFor}-hint`} className="text-data text-ink-muted">{hint}</p> : null}
      {error ? <p id={`${htmlFor}-error`} className="text-data text-red">{error}</p> : null}
    </div>
  );
}
