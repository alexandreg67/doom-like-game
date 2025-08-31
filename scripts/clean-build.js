#!/usr/bin/env node
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Recursively remove dist folders and tsconfig.tsbuildinfo files in packages and apps
const root = process.cwd();
const targets = ['packages', 'apps', 'tools'];

function rmRf(path) {
  try {
    if (existsSync(path)) {
      rmSync(path, { recursive: true, force: true });
      console.log('removed', path);
    }
  } catch (e) {
    console.error('failed to remove', path, e?.message || e);
  }
}

for (const t of targets) {
  const dir = join(root, t);
  if (!existsSync(dir)) continue;
  for (const name of readdirSync(dir)) {
    const pkgPath = join(dir, name);
    if (!statSync(pkgPath).isDirectory()) continue;
    rmRf(join(pkgPath, 'dist'));
    rmRf(join(pkgPath, 'tsconfig.tsbuildinfo'));
  }
}

// also remove top-level tsbuildinfo if present
rmRf(join(root, 'tsconfig.tsbuildinfo'));
console.log('clean-build finished');
