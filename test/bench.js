/**
 * term.js
 * Copyright (c) 2012-2013, Christopher Jeffrey (MIT License)
 */

var element = {
  createElement: function() { return element; },
  appendChild: function() {},
  removeChild: function() {},
  addEventListener: function() {},
  removeEventListener: function() {},
  setAttribute: function() {},
  style: {}
};

global.window = global;
window.navigator = { userAgent: '' };
window.document = element;
window.document.body = element;

element.ownerDocument = window.document;
window.document.defaultView = window;

var Terminal = require('../src/term');
Terminal.cursorBlink = false;

var data = require('./data').data;

var term = new Terminal({
  cols: 250,
  rows: 100
});

term.open(element);

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
