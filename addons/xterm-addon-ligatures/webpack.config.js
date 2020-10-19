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
    libraryTarget: 'umd',
    globalObject: 'typeof self !== \'undefined\' ? self : this'
  },
  mode: 'production',
  externals: {
    'font-finder':'font-finder',
    'font-ligatures':'font-ligatures'
  }
};
