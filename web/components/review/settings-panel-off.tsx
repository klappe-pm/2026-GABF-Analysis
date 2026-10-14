// The public build's stand in for the review settings panel (settings-panel.tsx): it renders nothing and
// imports nothing, so no panel or editing code reaches the published site. next.config.ts picks one.
export type ReviewSettingsPanelProps = { page?: string; inline?: boolean; defaultOpen?: boolean };

export function ReviewSettingsPanel(_props: ReviewSettingsPanelProps) {
  return null;
}
