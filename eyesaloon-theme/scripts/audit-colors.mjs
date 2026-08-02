import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const hexPattern = /#[0-9a-fA-F]{3,8}\b/g;
const allowlistedFiles = new Set([
  path.normalize('snippets/css-variables.liquid'),
  path.normalize('config/settings_schema.json'),
  path.normalize('config/settings_data.json'),
]);
const allowedAssetExtensions = new Set(['.svg']);
const scanExtensions = new Set(['.css', '.liquid', '.json', '.js', '.mjs']);
const ignoredDirs = new Set(['.git', 'node_modules', '.shopify']);

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (ignoredDirs.has(entry.name)) continue;

    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(absolute));
    } else if (scanExtensions.has(path.extname(entry.name))) {
      files.push(absolute);
    }
  }

  return files;
}

const violations = [];

for (const file of await listFiles(root)) {
  const relative = path.normalize(path.relative(root, file));
  if (allowlistedFiles.has(relative)) continue;
  if (relative.startsWith(`assets${path.sep}`) && allowedAssetExtensions.has(path.extname(relative))) continue;

  const source = (await readFile(file, 'utf8'))
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{%\s*comment\s*%\}[\s\S]*?\{%\s*endcomment\s*%\}/g, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  const matches = source.match(hexPattern);
  if (!matches) continue;

  for (const match of matches) {
    violations.push(`${relative}: ${match}`);
  }
}

if (violations.length) {
  console.error('Hard-coded hex colors found outside the Eyesaloon token allowlist:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('Color audit passed.');
