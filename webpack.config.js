/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

// @ts-check

const path = require('path');

/**
 * This webpack config does a production build for xterm.js. It works by taking the output from tsc
 * (via `yarn watch` or `yarn prebuild`) which are put into `out/` and webpacks them into a
 * production mode umd library module in `lib/`. The aliases are used fix up the absolute paths
 * output by tsc (because of `baseUrl` and `paths` in `tsconfig.json`.
 *
 * @type {import('webpack').Configuration}
 */
const config = {
  entry: './out/browser/public/Terminal.js',
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.js$/,
        use: ["source-map-loader"],
        enforce: "pre",
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    modules: ['./node_modules'],
    extensions: [ '.js' ],
    alias: {
      common: path.resolve('./out/common'),
      browser: path.resolve('./out/browser')
    }
  },
  output: {
    filename: 'xterm.js',
    path: path.resolve('./lib'),
    libraryTarget: 'umd',
    // Force usage of globalThis instead of global / self. (This is cross-env compatible)
    globalObject: 'globalThis',
  },
  mode: 'production',
};
module.exports = config;
