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
  logLevel: 'info'
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
let bundleConfig = {
  bundle: true,
  ...commonOptions,
  ...(config.isDev ? devOptions : prodOptions)
};

/** @type {esbuild.BuildOptions} */
let outConfig = {
  format: 'cjs'
}
let skipOut = false;

/** @type {esbuild.BuildOptions} */
let outTestConfig = {
  format: 'cjs'
}
let skipOutTest = false;

if (config.addon) {
  bundleConfig = {
    ...bundleConfig,
    entryPoints: [`addons/addon-${config.addon}/src/${getAddonEntryPoint(config.addon)}.ts`],
    outfile: `addons/addon-${config.addon}/lib/xterm-addon-${config.addon}.js`,
  };
  outConfig = {
    ...outConfig,
    entryPoints: [`addons/addon-${config.addon}/src/**/*.ts`],
    outdir: `addons/addon-${config.addon}/out/`
  };
  outTestConfig = {
    ...outConfig,
    entryPoints: [`addons/addon-${config.addon}/test/**/*.ts`],
    outdir: `addons/addon-${config.addon}/out-test/`
  };

  if (config.addon === 'ligatures') {
    bundleConfig.platform = 'node';
  }

  if (config.addon === 'serialize') {
    bundleConfig.tsconfig = 'addons/addon-serialize/src/tsconfig.json'
  }

  if (['canvas', 'ligatures'].includes(config.addon)) {
    skipOutTest = true;
  }

  // TODO: Fix these
  if (config.addon === 'image') {
    skipOut = true;
    skipOutTest = true;
  }
} else {
  bundleConfig = {
    ...bundleConfig,
    entryPoints: [`src/browser/public/Terminal.ts`],
    outfile: `lib/xterm.js`,
  };
  outConfig = {
    ...outConfig,
    entryPoints: ['src/**/*.ts'],
    outdir: 'out/'
  };
  outTestConfig = {
    ...outConfig,
    entryPoints: ['test/**/*.ts'],
    outdir: 'out-test/'
  };
}

if (config.isDemoClient) {
  bundleConfig = {
    ...bundleConfig,
    entryPoints: [`demo/client.ts`],
    outfile: 'demo/dist/client-bundle.js',
    external: ['util', 'os', 'fs', 'path', 'stream']
  }
}

if (config.isWatch) {
  // TODO: This doesn't report errors?
  context(bundleConfig).then(e => e.watch());
  if (!skipOut) {
    context(outConfig).then(e => e.watch());
  }
  if (!skipOutTest) {
    context(outTestConfig).then(e => e.watch());
  }
} else {
  await build(bundleConfig);
  if (!skipOut) {
    await build(outConfig);
  }
  if (!skipOutTest) {
    await build(outTestConfig);
  }
}
