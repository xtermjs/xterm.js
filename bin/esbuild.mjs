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
  target: 'es2021', // TODO: Upgrade
  logLevel: 'info',
};

/** @type {esbuild.BuildOptions} */
const devOptions = {
  sourcemap: true,
};

/** @type {esbuild.BuildOptions} */
const prodOptions = {
  minify: true,
  treeShaking: true,
  logLevel: 'debug',
  // mangleProps: /_.+/,
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
    outdir: `addons/addon-${config.addon}/out-esbuild-dev/`
  };
  outTestConfig = {
    ...outConfig,
    entryPoints: [`addons/addon-${config.addon}/test/**/*.ts`],
    outdir: `addons/addon-${config.addon}/out-esbuild-dev/test/`
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
    outdir: 'out-esbuild-dev/'
  };
  outTestConfig = {
    ...outConfig,
    entryPoints: ['test/**/*.ts'],
    outdir: 'out-esbuild-dev/test/'
  };
}

if (config.isDemoClient) {
  bundleConfig = {
    ...bundleConfig,
    entryPoints: [`demo/client.ts`],
    outfile: 'demo/dist/client-bundle.js',
    external: ['util', 'os', 'fs', 'path', 'stream'],
    alias: {
      "@xterm/xterm": ".",
      "@xterm/addon-attach": "./addons/addon-attach/lib/xterm-addon-attach.js",
      "@xterm/addon-canvas": "./addons/addon-canvas/lib/xterm-addon-canvas.js",
      "@xterm/addon-clipboard": "./addons/addon-clipboard/lib/xterm-addon-clipboard.js",
      "@xterm/addon-fit": "./addons/addon-fit/lib/xterm-addon-fit.js",
      // "@xterm/addon-image": "./addons/addon-image/lib/xterm-addon-image.js",
      // "@xterm/addon-ligatures": "./addons/addon-ligatures/lib/xterm-addon-ligatures.js",
      "@xterm/addon-search": "./addons/addon-search/lib/xterm-addon-search.js",
      "@xterm/addon-serialize": "./addons/addon-serialize/lib/xterm-addon-serialize.js",
      "@xterm/addon-web-links": "./addons/addon-web-links/lib/xterm-addon-web-links.js",
      "@xterm/addon-webgl": "./addons/addon-webgl/lib/xterm-addon-webgl.js",
      "@xterm/addon-unicode11": "./addons/addon-unicode11/lib/xterm-addon-unicode11.js",
      "@xterm/addon-unicode-graphemes": "./addons/addon-unicode-graphemes/lib/xterm-addon-unicode-graphemes.js",

      // Needed for out-tsc based image addon
      "common/Lifecycle": "./src/common/Lifecycle.ts",
    }
  }
};

// console.log(`${bundleConfig.entryPoints?.[0]} config:`, JSON.stringify(bundleConfig));
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
