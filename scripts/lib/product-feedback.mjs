// product-feedback, the design review and feedback tooling this repository opts into
// (product-feedback.config.json). It is a separate project and a local tool: nothing in the site build,
// continuous integration or the deploy imports it. Tests that exercise this repository's integration with
// it load it through here and skip when it is not installed.
//
// Where it is looked for: PRODUCT_FEEDBACK_DIR, then the sibling checkout ../product-feedback.

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './paths.mjs';

export const PRODUCT_FEEDBACK_DIR = resolve(process.env.PRODUCT_FEEDBACK_DIR || resolve(ROOT, '..', 'product-feedback'));
export const available = () => existsSync(resolve(PRODUCT_FEEDBACK_DIR, 'src/config.mjs'));

// A module of the package by its path under src/, or null when the package is not here.
export async function productFeedback(path) {
  if (!available()) return null;
  return import(pathToFileURL(resolve(PRODUCT_FEEDBACK_DIR, 'src', path)).href);
}

export const SKIP = available() ? false : `product-feedback is not installed at ${PRODUCT_FEEDBACK_DIR} (set PRODUCT_FEEDBACK_DIR)`;
