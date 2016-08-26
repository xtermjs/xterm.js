"use strict";


function contains(el, arr) {
  for (var i = 0; i < arr.length; i += 1) {
    if (el === arr[i]) {
      return true;
    }
  }
  return false;
}

module.exports = contains;
