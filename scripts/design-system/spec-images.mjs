#!/usr/bin/env node
// Draw each component's spec image, saved as .design/design-system/components/<name>/<name>.png, from the built
// style guide (the states under the component's heading on /design-system). Run npm run web:build first. Needs
// Playwright (see serve-out.mjs for PLAYWRIGHT_MODULE and PLAYWRIGHT_CHANNEL).

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { COMPONENTS_DIR, loadSpecs, rel } from './lib.mjs';
import { OUT, launch, openStyleGuide, serveOut } from './serve-out.mjs';

// Components only the retired static site drew, with no sample in the style guide yet: their images are kept as
// they are until each moves to web/.
const RETIRED = new Set(['footer', 'tabs', 'chips']);

async function main() {
  if (!existsSync(resolve(OUT, 'design-system/index.html'))) { console.log('web/out is missing: run npm run web:build'); process.exit(1); }
  const web = await serveOut();
  const browser = await launch();
  const context = await browser.newContext({ viewport: { width: 1024, height: 900 }, deviceScaleFactor: 1, colorScheme: 'light', reducedMotion: 'reduce' });
  const page = await openStyleGuide(context, `http://127.0.0.1:${web.address().port}`);
  let missing = 0;
  for (const s of loadSpecs()) {
    const file = resolve(COMPONENTS_DIR, s.dir, `${s.dir}.png`);
    if (RETIRED.has(s.dir)) { console.log(`kept ${rel(file)}: drawn only by the retired static site`); continue; }
    const el = page.locator(`#component-${s.dir}-sample`);
    if (!(await el.count())) { console.log(`no sample on the page for ${s.dir}`); missing += 1; continue; }
    // A sample far down the page captures blank unless it is scrolled into view first.
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await el.screenshot({ path: file, animations: 'disabled' });
    console.log(`wrote ${rel(file)}`);
  }
  await browser.close();
  web.close();
  process.exit(missing ? 1 : 0);
}

main();
