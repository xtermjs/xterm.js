/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

const cp = require('child_process');
const path = require('path');

// Add `out` to the NODE_PATH so absolute paths can be resolved.
const env = { ...process.env };
env.NODE_PATH = path.resolve(__dirname, '../out');

const args = [
  './out/*test.js',
  './out/**/*test.js',
  './out/*integration.js',
  './out/**/*integration.js',
  './lib/**/*test.js'
];

cp.spawnSync('./node_modules/.bin/mocha', args, {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'inherit',
  env
});
