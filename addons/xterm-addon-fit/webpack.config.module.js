/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

const path = require('path');

const addonName = 'FitAddon';
const mainFile = 'xterm-addon-fit.js';

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
  experiments: {
    outputModule: true
  },
  output: {
    filename: mainFile,
    path: path.resolve('./lib/es6'),
    libraryTarget: 'module'
  },
  mode: 'production'
};
