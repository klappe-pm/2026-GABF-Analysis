// The trail above a page title, set like the reference line at the top of a form.
export function Breadcrumb({ label, items }: { label: string; items: { href?: string; text: string }[] }) {
  return (
    <nav aria-label={label}>
      <ol className="flex flex-wrap items-baseline gap-x-2 gap-y-1 font-narrow text-label uppercase text-ink-muted">
        {items.map((item, i) => (
          <li key={`${item.text}-${i}`} className="flex items-baseline gap-2">
            {i > 0 ? <span aria-hidden="true" className="text-ink-faint">/</span> : null}
            {item.href ? (
              <a href={item.href} className="underline decoration-rule-strong state-hover:text-ink state-hover:decoration-ink">{item.text}</a>
            ) : (
              <span aria-current="page" className="text-ink">{item.text}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
