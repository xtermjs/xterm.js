/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

const cp = require('child_process');
const path = require('path');

const COVERAGE_LINES_THRESHOLD = 40;

// Add `out` to the NODE_PATH so absolute paths can be resolved.
const env = { ...process.env };
env.NODE_PATH = path.resolve(__dirname, '../out-esbuild');

let testFiles = ['**/out-esbuild/**/*.test.js'];

let flagArgs = [];

if (process.argv.length > 2) {
  const args = process.argv.slice(2);
  flagArgs = args.filter(e => e.startsWith('--'));
  // ability to inject particular test files via
  // yarn test [testFileA testFileB ...]
  files = args.filter(e => !e.startsWith('--'));
  if (files.length) {
    testFiles = files;
  }
}

const checkCoverage = flagArgs.indexOf('--coverage') >= 0;
if (checkCoverage) {
  flagArgs.splice(flagArgs.indexOf('--coverage'), 1);
  const executable = npmBinScript('nyc');
  const args = [
    '--check-coverage',
    `--lines=${COVERAGE_LINES_THRESHOLD}`,
    '--exclude=out-esbuild/vs/**',
    npmBinScript('mocha'),
    ...testFiles,
    ...flagArgs
  ];
  console.info('executable', executable);
  console.info('args', args);
  const run = cp.spawnSync(
    executable,
    args,
    {
      cwd: path.resolve(__dirname, '..'),
      env,
      shell: true,
      stdio: 'inherit'
    }
  );
  process.exit(run.status);
}

const run = cp.spawnSync(
  npmBinScript('mocha'),
  [...testFiles, ...flagArgs],
  {
    cwd: path.resolve(__dirname, '..'),
    env,
    shell: true,
    stdio: 'inherit'
  }
);

function npmBinScript(script) {
  return path.resolve(__dirname, `../node_modules/.bin/` + (process.platform === 'win32' ? `${script}.cmd` : script));
}

if (run.error) {
  console.error(run.error);
}
process.exit(run.status ?? -1);
