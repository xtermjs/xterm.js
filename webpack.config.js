var webpack = require('webpack');
var path = require('path');

module.exports = {
  entry: './src/xterm.js',
  output: {
    // TODO: Expose an "xtermjs" object that contains Terminal
    library: 'Terminal',
    libraryTarget: "var",
    path: path.join(__dirname, './dist'),
    filename: 'xterm.js'
  },
  plugins: [
    new webpack.WatchIgnorePlugin([
        // TODO: Move addons to their own repositories/modules
        path.resolve(__dirname, './addons/'),
    ]),
  ]
};