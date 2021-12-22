/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

const cp = require('child_process');
const path = require('path');


// Add `out` to the NODE_PATH so absolute paths can be resolved.
const env = { ...process.env };
env.NODE_PATH = path.resolve(__dirname, '../out');

let testFiles = [
  './addons/**/out-test/*api.js',
  './out-test/**/*api.js',
];


let flagArgs = [];

if (process.argv.length > 2) {
  const args = process.argv.slice(2);
  flagArgs = args.filter(e => e.startsWith('--')).map(arg => arg.split('=')).reduce((arr, val) => arr.concat(val.slice(), []));
  console.info(flagArgs);
  // ability to inject particular test files via
  // yarn test [testFileA testFileB ...]
  files = args.filter(e => !e.startsWith('--'));
  if (files.length) {
    testFiles = files;
  }
}



env.DEBUG = flagArgs.indexOf('--debug') >= 0 ? 'debug' : '';
env.PORT = 3001;

const server = cp.spawn('node', ['demo/start'], {
  cwd: path.resolve(__dirname, '..'),
  env,
  stdio: 'pipe'
})

server.stdout.on('data', (data) => {
  // await for the server to fully start
  if (data.includes("successfully")) {
    const run = cp.spawnSync(
      npmBinScript('mocha'),
      [...testFiles, ...flagArgs], {
        cwd: path.resolve(__dirname, '..'),
        env,
        stdio: 'inherit'
      }
    );

    function npmBinScript(script) {
      return path.resolve(__dirname, `../node_modules/.bin/` + (process.platform === 'win32' ?
        `${script}.cmd` : script));
    }

    server.kill();

    process.exit(run.status);
  }
});

server.stderr.on('data', (data) => {
  console.error(data.toString());
});
