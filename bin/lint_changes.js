/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

// @ts-check

const { execSync, spawn } = require('child_process');
const path = require('path');

const extensions = ['.ts', '.mts'];
const fix = process.argv.includes('--fix');

// Get uncommitted changed files (staged + unstaged)
function getChangedFiles() {
  try {
    const output = execSync('git diff --name-only --diff-filter=ACMR HEAD', {
      encoding: 'utf-8',
      cwd: path.join(__dirname, '..')
    });
    return output.split('\n').filter(f => f && extensions.some(ext => f.endsWith(ext)));
  } catch {
    return [];
  }
}

const files = getChangedFiles();

if (files.length === 0) {
  console.log('No changed TypeScript files to lint.');
  process.exit(0);
}

console.log(`Linting ${files.length} changed file(s)...`);

const eslintArgs = ['--max-warnings', '0', '--no-warn-ignored'];
if (fix) {
  eslintArgs.push('--fix');
}
eslintArgs.push(...files);

const eslint = process.platform === 'win32' ? 'eslint.cmd' : 'eslint';
const child = spawn(eslint, eslintArgs, {
  stdio: 'inherit',
  cwd: path.join(__dirname, '..'),
  shell: process.platform === 'win32'
});

child.on('close', code => process.exit(code ?? 0));
