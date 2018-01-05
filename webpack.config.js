const path = require('path');

module.exports = {
  entry: './demo/main.js',
  output: {
    path: path.resolve(__dirname, 'demo/dist'),
    filename: 'bundle.js'
  },
  devtool: 'source-map'
};
