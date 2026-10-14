#!/usr/bin/env node
// Draw each component's spec image, saved as .design/design-system/components/<name>/<name>.png:
//   components built in web/ from the built style guide (the states under the component's heading on
//   /design-system), and components the current public site still draws from the built site in dist/.
// Run npm run web:build and npm run build first. Needs Playwright (see serve-out.mjs for
// PLAYWRIGHT_MODULE and PLAYWRIGHT_CHANNEL).

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from '../lib/paths.mjs';
import { COMPONENTS_DIR, loadSpecs, rel } from './lib.mjs';
import { OUT, launch, openStyleGuide, serveOut } from './serve-out.mjs';

// Where the public site draws each component that is not yet in web/: a page and the element to draw.
const SITE = {
  footer: ['/index.html', '.site-footer'],
  tabs: ['/dashboards/breweries/index.html', 'nav.dash-nav'],
  chips: ['/index.html', '.coverage'],
  'side-sheet': ['/explorer/index.html', 'aside.sidebar'],
  'explorer-app': ['/explorer/index.html', 'body'],
};

async function main() {
  if (!existsSync(resolve(OUT, 'design-system/index.html'))) { console.log('web/out is missing: run npm run web:build'); process.exit(1); }
  const dist = resolve(ROOT, 'dist');
  const web = await serveOut();
  const site = existsSync(resolve(dist, 'index.html')) ? await serveOut(dist) : null;
  const browser = await launch();
  const context = await browser.newContext({ viewport: { width: 1024, height: 900 }, deviceScaleFactor: 1, colorScheme: 'light', reducedMotion: 'reduce' });
  const page = await openStyleGuide(context, `http://127.0.0.1:${web.address().port}`);
  let missing = 0;
  for (const s of loadSpecs()) {
    const file = resolve(COMPONENTS_DIR, s.dir, `${s.dir}.png`);
    if (SITE[s.dir]) {
      if (!site) { console.log(`dist is missing for ${s.dir}: run npm run build`); missing += 1; continue; }
      const p = await context.newPage();
      await p.goto(`http://127.0.0.1:${site.address().port}${SITE[s.dir][0]}`, { waitUntil: 'networkidle' });
      const el = p.locator(SITE[s.dir][1]).first();
      if (!(await el.count())) { console.log(`no ${SITE[s.dir][1]} on ${SITE[s.dir][0]} for ${s.dir}`); missing += 1; await p.close(); continue; }
      if (s.dir === 'explorer-app') await p.screenshot({ path: file, animations: 'disabled' });
      else await el.screenshot({ path: file, animations: 'disabled' });
      await p.close();
      console.log(`wrote ${rel(file)}`);
      continue;
    }
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
  site?.close();
  process.exit(missing ? 1 : 0);
}

main();
