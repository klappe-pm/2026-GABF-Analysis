// Reapply a ticket's recorded edits in a clean checkout, deterministically, from the old and new
// values the ticket holds. Copy edits go through the same byte preserving writer the review server
// used (applyContentEdit); setting edits change only the value text where the old value sits next
// to its key. A value that is no longer the old one is not guessed at: the job stops.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { applyContentEdit, cmsDirOf, findInstances, loadCopy } from './review-content.mjs';

const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Copy edits: the same instances the reviewer ticked, found again by key (copy) or by file and line
// (source), because a source instance's character offset belongs to the checkout it was read in.
export function applyRecordedContentEdit(root, edit, { sanitize } = {}) {
  const cmsDir = cmsDirOf(root, {});
  const copy = loadCopy(cmsDir);
  const primary = copy.find((e) => e.key === edit.key);
  if (!primary) throw new Error(`Copy entry ${edit.key} is not in this checkout.`);
  if (primary.value === edit.new) throw new Error(`Copy entry ${edit.key} already reads the new words, so there is nothing to change.`);
  if (primary.value !== edit.old) throw new Error(`Copy entry ${edit.key} no longer reads "${edit.old}" (it reads "${primary.value}"), so the recorded change cannot be applied as it stands.`);
  const recorded = edit.instances ?? [];
  const take = findInstances(root, cmsDir, primary, edit.old, { copy })
    .filter((i) => recorded.some((r) => (i.kind === 'copy' ? r.kind === 'copy' && r.key === i.key : r.kind === 'source' && r.file === i.file && Number(r.line) === i.line)))
    .map((i) => i.id);
  return applyContentEdit(root, { cmsDir, key: edit.key, newValue: edit.new, take, sanitize });
}

// Setting edits: { file, key, old, new }. The key's last segment is looked for as a JSON or YAML key
// or a CSS custom property, followed by the old value, and exactly one place must match.
export function applySettingEdit(root, edit) {
  const abs = resolve(root, edit.file);
  const inside = abs.startsWith(resolve(root) + sep);
  const parts = abs.slice(resolve(root).length + 1).split(sep);
  if (!inside || parts.includes('.git') || parts.includes('node_modules')) throw new Error(`${edit.file} is outside the repository's source files.`);
  if (!existsSync(abs)) throw new Error(`${edit.file} is not in this checkout.`);
  const text = readFileSync(abs, 'utf8');
  const leaf = String(edit.key).split('.').pop();
  const re = new RegExp(`((?:^|[\\s"'{,;])(?:["']?)${escapeRe(leaf)}(?:["']?)\\s*[:=]\\s*)(["']?)(${escapeRe(edit.old)})(?=\\2(?:[\\s,;}]|$))`, 'gm');
  const hits = [...text.matchAll(re)];
  if (hits.length === 0) throw new Error(`${edit.file} does not hold ${leaf} set to ${edit.old}, so the recorded change cannot be applied as it stands.`);
  if (hits.length > 1) throw new Error(`${leaf} set to ${edit.old} appears ${hits.length} times in ${edit.file}, so the setting cannot be told apart.`);
  const h = hits[0];
  const at = h.index + h[1].length + h[2].length;
  writeFileSync(abs, text.slice(0, at) + String(edit.new) + text.slice(at + String(edit.old).length));
  return { file: edit.file, key: edit.key, old: edit.old, new: edit.new };
}
