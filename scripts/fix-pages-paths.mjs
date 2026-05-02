import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.argv[2];
const basePath = process.argv[3];

if (!rootDir || !basePath) {
  console.error('usage: node scripts/fix-pages-paths.mjs <rootDir> <basePath>');
  process.exit(1);
}

const normalizedBasePath = basePath.startsWith('/') ? basePath : `/${basePath}`;
const prefix = normalizedBasePath === '/' ? '' : normalizedBasePath.replace(/\/$/, '');

const htmlAttrPattern = /(href|src|content|action|poster|data|srcset)=(["'])(.*?)\2/g;
const cssUrlPattern = /url\((["']?)(\/[^)"']+)\1\)/g;
const sitePathPrefixes = [
  '_next',
  '_mintlify',
  'favicons',
  'sitemap.xml',
  'src/_props',
  'overview',
  'getting-started',
  'guides',
  'adoption',
  'architecture',
  'tooling',
  'reference',
  'internals',
];

function escapeForRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function prefixUrl(url) {
  if (!prefix || !url.startsWith('/') || url.startsWith('//')) {
    return url;
  }

  if (url === prefix || url.startsWith(`${prefix}/`)) {
    return url;
  }

  return `${prefix}${url}`;
}

function rewriteSrcset(value) {
  return value
    .split(',')
    .map((candidate) => {
      const trimmed = candidate.trim();
      if (!trimmed) {
        return candidate;
      }

      const [url, ...descriptor] = trimmed.split(/\s+/);
      return [prefixUrl(url), ...descriptor].join(' ').trim();
    })
    .join(', ');
}

function rewriteHtmlAttributes(content) {
  return content.replace(htmlAttrPattern, (_match, attr, quote, value) => {
    const rewritten = attr === 'srcset' ? rewriteSrcset(value) : prefixUrl(value);
    return `${attr}=${quote}${rewritten}${quote}`;
  });
}

function rewriteInlineSitePaths(content) {
  if (!prefix) {
    return content;
  }

  let rewritten = content;

  for (const sitePathPrefix of sitePathPrefixes) {
    const rootPath = `/${sitePathPrefix}`;
    const prefixedPath = `${prefix}${rootPath}`;

    rewritten = rewritten.replaceAll(`"${rootPath}`, `"${prefixedPath}`);
    rewritten = rewritten.replaceAll(`'${rootPath}`, `'${prefixedPath}`);
    rewritten = rewritten.replaceAll(`\\"${rootPath}`, `\\"${prefixedPath}`);
    rewritten = rewritten.replaceAll(`\\'${rootPath}`, `\\'${prefixedPath}`);
  }

  rewritten = rewritten.replaceAll('"p":""', `"p":"${prefix}"`);
  rewritten = rewritten.replaceAll('\\"p\\":\\"\\"', `\\"p\\":\\"${prefix}\\"`);

  return rewritten;
}

function dedupeBasePath(content) {
  if (!prefix) {
    return content;
  }

  const duplicatePrefixPattern = new RegExp(
    `${escapeForRegex(prefix)}${escapeForRegex(prefix)}(?=/)`,
    'g',
  );

  return content.replace(duplicatePrefixPattern, prefix);
}

function rewriteRuntimeScriptContent(content) {
  if (!prefix) {
    return content;
  }

  return content
    .replaceAll(
      '(0,n.addPathPrefix)(e,"")',
      `e.startsWith("${prefix}")?e:(0,n.addPathPrefix)(e,"${prefix}")`,
    )
    .replaceAll(
      '(0,n.addPathPrefix)(e,"/cratestack-docs")',
      `e.startsWith("${prefix}")?e:(0,n.addPathPrefix)(e,"${prefix}")`,
    )
    .replaceAll('addPathPrefix(e,"")', `addPathPrefix(e,"${prefix}")`);
}

function rewriteCssContent(content) {
  if (!prefix) {
    return content;
  }

  return content.replace(cssUrlPattern, (_match, quote, url) => {
    const rewritten = prefixUrl(url);
    return `url(${quote}${rewritten}${quote})`;
  });
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath);
      continue;
    }

    const isHtml = /\.html?$/i.test(entry.name);
    const isScript = /\.js$/i.test(entry.name);
    const isStylesheet = /\.css$/i.test(entry.name);

    if (!isHtml && !isScript && !isStylesheet) {
      continue;
    }

    const original = await fs.readFile(fullPath, 'utf8');
    let content = original;

    if (isHtml) {
      content = rewriteHtmlAttributes(content);
    }

    if (isStylesheet) {
      content = rewriteCssContent(content);
    }

    content = rewriteInlineSitePaths(content);
    content = rewriteRuntimeScriptContent(content);
    content = dedupeBasePath(content);

    if (content !== original) {
      await fs.writeFile(fullPath, content);
    }
  }
}

await walk(rootDir);
