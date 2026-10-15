// The site build reads its visible copy from the copy documents in .docs/content-management-system/
// (the same files the review tools edit), so a change to one key reaches every page that draws it
// on the next build. Only keys that exist there are read this way; a string with no key stays in
// the page code until one is added.
//
// The copy folder is tracked in git, so a clean clone and continuous integration have it. If the
// folder or a requested key is missing the build stops and says which one, rather than printing a
// page with a blank or a stale word in it.

import { existsSync } from 'node:fs';
import { CMS_DIR, cmsDirOf, loadCopy } from './cms.mjs';
import { ROOT } from './paths.mjs';

// copy('global.site.header.skip_link') returns the text. copy('pages.x.y', { year: 2026 }) fills
// {{year}}; a placeholder with no value is an error, not a silent blank.
export function createSiteCopy(entries, where = CMS_DIR) {
  const values = new Map();
  for (const e of entries) values.set(e.key, e.value);
  // The keys the build has read, so the review tools can tell which entry draws a given word.
  const used = new Set();
  const copy = (key, tokens = {}) => {
    used.add(key);
    if (!values.has(key)) throw new Error(`The site build needs the copy entry ${key}, but ${where} does not have it. Add it to the copy document, or run: git checkout -- ${CMS_DIR}`);
    return values.get(key).replace(/\{\{([^}]+)\}\}/g, (_, name) => {
      if (!Object.hasOwn(tokens, name.trim())) throw new Error(`The copy entry ${key} has the placeholder {{${name}}} and the build gave it no value.`);
      return String(tokens[name.trim()]);
    });
  };
  copy.used = used;
  copy.has = (key) => values.has(key);
  // The entry with its {{placeholders}} unfilled, for code that fills them later (in the browser).
  copy.raw = (key) => {
    used.add(key);
    if (!values.has(key)) throw new Error(`The site build needs the copy entry ${key}, but ${where} does not have it. Add it to the copy document, or run: git checkout -- ${CMS_DIR}`);
    return values.get(key);
  };
  // Every key directly under a group, such as global.labels.brewery_type.
  copy.keysUnder = (group) => [...values.keys()].filter((k) => k.startsWith(`${group}.`) && !k.slice(group.length + 1).includes('.'));
  copy.size = values.size;
  return copy;
}

export function loadSiteCopy({ root = ROOT, env = process.env } = {}) {
  const dir = cmsDirOf(root, env);
  if (!existsSync(dir)) throw new Error(`The site copy folder is missing: ${dir}. It is tracked in git; run: git checkout -- ${CMS_DIR}`);
  const entries = loadCopy(dir);
  if (!entries.length) throw new Error(`The site copy folder ${dir} has no copy documents under pages/ or global/.`);
  return createSiteCopy(entries, dir);
}
