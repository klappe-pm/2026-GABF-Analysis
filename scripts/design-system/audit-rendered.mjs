#!/usr/bin/env node
// Audit the built style guide (web/out) in a real browser at phone and desktop width. Fails on:
//   a font outside Public Sans and Archivo Narrow, inside Material's shadow roots too;
//   figures set in Archivo Narrow, or figures that are not tabular in the body face;
//   horizontal overflow;
//   a data table whose cells wrap or are not left aligned, whose header row is not bold, or that scrolls
//   the page instead of its own container;
//   a page that changes when the browser asks for a dark scheme (the site has one light theme);
//   a built page (home, design system, not found) whose background is not pure white, or whose footer
//   lacks the Catalog.beer attribution;
//   motion that keeps running when the browser asks for reduced motion;
//   a keyboard stop with no visible focus indicator.
// Run npm run web:build first. Needs Playwright (see serve-out.mjs for PLAYWRIGHT_MODULE and PLAYWRIGHT_CHANNEL).

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { OUT, launch, openStyleGuide, serveOut } from './serve-out.mjs';

// Runs in the page: fonts and figures, walking into shadow roots.
function fontsAndFigures() {
  const bad = [];
  const where = (el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}.${String(el.getAttribute('class') ?? '').slice(0, 30)}`;
  const banned = /(^|,\s*)"?(system-ui|Inter|-apple-system|BlinkMacSystemFont|Roboto|Helvetica Neue|Segoe UI|Arial)"?(,|$)/i;
  // Every face that sets visible text: text nodes (a slotted node renders in its slot's style) and text inputs.
  const visit = (root) => {
    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) visit(el.shadowRoot);
      if (el.matches('input:not([type=checkbox]):not([type=radio]):not([type=hidden]), textarea') && (el.value || el.placeholder)) {
        const family = getComputedStyle(el).fontFamily;
        if (banned.test(family.split(',')[0])) bad.push(`${where(el)}: font ${family}`);
      }
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode;
      const el = n.assignedSlot ?? n.parentElement;
      if (!el || !n.textContent.trim() || ['SCRIPT', 'STYLE'].includes(n.parentElement?.tagName)) continue;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const first = style.fontFamily.split(',')[0];
      if (banned.test(first)) bad.push(`${where(el)}: font ${style.fontFamily} for "${n.textContent.trim().slice(0, 24)}"`);
      if (/\d/.test(n.textContent) && /Archivo Narrow/i.test(first)) bad.push(`${where(el)}: figures in Archivo Narrow: "${n.textContent.trim().slice(0, 24)}"`);
    }
  };
  document.querySelectorAll('details').forEach((d) => { d.open = true; });
  visit(document);
  const width = (text, family) => {
    const s = document.createElement('span');
    s.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font-size:20px;font-family:${family};font-variant-numeric:tabular-nums`;
    s.textContent = text;
    document.body.appendChild(s);
    const w = s.getBoundingClientRect().width;
    s.remove();
    return w;
  };
  const sans = getComputedStyle(document.body).fontFamily;
  const [a, b] = [width('1111', sans), width('0000', sans)];
  if (Math.abs(a - b) > 0.01) bad.push(`figures are not tabular in the body face: "1111" ${a.toFixed(2)}px, "0000" ${b.toFixed(2)}px`);
  if (document.documentElement.scrollWidth > document.documentElement.clientWidth) bad.push('horizontal overflow');
  return bad;
}

// Runs in the page: the table rules (settings in the data-table spec): cells never wrap, every cell is
// left aligned, the header row is bold, and a wide table scrolls inside its container, not the page.
function tableRules() {
  const bad = [];
  const tables = [...document.querySelectorAll('[data-table-scroll]')];
  if (!tables.length) bad.push('no data tables on the page');
  tables.forEach((box, i) => {
    const name = `table ${i + 1} "${box.getAttribute('aria-label') ?? ''}"`.slice(0, 60);
    const cs = getComputedStyle(box);
    if (!['auto', 'scroll'].includes(cs.overflowX)) bad.push(`${name}: its container does not scroll sideways`);
    if (box.getBoundingClientRect().right > document.documentElement.clientWidth + 0.5) bad.push(`${name}: wider than the page`);
    for (const cell of box.querySelectorAll('th, td')) {
      const s = getComputedStyle(cell);
      if (s.whiteSpace !== 'nowrap') { bad.push(`${name}: a cell wraps (white-space ${s.whiteSpace})`); break; }
      if (!['left', 'start'].includes(s.textAlign)) { bad.push(`${name}: a cell is aligned ${s.textAlign}`); break; }
    }
    for (const th of box.querySelectorAll('thead th')) {
      if (Number(getComputedStyle(th).fontWeight) < 700) { bad.push(`${name}: the header row is not bold`); break; }
    }
  });
  return bad;
}

const colorsOf = () => {
  const root = getComputedStyle(document.documentElement);
  return ['--md-sys-color-surface', '--md-sys-color-primary', '--md-sys-color-on-surface'].map((v) => root.getPropertyValue(v).trim()).concat(getComputedStyle(document.body).backgroundColor).join(' ');
};

// Animations still running (including inside shadow roots) once the page has settled.
const runningMotion = () => document.getAnimations({ subtree: true })
  .filter((a) => a.playState === 'running')
  .map((a) => {
    const t = a.effect?.getComputedTiming?.() ?? {};
    const target = a.effect?.target;
    return { what: `${target?.tagName?.toLowerCase() ?? 'unknown'} ${a.animationName ?? a.transitionProperty ?? ''}`, duration: Number(t.duration) || 0, iterations: t.iterations };
  })
  .filter((m) => m.iterations === Infinity || m.duration > 1)
  .map((m) => `running motion under reduced motion: ${m.what} (${m.duration}ms, ${m.iterations} iterations)`);

// The focused element, looking through shadow roots, and whether it shows a focus indicator.
const focusState = () => {
  let el = document.activeElement;
  const chain = [];
  while (el) { chain.push(el); el = el.shadowRoot?.activeElement ?? null; }
  const host = chain[0];
  if (!host || host === document.body) return { id: 'body', visible: true };
  const outlined = chain.some((e) => { const s = getComputedStyle(e); return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0; });
  // Material draws focus with md-focus-ring, or, on text fields and selects, a thicker primary outline (focused field).
  const ring = chain.some((e) => e.focused === true || e.shadowRoot?.querySelector('md-focus-ring[visible], [focused]'));
  const label = `${host.tagName.toLowerCase()}${host.id ? `#${host.id}` : ''} "${(host.getAttribute('aria-label') ?? host.getAttribute('label') ?? host.textContent ?? '').trim().slice(0, 30)}"`;
  return { id: label, visible: outlined || ring };
};

async function main() {
  if (!existsSync(resolve(OUT, 'design-system/index.html'))) { console.log('web/out is missing: run npm run web:build'); process.exit(1); }
  const server = await serveOut();
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await launch();
  const problems = [];
  // Every built page sits on pure white ("Page background: white" in settings.md).
  for (const path of ['/', '/design-system/', '/404.html']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${origin}${path}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('html[data-settings-applied="true"]', { timeout: 20000 });
    const bg = await page.evaluate(() => [getComputedStyle(document.body).backgroundColor, getComputedStyle(document.documentElement).backgroundColor]);
    if (bg.some((c) => c !== 'rgb(255, 255, 255)')) problems.push(`${path}: the page background is ${bg.join(' and ')}, not white`);
    // The Catalog.beer attribution its license asks for, on every page.
    const credit = await page.evaluate(() => {
      const p = document.querySelector('footer [data-attribution="catalog-beer"]');
      return p ? { text: p.textContent.replace(/\s+/g, ' ').trim(), links: [...p.querySelectorAll('a')].map((a) => `${a.textContent} ${a.getAttribute('href')}`) } : null;
    });
    const wanted = 'Some beer details are from Catalog.beer, licensed CC BY 4.0 and adapted.';
    if (!credit || credit.text !== wanted || credit.links.join('|') !== 'Catalog.beer https://catalog.beer|CC BY 4.0 https://creativecommons.org/licenses/by/4.0/') problems.push(`${path}: the footer attribution is missing or not worded as required (${JSON.stringify(credit)})`);
    await ctx.close();
  }
  for (const width of [390, 1280]) {
    const light = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: 'light' });
    const page = await openStyleGuide(light, origin);
    const lightColors = await page.evaluate(colorsOf);
    for (const b of new Set(await page.evaluate(fontsAndFigures))) problems.push(`${width}: ${b}`);
    for (const b of new Set(await page.evaluate(tableRules))) problems.push(`${width}: ${b}`);

    // Keyboard: every stop shows where focus is.
    await page.goto(`${origin}/design-system/`, { waitUntil: 'networkidle' });
    await page.waitForSelector('html[data-settings-applied="true"]');
    const seen = new Set();
    for (let i = 0; i < 80; i += 1) {
      await page.keyboard.press('Tab');
      const f = await page.evaluate(focusState);
      if (seen.has(f.id) && f.id !== 'body') continue;
      seen.add(f.id);
      if (!f.visible) problems.push(`${width}: no visible focus on ${f.id}`);
    }
    if (seen.size < 20) problems.push(`${width}: only ${seen.size} keyboard stops reached`);
    await light.close();

    const dark = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: 'dark' });
    const darkPage = await openStyleGuide(dark, origin);
    const darkColors = await darkPage.evaluate(colorsOf);
    if (darkColors !== lightColors) problems.push(`${width}: the page changes under a dark color scheme (${darkColors} against ${lightColors})`);
    await dark.close();

    const calm = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: 'light', reducedMotion: 'reduce' });
    const calmPage = await openStyleGuide(calm, origin);
    await calmPage.waitForTimeout(500);
    for (const m of new Set(await calmPage.evaluate(runningMotion))) problems.push(`${width}: ${m}`);
    await calm.close();
  }
  await browser.close();
  server.close();
  for (const p of problems) console.log(p);
  console.log(`rendered audit: ${problems.length} problem${problems.length === 1 ? '' : 's'}`);
  process.exit(problems.length ? 1 : 0);
}

main();
