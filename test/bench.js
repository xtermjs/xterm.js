var element = {
  createElement: function() { return element; },
  appendChild: function() {},
  removeChild: function() {},
  addEventListener: function() {},
  removeEventListener: function() {},
  style: {}
};

global.window = global;
window.navigator = { userAgent: '' };
window.document = element;
window.document.body = element;

var Terminal = require('../static/term');
Terminal.cursorBlink = false;

var data = require('./data').data;

var term = new Terminal(250, 100);
term.open();

var time = new Date;
var t = 10;

while (t--) {
  var l = data.length
    , i = 0;

  for (; i < l; i++) {
    term.write(data[i]);
  }
}

console.log('Completed: %d.', new Date - time);
console.log('Average (?): 13.5k (for ~2.7k writes).');
