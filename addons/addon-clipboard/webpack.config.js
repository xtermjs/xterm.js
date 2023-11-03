/**
 * Copyright (c) 2023 The xterm.js authors. All rights reserved.
 * @license MIT
 */

const path = require('path');

const addonName = 'ClipboardAddon';
const mainFile = 'addon-clipboard.js';

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
    libraryTarget: 'umd'
  },
  mode: 'production'
};
