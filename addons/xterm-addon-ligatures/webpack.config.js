/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

const path = require('path');

const addonName = 'LigaturesAddon';
const mainFile = 'xterm-addon-ligatures.js';

module.exports = {
  entry: `./out/${addonName}.js`,
  devtool: 'source-map',
  target: 'electron-renderer',
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
    libraryTarget: 'umd'
  },
  mode: 'production',
  externals: {
    'font-finder': 'font-finder',
    'stream': 'stream',
    'os': 'os',
    'util': 'util'
  },
  resolve: {
    // The ligature modules contains fallbacks for node environments, we never want to browserify them
    fallback: {
      stream: false,
      util: false,
      os: false,
      path: false
    }
  }
};
