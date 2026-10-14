// The facts behind the estimated figures of a brewery, for the per-brewery file its economics row loads when an (E)
// is opened. Kept apart from analysis.mjs because it reads the breweries model, which reads the shared site model
// that analysis.mjs is itself loaded by.

import { site } from '../site-model.mjs';
import { estimateOf } from './breweries.mjs';

// The facts behind one brewery's estimated figures, for the file its economics row loads when an (E) is opened.
export const estimateSlugs = () => site().ds.breweries.filter((b) => b.medals.length).map((b) => b.slug);
export function estimateFacts(slug) {
  const { ds } = site();
  const b = ds.breweries.find((x) => x.slug === slug && x.medals.length);
  return b ? { slug: b.slug, name: b.name, facts: estimateOf(b, ds.params) } : null;
}
