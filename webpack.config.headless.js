/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

const path = require('path');

/**
 * This webpack config does a production build for xterm.js headless. It works by taking the output
 * from tsc (via `yarn watch` or `yarn prebuild`) which are put into `out/` and webpacks them into a
 * production mode umd library module in `lib-headless/`. The aliases are used fix up the absolute
 * paths output by tsc (because of `baseUrl` and `paths` in `tsconfig.json`.
 */
module.exports = {
  entry: './out/headless/public/Terminal.js',
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
      headless: path.resolve('./out/headless')
    }
  },
  output: {
    filename: 'xterm-headless.js',
    path: path.resolve('./headless/lib-headless'),
    library: {
      type: 'commonjs'
    }
  },
  mode: 'production'
};
