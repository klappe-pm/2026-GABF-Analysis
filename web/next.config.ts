import type { NextConfig } from 'next';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Static export. NEXT_BASE_PATH is the path the site is served under: empty at gabf.beer and for local
// builds, /GABF-Analysis on a GitHub Pages project address. Links drawn with a plain <a> go through
// href() in lib/href.ts so they carry it.
const basePath = process.env.NEXT_BASE_PATH ?? '';

// DESIGN_REVIEW=1 builds the local review mode into web/out-review: the style guide's settings become
// editable in place. Every other build, the public one included, aliases the editors to a stand in
// that only shows values, so no editing code reaches web/out.
const review = process.env.DESIGN_REVIEW === '1';

// The site frame mounts ReviewSettingsPanel through the 'review-settings-panel' alias: the real component
// (components/review/ReviewSettingsPanel.tsx) once it is in the tree, an empty stand in until then.
const panel = existsSync(resolve(__dirname, 'components/review/ReviewSettingsPanel.tsx'))
  ? './components/review/ReviewSettingsPanel.tsx'
  : './review/panel-off.tsx';

// WEB_REVIEW=1 builds the feedback widget and the in place copy editor into web/out-web-review (npm run
// web:review). Every other build aliases them to a stand in that renders nothing, so no review code reaches
// the public export. WEB_DIST_DIR names another output folder, which the test of that claim builds into.
const webReview = process.env.WEB_REVIEW === '1';
const distDir = process.env.WEB_DIST_DIR ?? (webReview ? 'out-web-review' : review ? 'out-review' : undefined);

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  ...(distDir ? { distDir } : {}),
  // The root is the repository, so the app can bundle the filter rules the current site uses
  // (site/assets/filter-bar.mjs through lib/filter-model.mjs). Build time data is not bundled: see lib/site-data.ts.
  turbopack: {
    root: resolve(__dirname, '..'),
    resolveAlias: {
      'design-editor': review ? './design/editor.tsx' : './design/editor-off.tsx',
      'review-settings-panel': panel,
      'web-review': webReview ? './review/widget.tsx' : './review/widget-off.tsx',
    },
  },
};

export default nextConfig;
