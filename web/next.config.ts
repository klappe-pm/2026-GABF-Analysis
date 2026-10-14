import type { NextConfig } from 'next';
import { resolve } from 'node:path';

// Static export. NEXT_BASE_PATH is the path the site is served under: empty at gabf.beer and for local
// builds, /GABF-Analysis on a GitHub Pages project address. Links drawn with a plain <a> go through
// href() in lib/href.ts so they carry it.
const basePath = process.env.NEXT_BASE_PATH ?? '';

// DESIGN_REVIEW=1 builds the local review mode into web/out-review: the style guide's settings become
// editable in place. Every other build, the public one included, aliases the editors to a stand in
// that only shows values, so no editing code reaches web/out.
const review = process.env.DESIGN_REVIEW === '1';

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  ...(review ? { distDir: 'out-review' } : {}),
  // The root is the repository, so the app can bundle the filter rules the current site uses
  // (site/assets/filter-bar.mjs through lib/filter-model.mjs). Build time data is not bundled: see lib/site-data.ts.
  turbopack: {
    root: resolve(__dirname, '..'),
    resolveAlias: { 'design-editor': review ? './design/editor.tsx' : './design/editor-off.tsx' },
  },
};

export default nextConfig;
