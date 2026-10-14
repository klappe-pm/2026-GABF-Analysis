import type { NextConfig } from 'next';
import { resolve } from 'node:path';

// Static export for GitHub Pages. NEXT_BASE_PATH is the Pages base path (for example /GABF-Analysis);
// it is empty for local builds.
const basePath = process.env.NEXT_BASE_PATH ?? '';

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  turbopack: { root: resolve(__dirname) },
};

export default nextConfig;
