// A status set the way a clerk stamps a form: red pen, a heavy ruled box, uppercase narrow letters.
// Used for data status only (Partial, Not loaded, Draft, Estimate), never for categories or tags.

export function StatusStamp({ label, meaning }: { label: string; meaning?: string }) {
  return (
    <span className="inline-flex items-center border-2 border-stamp px-2 py-0 font-narrow text-micro uppercase leading-snug text-stamp" title={meaning}>
      {label}
      {meaning ? <span className="sr-only">: {meaning}</span> : null}
    </span>
  );
}
