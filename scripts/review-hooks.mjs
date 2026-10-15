// The review hooks product-feedback's review server takes from this repository (review.hooks in
// product-feedback.config.json): the web review build it serves, the rebuild after a copy edit, and the
// design system's setting edits with the picture each settings ticket carries.
//
//   npm run review       port 4173, the feedback pipeline on
//   npm run web:review   port 4176, the pipeline off
//
// Both build the site with the review widget (WEB_REVIEW=1, into web/out-web-review) and then start
// product-feedback review serve, bound to 127.0.0.1 only.

import { execFileSync } from 'node:child_process';

export const WEB_DIR = 'web/out-web-review';

export default async function reviewHooks({ root, origin, loadPlaywright, chromiumPath }) {
  // A copy change is written to the copy documents, so the review build is made again for the page to show it.
  // The server waits for it (a few seconds), so the page reloads on the new words and a second edit cannot overlap.
  const rebuild = () => {
    execFileSync('npm', ['run', 'build', '--prefix', 'web'], { cwd: root, env: { ...process.env, WEB_REVIEW: '1', DESIGN_REVIEW: '1' }, stdio: 'ignore' });
  };

  // The picture a settings ticket carries: the edited component's states, or the settings row for a site wide
  // setting, drawn on the style guide page of this same server from the files just saved.
  const edits = await import('./design-system/edit.mjs');
  let browser = null;
  async function capture({ target, key, path }) {
    const playwright = await loadPlaywright({ root });
    browser ??= await playwright.chromium.launch({ executablePath: chromiumPath() });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    try {
      await page.goto(`${origin}/design-system/`, { waitUntil: 'networkidle' });
      await page.waitForSelector('html[data-settings-applied="true"]', { timeout: 20000 });
      const el = target === 'settings' ? page.locator(`tr:has([data-setting=${JSON.stringify(`settings:${key}`)}])`) : page.locator(`#component-${target}-sample`);
      if (!(await el.count())) return false;
      await page.evaluate(() => document.fonts.ready);
      await el.first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await el.first().screenshot({ path, animations: 'disabled' });
      return true;
    } finally {
      await page.close();
    }
  }

  return {
    webDir: WEB_DIR,
    rebuild,
    design: { edits, capture },
    banner: ['open Feedback at the bottom right of any page; Escape closes the panel'],
  };
}
