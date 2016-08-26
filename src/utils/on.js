"use strict";

function on(el, type, handler, capture) {
  if (!Array.isArray(el)) {
    el = [el];
  }
  el.forEach(function (element) {
    element.addEventListener(type, handler, capture || false);
  });
}

module.exports = on;
