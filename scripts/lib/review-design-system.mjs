// A read only view of the design system folder for the review server. A request names a file under
// .design/design-system/ and gets it back: a Markdown file as a readable page with its images, its
// frontmatter as a small table and its relative links working, any other file as it is. Nothing
// outside that folder can be reached, by a parent segment, an encoded one, or a link out of it.

import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { extname, relative, resolve, sep } from 'node:path';
import { Marked } from 'marked';
import { parseFrontmatter } from './frontmatter.mjs';
import { DESIGN_SYSTEM_DIR, componentWords, obsidianUri } from './review-components.mjs';

const TYPES = {
  '.md': 'text/markdown; charset=utf-8', '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.pdf': 'application/pdf',
};

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// The absolute file a request path names, or null when it is not a file inside the design system
// folder. `rest` is the request path after the route prefix, still percent encoded.
export function designSystemFile(root, rest) {
  let decoded;
  try { decoded = decodeURIComponent(rest); } catch { return null; }
  if (!decoded || decoded.includes('\0') || decoded.includes('\\')) return null;
  const parts = decoded.split('/').filter((p) => p !== '');
  if (!parts.length || parts.some((p) => p === '..' || p === '.')) return null;
  const base = resolve(root, DESIGN_SYSTEM_DIR);
  if (!existsSync(base)) return null;
  const file = resolve(base, ...parts);
  if (!existsSync(file) || !statSync(file).isFile()) return null;
  // A link inside the folder that points out of it is refused too.
  const real = realpathSync(file);
  const realBase = realpathSync(base);
  if (real !== realBase && !real.startsWith(realBase + sep)) return null;
  return file;
}

export const designSystemType = (file) => TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';

const markdown = new Marked({
  gfm: true,
  renderer: {
    // Raw HTML in a document is shown as text, so a file cannot script the page.
    html(token) { return esc(token.text); },
    link(token) {
      const inner = this.parser.parseInline(token.tokens);
      const external = /^[a-z][a-z0-9+.-]*:/i.test(token.href);
      return `<a href="${esc(token.href)}"${token.title ? ` title="${esc(token.title)}"` : ''}${external ? ' rel="noopener noreferrer"' : ''}>${inner}</a>`;
    },
  },
});

function frontmatterTable(data) {
  const rows = Object.entries(data ?? {});
  if (!rows.length) return '';
  const cell = (v) => (Array.isArray(v) ? v.map((x) => (x && typeof x === 'object' ? JSON.stringify(x) : String(x))).join(', ') : v && typeof v === 'object' ? JSON.stringify(v) : String(v ?? ''));
  return `<table class="meta"><caption>About this file</caption><tbody>${rows.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(cell(v))}</td></tr>`).join('')}</tbody></table>`;
}

const CSS = `
:root { color-scheme: light; --ink: #14213d; --ground: #ffffff; --tone: #f4f1ea; --rule: #b9b3a6; --link: #0b4fb3; --good: #1a6b2f; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--ground); color: var(--ink); font: 16px/1.6 "Public Sans", "Helvetica Neue", Arial, sans-serif; }
header.bar { display: flex; flex-wrap: wrap; gap: 8px 20px; align-items: center; justify-content: space-between; padding: 12px 24px; border-bottom: 2px solid var(--ink); background: var(--tone); }
header.bar p { margin: 0; font-weight: 600; }
header.bar a { color: var(--link); font-weight: 600; }
main { max-width: 52rem; margin: 0 auto; padding: 24px; }
h1, h2, h3 { line-height: 1.2; margin: 1.6em 0 0.5em; }
h1 { margin-top: 0.4em; font-size: 2rem; }
a { color: var(--link); }
a:focus-visible { outline: 3px solid var(--link); outline-offset: 2px; }
img { max-width: 100%; height: auto; border: 1px solid var(--rule); }
code { background: var(--tone); padding: 0 4px; }
pre { background: var(--tone); padding: 12px; overflow-x: auto; }
pre code { padding: 0; }
table { border-collapse: collapse; margin: 1em 0; max-width: 100%; display: block; overflow-x: auto; }
th, td { border: 1px solid var(--rule); padding: 6px 10px; text-align: left; vertical-align: top; white-space: nowrap; }
th { font-weight: 700; background: var(--tone); }
table.meta { font-size: 14px; }
table.meta caption { text-align: left; font-weight: 700; padding-bottom: 6px; }
table.meta td { white-space: normal; overflow-wrap: anywhere; }
`;

// The page for one Markdown file.
export function renderDesignSystemPage(root, file) {
  const text = readFileSync(file, 'utf8');
  const { data, body } = parseFrontmatter(text);
  const rootRel = relative(root, file).split(sep).join('/');
  const heading = /^#\s+(.+)$/m.exec(body);
  const name = data.title || (heading ? heading[1].trim() : componentWords(data.name ?? 'Design system file'));
  // The file's own title comes first, then the table of what the file says about itself.
  const first = /^#\s+.+\n/.exec(body);
  const title = first ? markdown.parse(first[0]) : '';
  const html = markdown.parse(first ? body.slice(first[0].length) : body);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(name)}, design system</title>
<style>${CSS}</style>
</head>
<body>
<header class="bar"><p>Design system file</p><a href="${esc(obsidianUri(root, rootRel))}">Open in Obsidian</a></header>
<main>
${title}${frontmatterTable(data)}
${html}
</main>
</body>
</html>
`;
}
