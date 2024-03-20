/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

const path = require('path');

const addonName = 'LigaturesAddon';
const mainFile = 'addon-ligatures.js';

module.exports = {
  entry: `./out/${addonName}.js`,
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
  output: {
    filename: mainFile,
    path: path.resolve('./lib'),
    library: addonName,
    libraryTarget: 'umd',
    // Force usage of globalThis instead of global / self. (This is cross-env compatible)
    globalObject: 'globalThis',
  },
  mode: 'production',
  externals: {
    'fs': 'fs',
    'path': 'path',
    'stream': 'stream',
    'util': 'util'
  },
  resolve: {
    // The ligature modules contains fallbacks for node environments, we never want to browserify them
    fallback: {
      fs: false,
      os: false,
      path: false,
      stream: false,
      util: false
    }
  }
};
