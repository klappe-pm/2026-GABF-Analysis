// What a ticket records about where the reviewer is: the job, the journey step, the state, the
// route, and the page's plain name, all taken from the design manifest and the surface sketches.

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const MANIFEST_PATH = 'docs/design/design-nodes.json';
export const loadManifest = (root) => JSON.parse(readFileSync(resolve(root, MANIFEST_PATH), 'utf8'));

export const kebab = (text) => String(text).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// The page's plain name: the label its surface's sketch shows in the control plane's bar, in
// lowercase kebab case ("Overview dashboard" is overview-dashboard).
export function pageNameOf(root, manifest, surfaceName) {
  const surface = manifest.surfaces[surfaceName];
  if (!surface) return kebab(surfaceName);
  const file = resolve(root, 'docs/design/sketches', surface.sketch);
  if (existsSync(file)) {
    const label = /<span class="dcp-crumbs">([^<]+)<\/span>/.exec(readFileSync(file, 'utf8'));
    if (label) return kebab(label[1]);
  }
  return kebab(surfaceName);
}

export function surfaceOf(manifest, screenId) {
  const hit = Object.entries(manifest.surfaces).find(([, s]) => s.screens.includes(screenId));
  return hit ? { name: hit[0], ...hit[1] } : null;
}

export function jobOf(manifest, screenId) {
  for (const [id, node] of Object.entries(manifest.nodes)) {
    if (id.startsWith('journey:') && node.consumes.includes(`screen:${screenId}`)) return { id: id.slice('journey:'.length), title: node.content };
  }
  return null;
}

// The facts a ticket records for a screen. Null for an id the manifest does not know.
export function describeScreen(root, manifest, screenId) {
  const node = manifest.nodes[`screen:${screenId}`];
  const surface = surfaceOf(manifest, screenId);
  if (!node || !surface) return null;
  const state = node.state ?? {};
  const job = jobOf(manifest, screenId);
  return {
    step: screenId,
    job: job?.id ?? null,
    jobTitle: job?.title ?? null,
    state: node.content,
    statePath: node.path,
    surface: surface.name,
    page: pageNameOf(root, manifest, surface.name),
    route: state.route || surface.route,
    hash: state.hash || '',
    served: state.served || 'site',
    frame: state.frame || 'desktop',
  };
}

// The regions the control plane marks: one per screen, and one per action chip. Both are plain
// selectors into the built page, kept in the manifest so a screen's mapping is data, not code.
export function regionsPayload(manifest) {
  const screens = {};
  for (const [id, node] of Object.entries(manifest.nodes)) {
    if (!id.startsWith('screen:')) continue;
    const region = node.state?.region ?? null;
    screens[id.slice('screen:'.length)] = region;
  }
  return { screens, controls: manifest.controls ?? {} };
}

// ---------- the web review build: a page is found by its route ----------

const segments = (route) => String(route).split('?')[0].split('#')[0].split('/').filter(Boolean);

// Every screen of the manifest in step order, each with its page's route, for a reviewer to choose from.
export function listScreens(root, manifest) {
  const out = [];
  for (const [id, node] of Object.entries(manifest.nodes)) {
    if (!id.startsWith('screen:')) continue;
    const screen = describeScreen(root, manifest, id.slice('screen:'.length));
    if (screen) out.push({ id: screen.step, label: `${screen.step} ${screen.state}`, page: screen.page, surface: screen.surface, route: screen.route, path: node.path });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
}

// The steps whose page a route belongs to: a page with the route itself first, then a page of the same
// shape (the same address with a different last segment, such as another brewery), each in step order.
// A route that matches no page returns an empty list and the reviewer picks the step.
export function screensForRoute(root, manifest, route) {
  const want = segments(route);
  const all = listScreens(root, manifest);
  const exact = all.filter((s) => segments(s.route).join('/') === want.join('/'));
  if (exact.length) return exact;
  if (want.length < 2) return [];
  return all.filter((s) => {
    const have = segments(s.route);
    return have.length === want.length && have.slice(0, -1).join('/') === want.slice(0, -1).join('/');
  });
}
