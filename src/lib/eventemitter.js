"use strict";


class EventEmitter {

  initialize() {
    this._events = this._events || {};
    this.on  = this.addListener
    this.off = this.removeListener
  }

  addListener(type, listener) {
    this._events[type] = this._events[type] || [];
    this._events[type].push(listener);
  }

  removeListener(type, listener) {
    if (!this._events[type]) return;

    var obj = this._events[type]
      , i = obj.length;

    while (i--) {
      if (obj[i] === listener || obj[i].listener === listener) {
        obj.splice(i, 1);
        return;
      }
    }
  }


  removeAllListeners(type) {
    if (this._events[type]) delete this._events[type];
  }

  once(type, listener) {
    var self = this;
    function on() {
      var args = Array.prototype.slice.call(arguments);
      this.removeListener(type, on);
      return listener.apply(this, args);
    }
    on.listener = listener;
    return this.on(type, on);
  }


  emit(type) {
      if (!this._events[type]) return;

      var args = Array.prototype.slice.call(arguments, 1)
        , obj = this._events[type]
        , l = obj.length
        , i = 0;

      for (; i < l; i++) {
        obj[i].apply(this, args);
      }
    }

    listeners(type) {
      return this._events[type] = this._events[type] || [];
    }
}


module.exports = EventEmitter;