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
  isHeadless: argv.includes('--headless'),
  addon: argv.find(e => e.startsWith('--addon='))?.replace(/^--addon=/, ''),
};

// console.info('Running with config:', JSON.stringify(config, undefined, 2));

/** @type {esbuild.BuildOptions} */
const commonOptions = {
  bundle: true,
  format: 'esm',
  target: 'es2021',
  sourcemap: true,
  treeShaking: true,
  logLevel: 'debug',
};

/** @type {esbuild.BuildOptions} */
const devOptions = {
  minify: false,
};

/** @type {esbuild.BuildOptions} */
const prodOptions = {
  minify: true,
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
  ...commonOptions,
  ...(config.isProd ? prodOptions : devOptions)
};

/** @type {esbuild.BuildOptions} */
let outConfig = {
  format: 'cjs',
  sourcemap: true,
}
let skipOut = false;

/** @type {esbuild.BuildOptions} */
let outTestConfig = {
  format: 'cjs',
  sourcemap: true,
}
let skipOutTest = false;

if (config.addon) {
  bundleConfig = {
    ...bundleConfig,
    entryPoints: [`addons/addon-${config.addon}/src/${getAddonEntryPoint(config.addon)}.ts`],
    outfile: `addons/addon-${config.addon}/lib/addon-${config.addon}.mjs`,
  };
  outConfig = {
    ...outConfig,
    entryPoints: [`addons/addon-${config.addon}/src/**/*.ts`],
    outdir: `addons/addon-${config.addon}/out-esbuild/`
  };
  outTestConfig = {
    ...outConfig,
    entryPoints: [`addons/addon-${config.addon}/test/**/*.ts`],
    outdir: `addons/addon-${config.addon}/out-esbuild-test/`
  };

  if (config.addon === 'ligatures') {
    bundleConfig.platform = 'node';
    skipOutTest = true;
  }

  if (config.addon === 'serialize') {
    bundleConfig.tsconfig = 'addons/addon-serialize/src/tsconfig.json'
  }
} else if (config.isDemoClient) {
  bundleConfig = {
    ...bundleConfig,
    entryPoints: [`demo/client.ts`],
    outfile: 'demo/dist/client-bundle.js',
    external: ['util', 'os', 'fs', 'path', 'stream', 'Terminal'],
    alias: {
      // Library ESM imports
      "@xterm/xterm": ".",
      "@xterm/addon-attach": "./addons/addon-attach/lib/addon-attach.mjs",
      "@xterm/addon-clipboard": "./addons/addon-clipboard/lib/addon-clipboard.mjs",
      "@xterm/addon-fit": "./addons/addon-fit/lib/addon-fit.mjs",
      "@xterm/addon-image": "./addons/addon-image/lib/addon-image.mjs",
      "@xterm/addon-progress": "./addons/addon-progress/lib/addon-progress.mjs",
      "@xterm/addon-search": "./addons/addon-search/lib/addon-search.mjs",
      "@xterm/addon-serialize": "./addons/addon-serialize/lib/addon-serialize.mjs",
      "@xterm/addon-web-links": "./addons/addon-web-links/lib/addon-web-links.mjs",
      "@xterm/addon-webgl": "./addons/addon-webgl/lib/addon-webgl.mjs",
      "@xterm/addon-unicode11": "./addons/addon-unicode11/lib/addon-unicode11.mjs",
      "@xterm/addon-unicode-graphemes": "./addons/addon-unicode-graphemes/lib/addon-unicode-graphemes.mjs",

      // Non-bundled ESM imports
      // HACK: Ligatures imports fs which in the esbuild bundle resolves at runtime _on startup_
      //       instead of only when it's needed. This causes a `Dynamic require of "fs" is not
      //       supported` exception to be thrown. So the unbundled out-esbuild sources are used
      //       instead of the .mjs file which seems to resolve the issue.
      "@xterm/addon-ligatures": "./addons/addon-ligatures/out-esbuild/LigaturesAddon",
    }
  }
} else if (config.isHeadless) {
  bundleConfig = {
    ...bundleConfig,
    entryPoints: [`src/headless/public/Terminal.ts`],
    outfile: `headless/lib-headless/xterm-headless.mjs`
  };
  outConfig = {
    ...outConfig,
    entryPoints: ['src/**/*.ts'],
    outdir: 'out-esbuild/'
  };
  skipOut = true;
} else {
  bundleConfig = {
    ...bundleConfig,
    entryPoints: [`src/browser/public/Terminal.ts`],
    outfile: `lib/xterm.mjs`
  };
  outConfig = {
    ...outConfig,
    entryPoints: [
      'src/browser/**/*.ts',
      'src/common/**/*.ts',
      'src/headless/**/*.ts',
      'src/vs/base/**/*.ts',
      'src/vs/patches/**/*.ts'
    ],
    outdir: 'out-esbuild/'
  };
  outTestConfig = {
    ...outConfig,
    entryPoints: ['test/**/*.ts'],
    outdir: 'out-esbuild-test/'
  };
}

if (config.isWatch) {
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
