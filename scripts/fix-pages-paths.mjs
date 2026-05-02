import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.argv[2];
const basePath = process.argv[3];

if (!rootDir || !basePath) {
  console.error('usage: node scripts/fix-pages-paths.mjs <rootDir> <basePath>');
  process.exit(1);
}

const normalizedBasePath = basePath.startsWith('/') ? basePath : `/${basePath}`;
const prefix = normalizedBasePath === '/' ? '' : normalizedBasePath;

const htmlAttrPattern = /(href|src|content|action|poster|data|srcset)=["']\/(?!\/)/g;

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath);
      continue;
    }

    if (!/\.html?$/i.test(entry.name)) {
      continue;
    }

    let content = await fs.readFile(fullPath, 'utf8');
    const original = content;

    content = content.replace(htmlAttrPattern, (_match, attr) => `${attr}="${prefix}/`);

    if (content !== original) {
      await fs.writeFile(fullPath, content);
    }
  }
}

await walk(rootDir);
