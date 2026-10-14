// The review settings panel: mount <ReviewSettingsPanel /> (optionally with page="<page id>", or inline
// inside a host's own container) anywhere under the DesignSettings provider. The review build
// (DESIGN_REVIEW=1) resolves the alias to the panel; every other build, the public one included, resolves
// it to a stand in that renders nothing, so no panel code is bundled (see next.config.ts).
export { ReviewSettingsPanel, type ReviewSettingsPanelProps } from 'review-settings-panel';
