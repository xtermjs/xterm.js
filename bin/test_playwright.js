/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

// @ts-check

const cp = require('child_process');
const path = require('path');

let argv = process.argv.slice(2);
let suiteFilter = undefined;
while (argv.some(e => e.startsWith('--suite='))) {
  const i = argv.findIndex(e => e.startsWith('--suite='));
  const match = argv[i].match(/--suite=(?<suitename>.+)/)
  suiteFilter = match?.groups?.suitename ?? undefined;
  argv.splice(i, 1);
}

let configs = [
  { name: 'core',                    path: 'out-esbuild-test/playwright/playwright.config.js' },
  { name: 'addon-attach',            path: 'addons/addon-attach/out-esbuild-test/playwright.config.js' },
  { name: 'addon-canvas',            path: 'addons/addon-canvas/out-esbuild-test/playwright.config.js' },
  { name: 'addon-clipboard',         path: 'addons/addon-clipboard/out-esbuild-test/playwright.config.js' },
  { name: 'addon-fit',               path: 'addons/addon-fit/out-esbuild-test/playwright.config.js' },
  // TODO: Move onto esbuild sources
  { name: 'addon-image',             path: 'addons/addon-image/out-test/playwright.config.js' },
  { name: 'addon-search',            path: 'addons/addon-search/out-esbuild-test/playwright.config.js' },
  { name: 'addon-serialize',         path: 'addons/addon-serialize/out-esbuild-test/playwright.config.js' },
  { name: 'addon-unicode-graphemes', path: 'addons/addon-unicode-graphemes/out-esbuild-test/playwright.config.js' },
  { name: 'addon-unicode11',         path: 'addons/addon-unicode11/out-esbuild-test/playwright.config.js' },
  { name: 'addon-web-links',         path: 'addons/addon-web-links/out-esbuild-test/playwright.config.js' },
  { name: 'addon-webgl',             path: 'addons/addon-webgl/out-esbuild-test/playwright.config.js' }
];

if (suiteFilter) {
  configs = configs.filter(e => e.name === suiteFilter);
}

function npmBinScript(script) {
  return path.resolve(__dirname, `../node_modules/.bin/` + (process.platform === 'win32' ?
    `${script}.cmd` : script));
}

async function run() {
  for (const config of configs) {
    const command = npmBinScript('playwright');
    const args = ['test', '-c', config.path, ...argv];
    console.log(`Running suite \x1b[1;34m${config.name}...\x1b[0m`);
    console.log(`\n\x1b[32m${command}\x1b[0m`, args);
    const run = cp.spawnSync(command, args, {
        cwd: path.resolve(__dirname, '..'),
        shell: true,
        stdio: 'inherit'
      }
    );

    if (run.error) {
      console.error(run.error);
    }
    process.exit(run.status ?? -1);
  }
}
run();
