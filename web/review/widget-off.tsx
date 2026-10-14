// The public build's stand in for the review widget (web/review/widget.tsx): it renders nothing and
// imports nothing, so the published site carries no review code. next.config.ts picks one of the two.
export function WebReview(_props: { copy?: Record<string, string> }) {
  return null;
}
