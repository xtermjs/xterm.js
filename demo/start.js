/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

// @ts-check

const clientConfig = require('./webpack.config');
const webpack = require('webpack');
const startServer = require('./server.js');

startServer();

const compiler = webpack(clientConfig);

compiler.watch({
  aggregateTimeout: 300,
  poll: undefined
}, (err, stats) => {
  if (err) {
    console.error(err);
  }
  console.log(stats?.toString({
    colors: true
  }));
});
