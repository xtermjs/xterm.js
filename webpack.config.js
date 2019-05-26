const path = require('path');

module.exports = {
  entry: './lib/public/Terminal.js',
  devtool: 'inline-source-map',
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
      common: path.resolve('./lib/common'),
      core: path.resolve('./lib/core')
    }
  },
  output: {
    filename: 'xterm.js',
    path: path.resolve('./lib2'),
    library: 'Terminal',
    libraryTarget: 'umd'
  },
  mode: 'development',
  watch: true
};
