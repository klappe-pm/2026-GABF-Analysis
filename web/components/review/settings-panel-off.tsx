// The public build's stand in for the review settings panel (settings-panel.tsx): it renders nothing and
// imports nothing, so no panel or editing code reaches the published site. next.config.ts picks one.
// `copy` is the review_panel group of the design system copy, passed by the page that mounts the panel.
export type ReviewSettingsPanelProps = { page?: string; inline?: boolean; defaultOpen?: boolean; copy: Record<string, string> };

export function ReviewSettingsPanel(_props: ReviewSettingsPanelProps) {
  return null;
}
