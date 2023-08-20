/**
 * Copyright (c) 2023 The xterm.js authors. All rights reserved.
 * @license MIT
 */

// @ts-check

import { build, context, default as esbuild } from 'esbuild';
import { argv } from 'process';

const config = {
  isDev: argv.includes('--dev'),
  isWatch: argv.includes('--watch'),
  isDemoClient: argv.includes('--demo-client'),
  addon: argv.find(e => e.startsWith('--addon='))?.replace(/^--addon=/, ''),
};

// console.info('Running with config:', JSON.stringify(config, undefined, 2));

/** @type {esbuild.BuildOptions} */
const commonOptions = {
  format: 'esm',
  target: 'es2015', // TODO: Upgrade
};

/** @type {esbuild.BuildOptions} */
const devOptions = {
  sourcemap: true,
};

/** @type {esbuild.BuildOptions} */
const prodOptions = {
  minify: true
};

/**
 * @param {string} addon
 */
function getAddonEntryPoint(addon) {
  let result = '';
  let nextCap = true;
  for (const char of addon) {
    if (char === '-') {
      nextCap = true;
      continue;
    }
    result += nextCap ? char.toUpperCase() : char
    nextCap = false;
  }
  result += 'Addon';
  return result;
}

/** @type {esbuild.BuildOptions} */
let buildConfig = {
  bundle: true,
  ...commonOptions,
  ...(config.isDev ? devOptions : prodOptions)
};

if (config.addon) {
  buildConfig = {
    ...buildConfig,
    entryPoints: [`addons/xterm-addon-${config.addon}/src/${getAddonEntryPoint(config.addon)}.ts`],
    outfile: `addons/xterm-addon-${config.addon}/lib/xterm-addon-${config.addon}.js`,
  };

  if (config.addon === 'ligatures') {
    buildConfig.platform = 'node';
  }

  if (config.addon === 'serialize') {
    buildConfig.tsconfig = 'addons/xterm-addon-serialize/src/tsconfig.json'
  }
} else {
  buildConfig = {
    ...buildConfig,
    entryPoints: [`src/browser/public/Terminal.ts`],
    outfile: `lib/xterm.js`,
  };
}

if (config.isDemoClient) {
  buildConfig = {
    ...buildConfig,
    entryPoints: [`demo/client.ts`],
    outfile: 'demo/dist/client-bundle.js',
    external: ['util', 'os', 'fs', 'path', 'stream']
  }
}

if (config.isWatch) {
  // TODO: This doesn't report errors?
  (await context(buildConfig)).watch();
} else {
  await build(buildConfig)
}
