/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { spawnSync } from 'child_process';
import { copyFileSync, mkdirSync, renameSync } from 'fs';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ghosttyDir = path.join(repoRoot, 'vendor', 'ghostty');
const wasmOutDir = path.join(repoRoot, 'vendor', 'ghostty-wasm');
const wasmBinDir = path.join(wasmOutDir, 'bin');
const wasmFile = path.join(wasmOutDir, 'ghostty-vt.wasm');
const wasmBinFile = path.join(wasmBinDir, 'ghostty-vt.wasm');

mkdirSync(wasmOutDir, { recursive: true });

const result = spawnSync('zig', [
  'build',
  'lib-vt',
  '-Dtarget=wasm32-freestanding',
  '-Doptimize=ReleaseSmall',
  '-p',
  path.relative(ghosttyDir, wasmOutDir)
], {
  cwd: ghosttyDir,
  stdio: 'inherit',
  shell: true
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

try {
  renameSync(wasmBinFile, wasmFile);
} catch {
  copyFileSync(wasmBinFile, wasmFile);
}
