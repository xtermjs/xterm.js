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

const cwd = path.join(__dirname, '..');
const isWin = process.platform === 'win32';

/**
 * @param {string} command
 * @param {string[]} args
 * @returns {Promise<void>}
 */
function run(command, args) {
  return new Promise(/** @type {(resolve: () => void, reject: (reason: Error) => void) => void} */ ((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      cwd,
      shell: isWin
    });
    child.on('close', code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  }));
}

async function main() {
  const oxlintArgs = ['--type-aware', '--max-warnings', '0'];
  if (fix) {
    oxlintArgs.push('--fix');
  }
  oxlintArgs.push(...files);

  const oxlint = isWin ? 'oxlint.cmd' : 'oxlint';
  await run(oxlint, oxlintArgs);

  const eslintArgs = ['--config', 'eslint.config.naming.mjs', '--max-warnings', '0', ...files];
  const eslint = isWin ? 'eslint.cmd' : 'eslint';
  await run(eslint, eslintArgs);
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
