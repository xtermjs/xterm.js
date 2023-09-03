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
  entry: path.resolve(__dirname, 'client.ts'),
  devtool: 'inline-source-map',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.js$/,
        use: ["source-map-loader"],
        enforce: "pre",
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    modules: [
      'node_modules',
      path.resolve(__dirname, '..'),
      path.resolve(__dirname, '../addons')
    ],
    extensions: [ '.tsx', '.ts', '.js' ],
    alias: {
      common: path.resolve('./out/common'),
      browser: path.resolve('./out/browser')
    },
    fallback: {
      // The ligature modules contains fallbacks for node environments, we never want to browserify them
      stream: false,
      util: false,
      os: false,
      path: false,
      fs: false
    }
  },
  output: {
    filename: 'client-bundle.js',
    path: path.resolve(__dirname, 'dist')
  },
  mode: 'development'
};
module.exports = config;
