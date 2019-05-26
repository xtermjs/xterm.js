/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

const path = require('path');

module.exports = {
  entry: './out/public/Terminal.js',
  resolve: {
    modules: ['./node_modules'],
    extensions: [ '.js' ],
    alias: {
      common: path.resolve('./out/common'),
      core: path.resolve('./out/core')
    }
  },
  output: {
    filename: 'xterm.js',
    path: path.resolve('./lib'),
    library: 'Terminal',
    libraryTarget: 'umd'
  },
  mode: 'production'
};
