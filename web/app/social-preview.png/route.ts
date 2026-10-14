import { readFileSync } from 'node:fs';
import { fromRepo } from '@/lib/repo';

// The social card for link previews (Open Graph), drawn by npm run brand:social into docs/assets.
export const dynamic = 'force-static';

export function GET() {
  return new Response(readFileSync(fromRepo('docs', 'assets', 'social-preview.png')), { headers: { 'Content-Type': 'image/png' } });
}
