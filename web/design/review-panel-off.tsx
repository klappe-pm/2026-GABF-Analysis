// Stand in for @/components/review/ReviewSettingsPanel while that component is not in the tree.
// next.config.ts aliases 'review-settings-panel' to the real component once its file exists, so this
// file stops being used the moment the panel merges. It renders nothing.
export function ReviewSettingsPanel() {
  return null;
}
