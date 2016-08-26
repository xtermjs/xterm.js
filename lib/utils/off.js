"use strict";

function off(el, type, handler, capture) {
  el.removeEventListener(type, handler, capture || false);
}

module.exports = off;