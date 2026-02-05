#!/usr/bin/env node
/**
 * Simple build script for @xmorse/playwright-core
 * Just transpiles TypeScript - no bundling needed (deps are external)
 */

import { build } from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;

// Simple recursive file finder
function findFiles(dir, ext, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findFiles(fullPath, ext, results);
    } else if (entry.name.endsWith(ext)) {
      results.push(fullPath);
    }
  }
  return results;
}

async function main() {
  const start = Date.now();
  const srcDir = path.join(ROOT, 'src');
  const libDir = path.join(ROOT, 'lib');

  // 1. Transpile src/**/*.ts -> lib/**/*.js
  console.log('Transpiling TypeScript...');
  const tsFiles = findFiles(srcDir, '.ts');
  
  await build({
    entryPoints: tsFiles,
    outdir: libDir,
    format: 'cjs',
    platform: 'node',
    target: 'ES2019',
    outbase: srcDir,
  });
  console.log(`  ✓ ${tsFiles.length} .ts files`);

  // 2. Copy static files (.js, .json, .png)
  console.log('Copying static files...');
  
  let copied = 0;
  for (const ext of ['.js', '.json', '.png']) {
    const files = findFiles(srcDir, ext).filter(f => 
      !f.includes('.eslintrc') && !f.includes('/injected/')
    );
    for (const file of files) {
      const rel = path.relative(srcDir, file);
      const dest = path.join(libDir, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(file, dest);
      copied++;
    }
  }
  console.log(`  ✓ ${copied} static files`);

  // 3. Copy vendored third_party files from bundles
  console.log('Copying vendored files...');
  const thirdPartyDir = path.join(libDir, 'third_party');
  fs.mkdirSync(thirdPartyDir, { recursive: true });
  
  // lockfile from utils bundle
  const lockfileSrc = path.join(ROOT, 'bundles/utils/src/third_party/lockfile.js');
  if (fs.existsSync(lockfileSrc)) {
    fs.copyFileSync(lockfileSrc, path.join(thirdPartyDir, 'lockfile.js'));
    console.log('  ✓ lockfile.js');
  }
  
  // extract-zip from zip bundle
  const extractZipSrc = path.join(ROOT, 'bundles/zip/src/third_party/extract-zip.js');
  if (fs.existsSync(extractZipSrc)) {
    fs.copyFileSync(extractZipSrc, path.join(thirdPartyDir, 'extract-zip.js'));
    console.log('  ✓ extract-zip.js');
  }

  console.log(`\nDone in ${((Date.now() - start) / 1000).toFixed(1)}s`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
