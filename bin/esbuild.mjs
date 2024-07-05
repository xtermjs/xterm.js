/**
 * Copyright (c) 2023 The xterm.js authors. All rights reserved.
 * @license MIT
 */

// @ts-check

import { build, context, default as esbuild } from 'esbuild';
import { argv } from 'process';

const config = {
  isProd: argv.includes('--prod'),
  isWatch: argv.includes('--watch'),
  isDemoClient: argv.includes('--demo-client'),
  addon: argv.find(e => e.startsWith('--addon='))?.replace(/^--addon=/, ''),
};

// console.info('Running with config:', JSON.stringify(config, undefined, 2));

/** @type {esbuild.BuildOptions} */
const commonOptions = {
  format: 'esm',
  target: 'es2021',
  sourcemap: true,
  logLevel: 'debug',
};

/** @type {esbuild.BuildOptions} */
const devOptions = {
  minify: false,
};

/** @type {esbuild.BuildOptions} */
const prodOptions = {
  minify: true,
  treeShaking: true,
  logLevel: 'debug',
  legalComments: 'none',
  // TODO: Mangling private and protected properties will reduce bundle size quite a bit, we must
  //       make sure we don't cast privates to `any` in order to prevent regressions.
  //mangleProps: /_.+/,
  banner: {
    js: `/**
 * Copyright (c) 2014-2024 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * Copyright (c) 2012-2013, Christopher Jeffrey (MIT License)
 * @license MIT
 *
 * Originally forked from (with the author's permission):
 *   Fabrice Bellard's javascript vt100 for jslinux:
 *   http://bellard.org/jslinux/
 *   Copyright (c) 2011 Fabrice Bellard
 */
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/`
  },
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
  ...(config.isProd ? prodOptions : devOptions)
};

/** @type {esbuild.BuildOptions} */
let outConfig = {
  format: 'cjs'
}
let skipOut = false;

/** @type {esbuild.BuildOptions} */
// let outTestConfig = {
//   format: 'cjs'
// }
// let skipOutTest = false;

if (config.addon) {
  bundleConfig = {
    ...bundleConfig,
    entryPoints: [`addons/addon-${config.addon}/src/${getAddonEntryPoint(config.addon)}.ts`],
    outfile: `addons/addon-${config.addon}/lib/xterm-addon-${config.addon}.mjs`,
  };
  outConfig = {
    ...outConfig,
    entryPoints: [`addons/addon-${config.addon}/src/**/*.ts`],
    outdir: `addons/addon-${config.addon}/out-esbuild/`
  };
  // outTestConfig = {
  //   ...outConfig,
  //   entryPoints: [`addons/addon-${config.addon}/test/**/*.ts`],
  //   outdir: `addons/addon-${config.addon}/out-esbuild-test/`
  // };

  if (config.addon === 'ligatures') {
    bundleConfig.platform = 'node';
  }

  if (config.addon === 'serialize') {
    bundleConfig.tsconfig = 'addons/addon-serialize/src/tsconfig.json'
  }
} else {
  bundleConfig = {
    ...bundleConfig,
    entryPoints: [`src/browser/public/Terminal.ts`],
    outfile: `lib/xterm.mjs`
  };
  outConfig = {
    ...outConfig,
    entryPoints: ['src/**/*.ts'],
    outdir: 'out-esbuild/'
  };
  // outTestConfig = {
  //   ...outConfig,
  //   entryPoints: ['test/**/*.ts'],
  //   outdir: 'out-esbuild-test/'
  // };
}

if (config.isDemoClient) {
  bundleConfig = {
    ...bundleConfig,
    entryPoints: [`demo/client.ts`],
    outfile: 'demo/dist/client-bundle.js',
    external: ['util', 'os', 'fs', 'path', 'stream', 'Terminal'],
    alias: {
      "@xterm/xterm": ".",
      "@xterm/addon-attach": "./addons/addon-attach/lib/xterm-addon-attach.mjs",
      "@xterm/addon-canvas": "./addons/addon-canvas/lib/xterm-addon-canvas.mjs",
      "@xterm/addon-clipboard": "./addons/addon-clipboard/lib/xterm-addon-clipboard.mjs",
      "@xterm/addon-fit": "./addons/addon-fit/lib/xterm-addon-fit.mjs",
      "@xterm/addon-image": "./addons/addon-image/lib/xterm-addon-image.mjs",
      // "@xterm/addon-ligatures": "./addons/addon-ligatures/lib/xterm-addon-ligatures.js",
      "@xterm/addon-search": "./addons/addon-search/lib/xterm-addon-search.mjs",
      "@xterm/addon-serialize": "./addons/addon-serialize/lib/xterm-addon-serialize.mjs",
      "@xterm/addon-web-links": "./addons/addon-web-links/lib/xterm-addon-web-links.mjs",
      "@xterm/addon-webgl": "./addons/addon-webgl/lib/xterm-addon-webgl.mjs",
      "@xterm/addon-unicode11": "./addons/addon-unicode11/lib/xterm-addon-unicode11.mjs",
      "@xterm/addon-unicode-graphemes": "./addons/addon-unicode-graphemes/lib/xterm-addon-unicode-graphemes.mjs",

      // Needed for out-tsc based image addon
      "common/Lifecycle": "./src/common/Lifecycle.ts",
    }
  }
};

if (config.isWatch) {
  context(bundleConfig).then(e => e.watch());
  if (!skipOut) {
    context(outConfig).then(e => e.watch());
  }
  // if (!skipOutTest) {
  //   context(outTestConfig).then(e => e.watch());
  // }
} else {
  await build(bundleConfig);
  if (!skipOut) {
    await build(outConfig);
  }
  // if (!skipOutTest) {
  //   await build(outTestConfig);
  // }
}
