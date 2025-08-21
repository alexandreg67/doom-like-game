#!/usr/bin/env node
const { execSync } = require('node:child_process');
const { join } = require('node:path');
const { existsSync } = require('node:fs');
const fs = require('node:fs');

// Recursively remove dist folders and tsconfig.tsbuildinfo files in packages and apps
const root = process.cwd();
const targets = ['packages', 'apps', 'tools'];

function rmRf(path) {
  try {
    if (existsSync(path)) {
      execSync(`rm -rf ${path}`);
      console.log('removed', path);
    }
  } catch (e) {
    console.error('failed to remove', path, e.message);
  }
}

for (const t of targets) {
  const dir = join(root, t);
  if (!existsSync(dir)) continue;
  for (const name of fs.readdirSync(dir)) {
    const pkgPath = join(dir, name);
    if (!fs.statSync(pkgPath).isDirectory()) continue;
    rmRf(join(pkgPath, 'dist'));
    rmRf(join(pkgPath, 'tsconfig.tsbuildinfo'));
  }
}

// also remove top-level tsbuildinfo if present
rmRf(join(root, 'tsconfig.tsbuildinfo'));
console.log('clean-build finished');
