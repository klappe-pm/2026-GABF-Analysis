// The copy documents the site build reads (.docs/content-management-system/): every `key`: value line of
// every document under pages/ and global/, with the file and line it sits on. The review tools that edit
// these documents are product-feedback's; the format is shared, and this reader is the build's own so the
// build and continuous integration never depend on that tool.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { docKeyOf, scanContent } from './content-md.mjs';

export const CMS_DIR = '.docs/content-management-system';
export const cmsDirOf = (root, env = process.env) => resolve(env.GABF_CMS_DIR || resolve(root, CMS_DIR));

const COPY_FOLDERS = ['pages', 'global'];

const walk = (dir, keep, out = []) => {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = resolve(dir, name);
    if (statSync(full).isDirectory()) walk(full, keep, out);
    else if (keep(full)) out.push(full);
  }
  return out;
};

// The absence of the copy folder is not an error here; the build says so itself.
export function loadCopy(cmsDir) {
  const entries = [];
  for (const folder of COPY_FOLDERS) {
    for (const file of walk(resolve(cmsDir, folder), (f) => f.endsWith('.md')).sort()) {
      const rel = relative(cmsDir, file);
      const prefix = docKeyOf(rel);
      for (const e of scanContent(readFileSync(file, 'utf8'))) entries.push({ key: `${prefix}.${e.key}`, name: e.name, file: rel.split('\\').join('/'), line: e.line, value: e.value });
    }
  }
  return entries;
}
