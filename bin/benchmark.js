/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

const cp = require('child_process');
const path = require('path');
const glob = require('glob');

// Add `out` to the NODE_PATH so absolute paths can be resolved.
const env = { ...process.env };
env.NODE_PATH = path.resolve(__dirname, '../out');

/**
 * Default commands for yarn:
 *    yarn benchmark single     single run of all benchmarks without statistics
 *    yarn benchmark baseline   10 runs of all benchmarks with baseline statistics
 *    yarn benchmark eval       10 runs of all benchmarks with eval against last baseline
 */
const commands = {
  single  : '-c benchmark.json',
  baseline: '--baseline -r 5 -c benchmark.json',
  eval    : '--eval -r 5 -c benchmark.json'
}

let testFiles = [
  './out/**/*benchmark.js'
];

// allow overriding cmdline args (see yarn benchmark --help)
if (process.argv.length === 3 && process.argv[2] in commands) {
  testFiles.push(commands[process.argv[2]]);
} else if (process.argv.length > 2) {
  testFiles = process.argv.slice(2);
}

cp.spawnSync(
  path.resolve(__dirname, '../node_modules/.bin/xterm-benchmark'),
  testFiles.reduce((accu, cur) => {
    const expanded = glob.sync(cur);
    if (!expanded.length) {
      accu.push(cur);
      return accu;
    }
    return accu.concat(expanded);
  }, []),
  {
    cwd: path.resolve(__dirname, '..'),
    env,
    stdio: 'inherit',
    shell: true
  }
);
