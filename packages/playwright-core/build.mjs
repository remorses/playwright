#!/usr/bin/env node
/**
 * Fast build for @xmorse/playwright-core.
 *
 * Same playwright-core steps as utils/build/build.js (Playwright 1.64), without the
 * rest of the monorepo: generate injected scripts, then esbuild the entry points,
 * lib/utilsBundle.js (npm deps) and lib/coreBundle.js (everything else).
 * Bare npm imports resolve from this package's node_modules (devDependencies),
 * never from a stale playwright/node_modules.
 */

import { build } from 'esbuild';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const CORE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(CORE, '..', '..');
const SRC = path.join(CORE, 'src');
const LIB = path.join(CORE, 'lib');
const { MAPPING, VENDORED_PACKAGES } = require('../../utils/build/utilsBundleMapping.js');

function rel(p) {
  return path.join(ROOT, ...p.split('/'));
}

function findFiles(dir, filter, results = []) {
  if (!fs.existsSync(dir))
    return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory())
      findFiles(full, filter, results);
    else if (filter(full))
      results.push(full);
  }
  return results;
}

// tsconfig path aliases, resolved by esbuild through the root tsconfig.json.
const ALIAS_RE = /^@(isomorphic|utils|protocol|injected|recorder|dashboard|trace-viewer|html-reporter|web|testIsomorphic)\//;

const resolveFromCorePlugin = {
  name: 'resolve-from-core',
  setup(b) {
    b.onResolve({ filter: /^[^./]/ }, async args => {
      if (args.pluginData?.fromCore || ALIAS_RE.test(args.path) || args.path.startsWith('node:') || require('module').isBuiltin(args.path))
        return undefined;
      if (args.path.startsWith('playwright-core/lib/'))
        return undefined;
      const result = await b.resolve(args.path, { kind: args.kind, resolveDir: CORE, importer: args.importer, pluginData: { fromCore: true } });
      if (result.errors.length)
        return undefined;
      return result;
    });
  },
};

// Port of the onLoad rewrite in utils/build/build.js: vendored npm imports go through lib/utilsBundle.
const VENDORED_RE = new RegExp(
    '^import\\s+(\\{[^}]*\\}|\\*\\s+as\\s+\\w+|\\w+(?:\\s*,\\s*\\{[^}]*\\})?)\\s+from\\s+\'(' +
    [...VENDORED_PACKAGES].map(p => p.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')).join('|') +
    ')\';?', 'gm');

function utilsBundleSpecifier(filePath) {
  const marker = `${path.sep}playwright-core${path.sep}src${path.sep}`;
  const idx = filePath.indexOf(marker);
  if (idx === -1)
    return "'playwright-core/lib/utilsBundle'";
  let r = path.relative(path.dirname(filePath), path.join(filePath.slice(0, idx + marker.length - 1), 'utilsBundle')).split(path.sep).join('/');
  if (!r.startsWith('.'))
    r = './' + r;
  return `'${r}'`;
}

function parseNamed(braced) {
  return braced.replace(/^\s*\{|\}\s*$/g, '').split(',').map(s => s.trim().replace(/^type\s+/, '')).filter(Boolean).map(spec => {
    const m = spec.match(/^(\w+)(?:\s+as\s+(\w+))?$/);
    return m ? { src: m[1], alias: m[2] || m[1] } : null;
  }).filter(Boolean);
}

function rewriteVendoredImports(filePath, contents) {
  const spec = utilsBundleSpecifier(filePath);
  return contents.replace(VENDORED_RE, (full, clause, pkg) => {
    const def = MAPPING[pkg];
    const lines = [];
    if (clause.startsWith('{')) {
      const renames = parseNamed(clause).map(({ src, alias }) => {
        const key = def.named?.[src];
        return key ? (key === alias ? key : `${key}: ${alias}`) : null;
      }).filter(Boolean);
      if (renames.length)
        lines.push(`const { ${renames.join(', ')} } = require(${spec});`);
    } else if (clause.startsWith('*')) {
      if (def.namespace)
        lines.push(`const ${clause.match(/\*\s+as\s+(\w+)/)[1]} = require(${spec}).${def.namespace};`);
    } else {
      const m = clause.match(/^(\w+)(?:\s*,\s*(\{[^}]*\}))?$/);
      if (m && def.default)
        lines.push(`const ${m[1]} = require(${spec}).${def.default};`);
      if (m?.[2]) {
        const renames = parseNamed(m[2]).map(({ src, alias }) => {
          const key = def.named?.[src];
          return key ? (key === alias ? key : `${key}: ${alias}`) : null;
        }).filter(Boolean);
        if (renames.length)
          lines.push(`const { ${renames.join(', ')} } = require(${spec});`);
      }
    }
    return lines.length ? lines.join('\n') : full;
  });
}

const rewritePlugin = {
  name: 'vendored-imports',
  setup(b) {
    b.onLoad({ filter: /\.ts$/ }, async args => {
      const contents = await fs.promises.readFile(args.path, 'utf8');
      if (![...VENDORED_PACKAGES].some(pkg => contents.includes(`'${pkg}'`)))
        return undefined;
      return { contents: rewriteVendoredImports(args.path, contents), loader: 'ts' };
    });
  },
};

const common = {
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  logLevel: 'warning',
  logOverride: { 'direct-eval': 'silent' },
};

async function main() {
  const start = Date.now();

  console.log('Generating injected scripts...');
  const injected = spawnSync(process.execPath, [rel('utils/generate_injected.js')], {
    stdio: 'inherit',
    env: { ...process.env, NODE_PATH: path.join(CORE, 'node_modules') },
  });
  if (injected.status !== 0)
    throw new Error('utils/generate_injected.js failed');

  fs.rmSync(LIB, { recursive: true, force: true });

  console.log('Building entry points...');
  await build({
    ...common,
    entryPoints: [
      'src/bootstrap.ts',
      'src/entry/cliDaemon.ts',
      'src/entry/dashboardApp.ts',
      'src/entry/mcp.ts',
      'src/entry/oopBrowserDownload.ts',
      ...findFiles(path.join(SRC, 'tools/cli-client'), f => f.endsWith('.ts')).map(f => path.relative(CORE, f)),
      'src/package.ts',
      'src/tools/utils/socketConnection.ts',
      'src/tools/utils/extension.ts',
    ].map(f => path.join(CORE, f)),
    outbase: SRC,
    outdir: LIB,
    plugins: [rewritePlugin],
  });

  console.log('Building serverRegistry.js...');
  await build({
    ...common,
    bundle: true,
    entryPoints: [path.join(SRC, 'serverRegistry.ts')],
    outfile: path.join(LIB, 'serverRegistry.js'),
    plugins: [resolveFromCorePlugin],
  });

  console.log('Building utilsBundle.js...');
  await build({
    ...common,
    bundle: true,
    entryPoints: [path.join(SRC, 'utilsBundle.ts')],
    outfile: path.join(LIB, 'utilsBundle.js'),
    external: ['express', '@anthropic-ai/sdk'],
    alias: { 'raw-body': rel('utils/build/raw-body.ts') },
    plugins: [resolveFromCorePlugin],
  });

  console.log('Building coreBundle.js...');
  await build({
    ...common,
    bundle: true,
    entryPoints: [path.join(SRC, 'coreBundle.ts')],
    outfile: path.join(LIB, 'coreBundle.js'),
    external: ['../../api.json', './help.json', 'electron', 'electron/*', 'chromium-bidi', 'chromium-bidi/*', 'mitt'],
    define: { __PW_HMR__: 'false' },
    plugins: [{
      name: 'externalize-utilsBundle',
      setup: b => b.onResolve({ filter: /utilsBundle/ }, () => ({ path: './utilsBundle', external: true })),
    }, {
      name: 'externalize-bootstrap',
      setup: b => b.onResolve({ filter: /\/bootstrap$/ }, args => path.resolve(args.resolveDir, args.path) === path.join(SRC, 'bootstrap') ? { path: './bootstrap', external: true } : undefined),
    }, rewritePlugin, resolveFromCorePlugin],
  });
  const leaked = fs.readFileSync(path.join(LIB, 'coreBundle.js'), 'utf8').split('\n').filter(line => line.includes('node_modules/'));
  if (leaked.length)
    throw new Error(`coreBundle.js bundles npm packages, route them through utilsBundle:\n${leaked.slice(0, 10).join('\n')}`);

  console.log('Copying static files...');
  const copies = [
    ...findFiles(SRC, f => /\.(js|json)$/.test(f) && !f.includes(`${path.sep}injected${path.sep}`) && !f.endsWith('.eslintrc.js')).map(f => [f, path.join(LIB, path.relative(SRC, f))]),
    ...findFiles(path.join(SRC, 'server/chromium'), f => f.endsWith('.png')).map(f => [f, path.join(LIB, path.relative(SRC, f))]),
    ...findFiles(path.join(SRC, 'tools/skills'), () => true).map(f => [f, path.join(LIB, path.relative(SRC, f))]),
    ...findFiles(path.join(SRC, 'tools/dashboard'), f => /\.(png|ico)$/.test(f)).map(f => [f, path.join(LIB, path.relative(SRC, f))]),
    ...['webp_codec.wasm', 'webp_codec.LICENSE'].map(f => [rel(`packages/utils/webp/${f}`), path.join(LIB, f)]),
    // the bundled `open` package spawns lib/xdg-open on Linux
    [path.join(CORE, 'node_modules/open/xdg-open'), path.join(LIB, 'xdg-open')],
  ];
  for (const [from, to] of copies) {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
  }

  console.log(`Done in ${((Date.now() - start) / 1000).toFixed(1)}s`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
