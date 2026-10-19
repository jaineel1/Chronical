// Prepares dist/ for publishing as a claude.ai artifact: the artifact host wraps the page in its own
// document skeleton, so the published index must be a fragment (title first, then links and scripts),
// and the service worker is left out because the host does not run service workers.
// Run after `npm run build`: node scripts/artifact.mjs  → writes dist-artifact/
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';

const src = 'dist';
const out = 'dist-artifact';
if (!existsSync(`${src}/index.html`)) throw new Error('run npm run build first');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(`${src}/assets`, `${out}/assets`, { recursive: true });
cpSync(`${src}/icons`, `${out}/icons`, { recursive: true });

const html = readFileSync(`${src}/index.html`, 'utf8');
const scripts = [...html.matchAll(/<script[^>]*src="([^"]+)"[^>]*><\/script>/g)].map((m) => m[1]);
const styles = [...html.matchAll(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)].map((m) => m[1]);

const fragment = [
  '<title>Chronicle</title>',
  '<link rel="icon" href="./icons/icon.svg" type="image/svg+xml">',
  ...styles.map((href) => `<link rel="stylesheet" href="${href}">`),
  '<style>html,body{margin:0;background:#ebe3d4}</style>',
  '<div id="root"></div>',
  ...scripts.map((s) => `<script type="module" src="${s}"></script>`),
  '',
].join('\n');
writeFileSync(`${out}/index.html`, fragment);

// Manifest of supporting files for the Artifact tool's `files` parameter.
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const files = Object.fromEntries(
  walk(out)
    .filter((p) => !p.endsWith('index.html'))
    .map((p) => [relative(out, p), p]),
);
writeFileSync(`${out}/files.json`, JSON.stringify(files, null, 2));
console.log(`artifact fragment written to ${out}/index.html with ${Object.keys(files).length} supporting files`);
