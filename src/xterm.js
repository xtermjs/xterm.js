/**
 * xterm.js: xterm, in the browser
 * Originally forked from (with the author's permission):
 *   Fabrice Bellard's javascript vt100 for jslinux:
 *   http://bellard.org/jslinux/
 *   Copyright (c) 2011 Fabrice Bellard
 *   The original design remains. The terminal itself
 *   has been extended to include xterm CSI codes, among
 *   other features.
 * @license MIT
 */

import { CompositionHelper } from './CompositionHelper.js';
import { EventEmitter } from './EventEmitter.js';
import { Viewport } from './Viewport.js';
import { rightClickHandler, pasteHandler, copyHandler } from './handlers/Clipboard.js';
import { CircularList } from './utils/CircularList.js';
import { C0 } from './EscapeSequences';
import { InputHandler } from './InputHandler';
import { Parser } from './Parser';
import { CharMeasure } from './utils/CharMeasure.js';
import * as Browser from './utils/Browser';
import * as Keyboard from './utils/Keyboard';
import { CHARSETS } from './Charsets';

/**
 * Terminal Emulation References:
 *   http://vt100.net/
 *   http://invisible-island.net/xterm/ctlseqs/ctlseqs.txt
 *   http://invisible-island.net/xterm/ctlseqs/ctlseqs.html
 *   http://invisible-island.net/vttest/
 *   http://www.inwap.com/pdp10/ansicode.txt
 *   http://linux.die.net/man/4/console_codes
 *   http://linux.die.net/man/7/urxvt
 */

// Let it work inside Node.js for automated testing purposes.
var document = (typeof window != 'undefined') ? window.document : null;

/**
 * States
 */
var normal = 0, escaped = 1, csi = 2, osc = 3, charset = 4, dcs = 5, ignore = 6;

/**
 * The amount of write requests to queue before sending an XOFF signal to the
 * pty process. This number must be small in order for ^C and similar sequences
 * to be responsive.
 */
var WRITE_BUFFER_PAUSE_THRESHOLD = 5;

/**
 * The number of writes to perform in a single batch before allowing the
 * renderer to catch up with a 0ms setTimeout.
 */
var WRITE_BATCH_SIZE = 300;

/**
 * The maximum number of refresh frames to skip when the write buffer is non-
 * empty. Note that these frames may be intermingled with frames that are
 * skipped via requestAnimationFrame's mechanism.
 */
var MAX_REFRESH_FRAME_SKIP = 5;

/**
 * Terminal
 */

/**
 * Creates a new `Terminal` object.
 *
 * @param {object} options An object containing a set of options, the available options are:
 *   - `cursorBlink` (boolean): Whether the terminal cursor blinks
 *   - `cols` (number): The number of columns of the terminal (horizontal size)
 *   - `rows` (number): The number of rows of the terminal (vertical size)
 *
 * @public
 * @class Xterm Xterm
 * @alias module:xterm/src/xterm
 */
function Terminal(options) {
  var self = this;

  if (!(this instanceof Terminal)) {
    return new Terminal(arguments[0], arguments[1], arguments[2]);
  }

  self.browser = Browser;
  self.cancel = Terminal.cancel;

  EventEmitter.call(this);

  if (typeof options === 'number') {
    options = {
      cols: arguments[0],
      rows: arguments[1],
      handler: arguments[2]
    };
  }

  options = options || {};


  Object.keys(Terminal.defaults).forEach(function(key) {
    if (options[key] == null) {
      options[key] = Terminal.options[key];

      if (Terminal[key] !== Terminal.defaults[key]) {
        options[key] = Terminal[key];
      }
    }
    self[key] = options[key];
  });

  if (options.colors.length === 8) {
    options.colors = options.colors.concat(Terminal._colors.slice(8));
  } else if (options.colors.length === 16) {
    options.colors = options.colors.concat(Terminal._colors.slice(16));
  } else if (options.colors.length === 10) {
    options.colors = options.colors.slice(0, -2).concat(
      Terminal._colors.slice(8, -2), options.colors.slice(-2));
  } else if (options.colors.length === 18) {
    options.colors = options.colors.concat(
      Terminal._colors.slice(16, -2), options.colors.slice(-2));
  }
  this.colors = options.colors;

  this.options = options;

  // this.context = options.context || window;
  // this.document = options.document || document;
  this.parent = options.body || options.parent || (
    document ? document.getElementsByTagName('body')[0] : null
  );

  this.cols = options.cols || options.geometry[0];
  this.rows = options.rows || options.geometry[1];
  this.geometry = [this.cols, this.rows];

  if (options.handler) {
    this.on('data', options.handler);
  }

  /**
   * The scroll position of the y cursor, ie. ybase + y = the y position within the entire
   * buffer
   */
  this.ybase = 0;

  /**
   * The scroll position of the viewport
   */
  this.ydisp = 0;

  /**
   * The cursor's x position after ybase
   */
  this.x = 0;

  /**
   * The cursor's y position after ybase
   */
  this.y = 0;

  /** A queue of the rows to be refreshed */
  this.refreshRowsQueue = [];

  this.cursorState = 0;
  this.cursorHidden = false;
  this.convertEol;
  this.queue = '';
  this.scrollTop = 0;
  this.scrollBottom = this.rows - 1;
  this.customKeydownHandler = null;

  // modes
  this.applicationKeypad = false;
  this.applicationCursor = false;
  this.originMode = false;
  this.insertMode = false;
  this.wraparoundMode = true; // defaults: xterm - true, vt100 - false
  this.normal = null;

  // charset
  this.charset = null;
  this.gcharset = null;
  this.glevel = 0;
  this.charsets = [null];

  // mouse properties
  this.decLocator;
  this.x10Mouse;
  this.vt200Mouse;
  this.vt300Mouse;
  this.normalMouse;
  this.mouseEvents;
  this.sendFocus;
  this.utfMouse;
  this.sgrMouse;
  this.urxvtMouse;

  // misc
  this.element;
  this.children;
  this.refreshStart;
  this.refreshEnd;
  this.savedX;
  this.savedY;
  this.savedCols;

  // stream
  this.readable = true;
  this.writable = true;

  this.defAttr = (0 << 18) | (257 << 9) | (256 << 0);
  this.curAttr = this.defAttr;

  this.params = [];
  this.currentParam = 0;
  this.prefix = '';
  this.postfix = '';

  this.inputHandler = new InputHandler(this);
  this.parser = new Parser(this.inputHandler, this);

  // user input states
  this.writeBuffer = [];
  this.writeInProgress = false;
  this.refreshFramesSkipped = 0;

  /**
   * Whether _xterm.js_ sent XOFF in order to catch up with the pty process.
   * This is a distinct state from writeStopped so that if the user requested
   * XOFF via ^S that it will not automatically resume when the writeBuffer goes
   * below threshold.
   */
  this.xoffSentToCatchUp = false;

  /** Whether writing has been stopped as a result of XOFF */
  this.writeStopped = false;

  // leftover surrogate high from previous write invocation
  this.surrogate_high = '';

  /**
   * An array of all lines in the entire buffer, including the prompt. The lines are array of
   * characters which are 2-length arrays where [0] is an attribute and [1] is the character.
   */
  this.lines = new CircularList(this.scrollback);
  var i = this.rows;
  while (i--) {
    this.lines.push(this.blankLine());
  }

  this.tabs;
  this.setupStops();

  // Store if user went browsing history in scrollback
  this.userScrolling = false;
}

inherits(Terminal, EventEmitter);

/**
 * back_color_erase feature for xterm.
 */
Terminal.prototype.eraseAttr = function() {
  // if (this.is('screen')) return this.defAttr;
  return (this.defAttr & ~0x1ff) | (this.curAttr & 0x1ff);
};

/**
 * Colors
 */

// Colors 0-15
Terminal.tangoColors = [
  // dark:
  '#2e3436',
  '#cc0000',
  '#4e9a06',
  '#c4a000',
  '#3465a4',
  '#75507b',
  '#06989a',
  '#d3d7cf',
  // bright:
  '#555753',
  '#ef2929',
  '#8ae234',
  '#fce94f',
  '#729fcf',
  '#ad7fa8',
  '#34e2e2',
  '#eeeeec'
];

// Colors 0-15 + 16-255
// Much thanks to TooTallNate for writing this.
Terminal.colors = (function() {
  var colors = Terminal.tangoColors.slice()
  , r = [0x00, 0x5f, 0x87, 0xaf, 0xd7, 0xff]
  , i;

  // 16-231
  i = 0;
  for (; i < 216; i++) {
    out(r[(i / 36) % 6 | 0], r[(i / 6) % 6 | 0], r[i % 6]);
  }

  // 232-255 (grey)
  i = 0;
  for (; i < 24; i++) {
    r = 8 + i * 10;
    out(r, r, r);
  }

  function out(r, g, b) {
    colors.push('#' + hex(r) + hex(g) + hex(b));
  }

  function hex(c) {
    c = c.toString(16);
    return c.length < 2 ? '0' + c : c;
  }

  return colors;
})();

Terminal._colors = Terminal.colors.slice();

Terminal.vcolors = (function() {
  var out = []
  , colors = Terminal.colors
  , i = 0
  , color;

  for (; i < 256; i++) {
    color = parseInt(colors[i].substring(1), 16);
    out.push([
      (color >> 16) & 0xff,
      (color >> 8) & 0xff,
      color & 0xff
    ]);
  }

  return out;
})();

/**
 * Options
 */

Terminal.defaults = {
  colors: Terminal.colors,
  theme: 'default',
  convertEol: false,
  termName: 'xterm',
  geometry: [80, 24],
  cursorBlink: false,
  visualBell: false,
  popOnBell: false,
  scrollback: 1000,
  screenKeys: false,
  debug: false,
  cancelEvents: false,
  disableStdin: false
  // programFeatures: false,
  // focusKeys: false,
};

Terminal.options = {};

Terminal.focus = null;

each(keys(Terminal.defaults), function(key) {
  Terminal[key] = Terminal.defaults[key];
  Terminal.options[key] = Terminal.defaults[key];
});

/**
 * Focus the terminal. Delegates focus handling to the terminal's DOM element.
 */
Terminal.prototype.focus = function() {
  return this.textarea.focus();
};

/**
 * Retrieves an option's value from the terminal.
 * @param {string} key The option key.
 */
Terminal.prototype.getOption = function(key, value) {
  if (!(key in Terminal.defaults)) {
    throw new Error('No option with key "' + key + '"');
  }

  if (typeof this.options[key] !== 'undefined') {
    return this.options[key];
  }

  return this[key];
};

/**
 * Sets an option on the terminal.
 * @param {string} key The option key.
 * @param {string} value The option value.
 */
Terminal.prototype.setOption = function(key, value) {
  if (!(key in Terminal.defaults)) {
    throw new Error('No option with key "' + key + '"');
  }
  this[key] = value;
  this.options[key] = value;
};

/**
 * Binds the desired focus behavior on a given terminal object.
 *
 * @static
 */
Terminal.bindFocus = function (term) {
  on(term.textarea, 'focus', function (ev) {
    if (term.sendFocus) {
      term.send(C0.ESC + '[I');
    }
    term.element.classList.add('focus');
    term.showCursor();
    Terminal.focus = term;
    term.emit('focus', {terminal: term});
  });
};

/**
 * Blur the terminal. Delegates blur handling to the terminal's DOM element.
 */
Terminal.prototype.blur = function() {
  return this.textarea.blur();
};

/**
 * Binds the desired blur behavior on a given terminal object.
 *
 * @static
 */
Terminal.bindBlur = function (term) {
  on(term.textarea, 'blur', function (ev) {
    term.queueRefresh(term.y, term.y);
    if (term.sendFocus) {
      term.send(C0.ESC + '[O');
    }
    term.element.classList.remove('focus');
    Terminal.focus = null;
    term.emit('blur', {terminal: term});
  });
};

/**
 * Initialize default behavior
 */
Terminal.prototype.initGlobal = function() {
  var term = this;

  Terminal.bindKeys(this);
  Terminal.bindFocus(this);
  Terminal.bindBlur(this);

  // Bind clipboard functionality
  on(this.element, 'copy', function (ev) {
    copyHandler.call(this, ev, term);
  });
  on(this.textarea, 'paste', function (ev) {
    pasteHandler.call(this, ev, term);
  });
  on(this.element, 'paste', function (ev) {
    pasteHandler.call(this, ev, term);
  });

  function rightClickHandlerWrapper (ev) {
    rightClickHandler.call(this, ev, term);
  }

  if (term.browser.isFirefox) {
    on(this.element, 'mousedown', function (ev) {
      if (ev.button == 2) {
        rightClickHandlerWrapper(ev);
      }
    });
  } else {
    on(this.element, 'contextmenu', rightClickHandlerWrapper);
  }
};

/**
 * Apply key handling to the terminal
 */
Terminal.bindKeys = function(term) {
  on(term.element, 'keydown', function(ev) {
    if (document.activeElement != this) {
      return;
    }
    term.keyDown(ev);
  }, true);

  on(term.element, 'keypress', function(ev) {
    if (document.activeElement != this) {
      return;
    }
    term.keyPress(ev);
  }, true);

  on(term.element, 'keyup', term.focus.bind(term));

  on(term.textarea, 'keydown', function(ev) {
    term.keyDown(ev);
  }, true);

  on(term.textarea, 'keypress', function(ev) {
    term.keyPress(ev);
    // Truncate the textarea's value, since it is not needed
    this.value = '';
  }, true);

  on(term.textarea, 'compositionstart', term.compositionHelper.compositionstart.bind(term.compositionHelper));
  on(term.textarea, 'compositionupdate', term.compositionHelper.compositionupdate.bind(term.compositionHelper));
  on(term.textarea, 'compositionend', term.compositionHelper.compositionend.bind(term.compositionHelper));
  term.on('refresh', term.compositionHelper.updateCompositionElements.bind(term.compositionHelper));
};


/**
 * Insert the given row to the terminal or produce a new one
 * if no row argument is passed. Return the inserted row.
 * @param {HTMLElement} row (optional) The row to append to the terminal.
 */
Terminal.prototype.insertRow = function (row) {
  if (typeof row != 'object') {
    row = document.createElement('div');
  }

  this.rowContainer.appendChild(row);
  this.children.push(row);

  return row;
};

/**
 * Opens the terminal within an element.
 *
 * @param {HTMLElement} parent The element to create the terminal within.
 */
Terminal.prototype.open = function(parent) {
  var self=this, i=0, div;

  this.parent = parent || this.parent;

  if (!this.parent) {
    throw new Error('Terminal requires a parent element.');
  }

  // Grab global elements
  this.context = this.parent.ownerDocument.defaultView;
  this.document = this.parent.ownerDocument;
  this.body = this.document.getElementsByTagName('body')[0];

  //Create main element container
  this.element = this.document.createElement('div');
  this.element.classList.add('terminal');
  this.element.classList.add('xterm');
  this.element.classList.add('xterm-theme-' + this.theme);

  this.element.style.height
  this.element.setAttribute('tabindex', 0);

  this.viewportElement = document.createElement('div');
  this.viewportElement.classList.add('xterm-viewport');
  this.element.appendChild(this.viewportElement);
  this.viewportScrollArea = document.createElement('div');
  this.viewportScrollArea.classList.add('xterm-scroll-area');
  this.viewportElement.appendChild(this.viewportScrollArea);

  // Create the container that will hold the lines of the terminal and then
  // produce the lines the lines.
  this.rowContainer = document.createElement('div');
  this.rowContainer.classList.add('xterm-rows');
  this.element.appendChild(this.rowContainer);
  this.children = [];

  // Create the container that will hold helpers like the textarea for
  // capturing DOM Events. Then produce the helpers.
  this.helperContainer = document.createElement('div');
  this.helperContainer.classList.add('xterm-helpers');
  // TODO: This should probably be inserted once it's filled to prevent an additional layout
  this.element.appendChild(this.helperContainer);
  this.textarea = document.createElement('textarea');
  this.textarea.classList.add('xterm-helper-textarea');
  this.textarea.setAttribute('autocorrect', 'off');
  this.textarea.setAttribute('autocapitalize', 'off');
  this.textarea.setAttribute('spellcheck', 'false');
  this.textarea.tabIndex = 0;
  this.textarea.addEventListener('focus', function() {
    self.emit('focus', {terminal: self});
  });
  this.textarea.addEventListener('blur', function() {
    self.emit('blur', {terminal: self});
  });
  this.helperContainer.appendChild(this.textarea);

  this.compositionView = document.createElement('div');
  this.compositionView.classList.add('composition-view');
  this.compositionHelper = new CompositionHelper(this.textarea, this.compositionView, this);
  this.helperContainer.appendChild(this.compositionView);

  this.charSizeStyleElement = document.createElement('style');
  this.helperContainer.appendChild(this.charSizeStyleElement);

  for (; i < this.rows; i++) {
    this.insertRow();
  }
  this.parent.appendChild(this.element);

  this.charMeasure = new CharMeasure(this.rowContainer);
  this.charMeasure.on('charsizechanged', function () {
    self.updateCharSizeCSS();
  });
  this.charMeasure.measure();

  this.viewport = new Viewport(this, this.viewportElement, this.viewportScrollArea, this.charMeasure);

  // Setup loop that draws to screen
  this.queueRefresh(0, this.rows - 1);
  this.refreshLoop();

  // Initialize global actions that
  // need to be taken on the document.
  this.initGlobal();

  // Ensure there is a Terminal.focus.
  this.focus();

  on(this.element, 'click', function() {
    var selection = document.getSelection(),
        collapsed = selection.isCollapsed,
        isRange = typeof collapsed == 'boolean' ? !collapsed : selection.type == 'Range';
    if (!isRange) {
      self.focus();
    }
  });

  // Listen for mouse events and translate
  // them into terminal mouse protocols.
  this.bindMouse();

  // Figure out whether boldness affects
  // the character width of monospace fonts.
  if (Terminal.brokenBold == null) {
    Terminal.brokenBold = isBoldBroken(this.document);
  }

  /**
   * This event is emitted when terminal has completed opening.
   *
   * @event open
   */
  this.emit('open');
};


/**
 * Attempts to load an add-on using CommonJS or RequireJS (whichever is available).
 * @param {string} addon The name of the addon to load
 * @static
 */
Terminal.loadAddon = function(addon, callback) {
  if (typeof exports === 'object' && typeof module === 'object') {
    // CommonJS
    return require('./addons/' + addon + '/' + addon);
  } else if (typeof define == 'function') {
    // RequireJS
    return require(['./addons/' + addon + '/' + addon], callback);
  } else {
    console.error('Cannot load a module without a CommonJS or RequireJS environment.');
    return false;
  }
};

/**
 * Updates the helper CSS class with any changes necessary after the terminal's
 * character width has been changed.
 */
Terminal.prototype.updateCharSizeCSS = function() {
  this.charSizeStyleElement.textContent = '.xterm-wide-char{width:' + (this.charMeasure.width * 2) + 'px;}';
}

/**
 * XTerm mouse events
 * http://invisible-island.net/xterm/ctlseqs/ctlseqs.html#Mouse%20Tracking
 * To better understand these
 * the xterm code is very helpful:
 * Relevant files:
 *   button.c, charproc.c, misc.c
 * Relevant functions in xterm/button.c:
 *   BtnCode, EmitButtonCode, EditorButton, SendMousePosition
 */
Terminal.prototype.bindMouse = function() {
  var el = this.element, self = this, pressed = 32;

  // mouseup, mousedown, wheel
  // left click: ^[[M 3<^[[M#3<
  // wheel up: ^[[M`3>
  function sendButton(ev) {
    var button
    , pos;

    // get the xterm-style button
    button = getButton(ev);

    // get mouse coordinates
    pos = getCoords(ev);
    if (!pos) return;

    sendEvent(button, pos);

    switch (ev.overrideType || ev.type) {
      case 'mousedown':
        pressed = button;
        break;
      case 'mouseup':
        // keep it at the left
        // button, just in case.
        pressed = 32;
        break;
      case 'wheel':
        // nothing. don't
        // interfere with
        // `pressed`.
        break;
    }
  }

  // motion example of a left click:
  // ^[[M 3<^[[M@4<^[[M@5<^[[M@6<^[[M@7<^[[M#7<
  function sendMove(ev) {
    var button = pressed
    , pos;

    pos = getCoords(ev);
    if (!pos) return;

    // buttons marked as motions
    // are incremented by 32
    button += 32;

    sendEvent(button, pos);
  }

  // encode button and
  // position to characters
  function encode(data, ch) {
    if (!self.utfMouse) {
      if (ch === 255) return data.push(0);
      if (ch > 127) ch = 127;
      data.push(ch);
    } else {
      if (ch === 2047) return data.push(0);
      if (ch < 127) {
        data.push(ch);
      } else {
        if (ch > 2047) ch = 2047;
        data.push(0xC0 | (ch >> 6));
        data.push(0x80 | (ch & 0x3F));
      }
    }
  }

  // send a mouse event:
  // regular/utf8: ^[[M Cb Cx Cy
  // urxvt: ^[[ Cb ; Cx ; Cy M
  // sgr: ^[[ Cb ; Cx ; Cy M/m
  // vt300: ^[[ 24(1/3/5)~ [ Cx , Cy ] \r
  // locator: CSI P e ; P b ; P r ; P c ; P p & w
  function sendEvent(button, pos) {
    // self.emit('mouse', {
    //   x: pos.x - 32,
    //   y: pos.x - 32,
    //   button: button
    // });

    if (self.vt300Mouse) {
      // NOTE: Unstable.
      // http://www.vt100.net/docs/vt3xx-gp/chapter15.html
      button &= 3;
      pos.x -= 32;
      pos.y -= 32;
      var data = C0.ESC + '[24';
      if (button === 0) data += '1';
      else if (button === 1) data += '3';
      else if (button === 2) data += '5';
      else if (button === 3) return;
      else data += '0';
      data += '~[' + pos.x + ',' + pos.y + ']\r';
      self.send(data);
      return;
    }

    if (self.decLocator) {
      // NOTE: Unstable.
      button &= 3;
      pos.x -= 32;
      pos.y -= 32;
      if (button === 0) button = 2;
      else if (button === 1) button = 4;
      else if (button === 2) button = 6;
      else if (button === 3) button = 3;
      self.send(C0.ESC + '['
                + button
                + ';'
                + (button === 3 ? 4 : 0)
                + ';'
                + pos.y
                + ';'
                + pos.x
                + ';'
                + (pos.page || 0)
                + '&w');
      return;
    }

    if (self.urxvtMouse) {
      pos.x -= 32;
      pos.y -= 32;
      pos.x++;
      pos.y++;
      self.send(C0.ESC + '[' + button + ';' + pos.x + ';' + pos.y + 'M');
      return;
    }

    if (self.sgrMouse) {
      pos.x -= 32;
      pos.y -= 32;
      self.send(C0.ESC + '[<'
                + (((button & 3) === 3 ? button & ~3 : button) - 32)
                + ';'
                + pos.x
                + ';'
                + pos.y
                + ((button & 3) === 3 ? 'm' : 'M'));
      return;
    }

    var data = [];

    encode(data, button);
    encode(data, pos.x);
    encode(data, pos.y);

    self.send(C0.ESC + '[M' + String.fromCharCode.apply(String, data));
  }

  function getButton(ev) {
    var button
    , shift
    , meta
    , ctrl
    , mod;

    // two low bits:
    // 0 = left
    // 1 = middle
    // 2 = right
    // 3 = release
    // wheel up/down:
    // 1, and 2 - with 64 added
    switch (ev.overrideType || ev.type) {
      case 'mousedown':
        button = ev.button != null
          ? +ev.button
        : ev.which != null
          ? ev.which - 1
        : null;

        if (self.browser.isMSIE) {
          button = button === 1 ? 0 : button === 4 ? 1 : button;
        }
        break;
      case 'mouseup':
        button = 3;
        break;
      case 'DOMMouseScroll':
        button = ev.detail < 0
          ? 64
        : 65;
        break;
      case 'wheel':
        button = ev.wheelDeltaY > 0
          ? 64
        : 65;
        break;
    }

    // next three bits are the modifiers:
    // 4 = shift, 8 = meta, 16 = control
    shift = ev.shiftKey ? 4 : 0;
    meta = ev.metaKey ? 8 : 0;
    ctrl = ev.ctrlKey ? 16 : 0;
    mod = shift | meta | ctrl;

    // no mods
    if (self.vt200Mouse) {
      // ctrl only
      mod &= ctrl;
    } else if (!self.normalMouse) {
      mod = 0;
    }

    // increment to SP
    button = (32 + (mod << 2)) + button;

    return button;
  }

  // mouse coordinates measured in cols/rows
  function getCoords(ev) {
    var x, y, w, h, el;

    // ignore browsers without pageX for now
    if (ev.pageX == null) return;

    x = ev.pageX;
    y = ev.pageY;
    el = self.element;

    // should probably check offsetParent
    // but this is more portable
    while (el && el !== self.document.documentElement) {
      x -= el.offsetLeft;
      y -= el.offsetTop;
      el = 'offsetParent' in el
        ? el.offsetParent
      : el.parentNode;
    }

    // convert to cols/rows
    w = self.element.clientWidth;
    h = self.element.clientHeight;
    x = Math.ceil((x / w) * self.cols);
    y = Math.ceil((y / h) * self.rows);

    // be sure to avoid sending
    // bad positions to the program
    if (x < 0) x = 0;
    if (x > self.cols) x = self.cols;
    if (y < 0) y = 0;
    if (y > self.rows) y = self.rows;

    // xterm sends raw bytes and
    // starts at 32 (SP) for each.
    x += 32;
    y += 32;

    return {
      x: x,
      y: y,
      type: 'wheel'
    };
  }

  on(el, 'mousedown', function(ev) {
    if (!self.mouseEvents) return;

    // send the button
    sendButton(ev);

    // ensure focus
    self.focus();

    // fix for odd bug
    //if (self.vt200Mouse && !self.normalMouse) {
    if (self.vt200Mouse) {
      ev.overrideType = 'mouseup';
      sendButton(ev);
      return self.cancel(ev);
    }

    // bind events
    if (self.normalMouse) on(self.document, 'mousemove', sendMove);

    // x10 compatibility mode can't send button releases
    if (!self.x10Mouse) {
      on(self.document, 'mouseup', function up(ev) {
        sendButton(ev);
        if (self.normalMouse) off(self.document, 'mousemove', sendMove);
        off(self.document, 'mouseup', up);
        return self.cancel(ev);
      });
    }

    return self.cancel(ev);
  });

  //if (self.normalMouse) {
  //  on(self.document, 'mousemove', sendMove);
  //}

  on(el, 'wheel', function(ev) {
    if (!self.mouseEvents) return;
    if (self.x10Mouse
        || self.vt300Mouse
        || self.decLocator) return;
    sendButton(ev);
    return self.cancel(ev);
  });

  // allow wheel scrolling in
  // the shell for example
  on(el, 'wheel', function(ev) {
    if (self.mouseEvents) return;
    self.viewport.onWheel(ev);
    return self.cancel(ev);
  });
};

/**
 * Destroys the terminal.
 */
Terminal.prototype.destroy = function() {
  this.readable = false;
  this.writable = false;
  this._events = {};
  this.handler = function() {};
  this.write = function() {};
  if (this.element.parentNode) {
    this.element.parentNode.removeChild(this.element);
  }
  //this.emit('close');
};


/**
 * Flags used to render terminal text properly
 */
Terminal.flags = {
  BOLD: 1,
  UNDERLINE: 2,
  BLINK: 4,
  INVERSE: 8,
  INVISIBLE: 16
}

/**
 * Queues a refresh between two rows (inclusive), to be done on next animation
 * frame.
 * @param {number} start The start row.
 * @param {number} end The end row.
 */
Terminal.prototype.queueRefresh = function(start, end) {
  this.refreshRowsQueue.push({ start: start, end: end });
}

/**
 * Performs the refresh loop callback, calling refresh only if a refresh is
 * necessary before queueing up the next one.
 */
Terminal.prototype.refreshLoop = function() {
  // Don't refresh if there were no row changes
  if (this.refreshRowsQueue.length > 0) {
    // Skip MAX_REFRESH_FRAME_SKIP frames if the writeBuffer is non-empty as it
    // will need to be immediately refreshed anyway. This saves a lot of
    // rendering time as the viewport DOM does not need to be refreshed, no
    // scroll events, no layouts, etc.
    var skipFrame = this.writeBuffer.length > 0 && this.refreshFramesSkipped++ <= MAX_REFRESH_FRAME_SKIP;

    if (!skipFrame) {
      this.refreshFramesSkipped = 0;
      var start;
      var end;
      if (this.refreshRowsQueue.length > 4) {
        // Just do a full refresh when 5+ refreshes are queued
        start = 0;
        end = this.rows - 1;
      } else {
        // Get start and end rows that need refreshing
        start = this.refreshRowsQueue[0].start;
        end = this.refreshRowsQueue[0].end;
        for (var i = 1; i < this.refreshRowsQueue.length; i++) {
          if (this.refreshRowsQueue[i].start < start) {
            start = this.refreshRowsQueue[i].start;
          }
          if (this.refreshRowsQueue[i].end > end) {
            end = this.refreshRowsQueue[i].end;
          }
        }
      }
      this.refreshRowsQueue = [];
      this.refresh(start, end);
    }
  }
  window.requestAnimationFrame(this.refreshLoop.bind(this));
}

/**
 * Refreshes (re-renders) terminal content within two rows (inclusive)
 *
 * Rendering Engine:
 *
 * In the screen buffer, each character is stored as a an array with a character
 * and a 32-bit integer:
 *   - First value: a utf-16 character.
 *   - Second value:
 *   - Next 9 bits: background color (0-511).
 *   - Next 9 bits: foreground color (0-511).
 *   - Next 14 bits: a mask for misc. flags:
 *     - 1=bold
 *     - 2=underline
 *     - 4=blink
 *     - 8=inverse
 *     - 16=invisible
 *
 * @param {number} start The row to start from (between 0 and terminal's height terminal - 1)
 * @param {number} end The row to end at (between fromRow and terminal's height terminal - 1)
 */
Terminal.prototype.refresh = function(start, end) {
  var self = this;

  var x, y, i, line, out, ch, ch_width, width, data, attr, bg, fg, flags, row, parent, focused = document.activeElement;

  // If this is a big refresh, remove the terminal rows from the DOM for faster calculations
  if (end - start >= this.rows / 2) {
    parent = this.element.parentNode;
    if (parent) {
      this.element.removeChild(this.rowContainer);
    }
  }

  width = this.cols;
  y = start;

  if (end >= this.rows.length) {
    this.log('`end` is too large. Most likely a bad CSR.');
    end = this.rows.length - 1;
  }

  for (; y <= end; y++) {
    row = y + this.ydisp;

    line = this.lines.get(row);
    out = '';

    if (this.y === y - (this.ybase - this.ydisp)
        && this.cursorState
        && !this.cursorHidden) {
      x = this.x;
    } else {
      x = -1;
    }

    attr = this.defAttr;
    i = 0;

    for (; i < width; i++) {
      data = line[i][0];
      ch = line[i][1];
      ch_width = line[i][2];
      if (!ch_width)
        continue;

      if (i === x) data = -1;

      if (data !== attr) {
        if (attr !== this.defAttr) {
          out += '</span>';
        }
        if (data !== this.defAttr) {
          if (data === -1) {
            out += '<span class="reverse-video terminal-cursor';
            if (this.cursorBlink) {
              out += ' blinking';
            }
            out += '">';
          } else {
            var classNames = [];

            bg = data & 0x1ff;
            fg = (data >> 9) & 0x1ff;
            flags = data >> 18;

            if (flags & Terminal.flags.BOLD) {
              if (!Terminal.brokenBold) {
                classNames.push('xterm-bold');
              }
              // See: XTerm*boldColors
              if (fg < 8) fg += 8;
            }

            if (flags & Terminal.flags.UNDERLINE) {
              classNames.push('xterm-underline');
            }

            if (flags & Terminal.flags.BLINK) {
              classNames.push('xterm-blink');
            }

            // If inverse flag is on, then swap the foreground and background variables.
            if (flags & Terminal.flags.INVERSE) {
              /* One-line variable swap in JavaScript: http://stackoverflow.com/a/16201730 */
              bg = [fg, fg = bg][0];
              // Should inverse just be before the
              // above boldColors effect instead?
              if ((flags & 1) && fg < 8) fg += 8;
            }

            if (flags & Terminal.flags.INVISIBLE) {
              classNames.push('xterm-hidden');
            }

            /**
             * Weird situation: Invert flag used black foreground and white background results
             * in invalid background color, positioned at the 256 index of the 256 terminal
             * color map. Pin the colors manually in such a case.
             *
             * Source: https://github.com/sourcelair/xterm.js/issues/57
             */
            if (flags & Terminal.flags.INVERSE) {
              if (bg == 257) {
                bg = 15;
              }
              if (fg == 256) {
                fg = 0;
              }
            }

            if (bg < 256) {
              classNames.push('xterm-bg-color-' + bg);
            }

            if (fg < 256) {
              classNames.push('xterm-color-' + fg);
            }

            out += '<span';
            if (classNames.length) {
              out += ' class="' + classNames.join(' ') + '"';
            }
            out += '>';
          }
        }
      }

      if (ch_width === 2) {
        out += '<span class="xterm-wide-char">';
      }
      switch (ch) {
        case '&':
          out += '&amp;';
          break;
        case '<':
          out += '&lt;';
          break;
        case '>':
          out += '&gt;';
          break;
        default:
          if (ch <= ' ') {
            out += '&nbsp;';
          } else {
            out += ch;
          }
          break;
      }
      if (ch_width === 2) {
        out += '</span>';
      }

      attr = data;
    }

    if (attr !== this.defAttr) {
      out += '</span>';
    }

    this.children[y].innerHTML = out;
  }

  if (parent) {
    this.element.appendChild(this.rowContainer);
  }

  this.emit('refresh', {element: this.element, start: start, end: end});
};

/**
 * Display the cursor element
 */
Terminal.prototype.showCursor = function() {
  if (!this.cursorState) {
    this.cursorState = 1;
    this.queueRefresh(this.y, this.y);
  }
};

/**
 * Scroll the terminal down 1 row, creating a blank line.
 */
Terminal.prototype.scroll = function() {
  var row;

  // Make room for the new row in lines
  if (this.lines.length === this.lines.maxLength) {
    this.lines.trimStart(1);
    this.ybase--;
    if (this.ydisp !== 0) {
      this.ydisp--;
    }
  }

  this.ybase++;

  // TODO: Why is this done twice?
  if (!this.userScrolling) {
    this.ydisp = this.ybase;
  }

  // last line
  row = this.ybase + this.rows - 1;

  // subtract the bottom scroll region
  row -= this.rows - 1 - this.scrollBottom;

  if (row === this.lines.length) {
    // Optimization: pushing is faster than splicing when they amount to the same behavior
    this.lines.push(this.blankLine());
  } else {
    // add our new line
    this.lines.splice(row, 0, this.blankLine());
  }

  if (this.scrollTop !== 0) {
    if (this.ybase !== 0) {
      this.ybase--;
      if (!this.userScrolling) {
        this.ydisp = this.ybase;
      }
    }
    this.lines.splice(this.ybase + this.scrollTop, 1);
  }

  // this.maxRange();
  this.updateRange(this.scrollTop);
  this.updateRange(this.scrollBottom);

  /**
   * This event is emitted whenever the terminal is scrolled.
   * The one parameter passed is the new y display position.
   *
   * @event scroll
   */
  this.emit('scroll', this.ydisp);
};

/**
 * Scroll the display of the terminal
 * @param {number} disp The number of lines to scroll down (negatives scroll up).
 * @param {boolean} suppressScrollEvent Don't emit the scroll event as scrollDisp. This is used
 * to avoid unwanted events being handled by the veiwport when the event was triggered from the
 * viewport originally.
 */
Terminal.prototype.scrollDisp = function(disp, suppressScrollEvent) {
  if (disp < 0) {
    this.userScrolling = true;
  } else if (disp + this.ydisp >= this.ybase) {
    this.userScrolling = false;
  }

  this.ydisp += disp;

  if (this.ydisp > this.ybase) {
    this.ydisp = this.ybase;
  } else if (this.ydisp < 0) {
    this.ydisp = 0;
  }

  if (!suppressScrollEvent) {
    this.emit('scroll', this.ydisp);
  }

  this.queueRefresh(0, this.rows - 1);
};

/**
 * Scroll the display of the terminal by a number of pages.
 * @param {number} pageCount The number of pages to scroll (negative scrolls up).
 */
Terminal.prototype.scrollPages = function(pageCount) {
  this.scrollDisp(pageCount * (this.rows - 1));
}

/**
 * Scrolls the display of the terminal to the top.
 */
Terminal.prototype.scrollToTop = function() {
  this.scrollDisp(-this.ydisp);
}

/**
 * Scrolls the display of the terminal to the bottom.
 */
Terminal.prototype.scrollToBottom = function() {
  this.scrollDisp(this.ybase - this.ydisp);
}

/**
 * Writes text to the terminal.
 * @param {string} text The text to write to the terminal.
 */
Terminal.prototype.write = function(data) {
  this.writeBuffer.push(data);

  // Send XOFF to pause the pty process if the write buffer becomes too large so
  // xterm.js can catch up before more data is sent. This is necessary in order
  // to keep signals such as ^C responsive.
  if (!this.xoffSentToCatchUp && this.writeBuffer.length >= WRITE_BUFFER_PAUSE_THRESHOLD) {
    // XOFF - stop pty pipe
    // XON will be triggered by emulator before processing data chunk
    this.send(C0.DC3);
    this.xoffSentToCatchUp = true;
  }

  if (!this.writeInProgress && this.writeBuffer.length > 0) {
    // Kick off a write which will write all data in sequence recursively
    this.writeInProgress = true;
    // Kick off an async innerWrite so more writes can come in while processing data
    var self = this;
    setTimeout(function () {
      self.innerWrite();
    });
  }
}

Terminal.prototype.innerWrite = function() {
  var writeBatch = this.writeBuffer.splice(0, WRITE_BATCH_SIZE);
  while (writeBatch.length > 0) {
    var data = writeBatch.shift();
    var l = data.length, i = 0, j, cs, ch, code, low, ch_width, row;

    // If XOFF was sent in order to catch up with the pty process, resume it if
    // the writeBuffer is empty to allow more data to come in.
    if (this.xoffSentToCatchUp && writeBatch.length === 0 && this.writeBuffer.length === 0) {
      this.send(C0.DC1);
      this.xoffSentToCatchUp = false;
    }

    this.refreshStart = this.y;
    this.refreshEnd = this.y;

    this.parser.parse(data);

    this.updateRange(this.y);
    this.queueRefresh(this.refreshStart, this.refreshEnd);
  }
  if (this.writeBuffer.length > 0) {
    // Allow renderer to catch up before processing the next batch
    var self = this;
    setTimeout(function () {
      self.innerWrite();
    }, 0);
  } else {
    this.writeInProgress = false;
  }
};

/**
 * Writes text to the terminal, followed by a break line character (\n).
 * @param {string} text The text to write to the terminal.
 */
Terminal.prototype.writeln = function(data) {
  this.write(data + '\r\n');
};

/**
 * Attaches a custom keydown handler which is run before keys are processed, giving consumers of
 * xterm.js ultimate control as to what keys should be processed by the terminal and what keys
 * should not.
 * @param {function} customKeydownHandler The custom KeyboardEvent handler to attach. This is a
 *   function that takes a KeyboardEvent, allowing consumers to stop propogation and/or prevent
 *   the default action. The function returns whether the event should be processed by xterm.js.
 */
Terminal.prototype.attachCustomKeydownHandler = function(customKeydownHandler) {
  this.customKeydownHandler = customKeydownHandler;
}

/**
 * Handle a keydown event
 * Key Resources:
 *   - https://developer.mozilla.org/en-US/docs/DOM/KeyboardEvent
 * @param {KeyboardEvent} ev The keydown event to be handled.
 */
Terminal.prototype.keyDown = function(ev) {
  if (this.customKeydownHandler && this.customKeydownHandler(ev) === false) {
    return false;
  }

  if (!this.compositionHelper.keydown.bind(this.compositionHelper)(ev)) {
    if (this.ybase !== this.ydisp) {
      this.scrollToBottom();
    }
    return false;
  }

  var self = this;
  var result = this.evaluateKeyEscapeSequence(ev);

  if (result.key === C0.DC3) { // XOFF
    this.writeStopped = true;
  } else if (result.key === C0.DC1) { // XON
    this.writeStopped = false;
  }

  if (result.scrollDisp) {
    this.scrollDisp(result.scrollDisp);
    return this.cancel(ev, true);
  }

  if (isThirdLevelShift(this, ev)) {
    return true;
  }

  if (result.cancel) {
    // The event is canceled at the end already, is this necessary?
    this.cancel(ev, true);
  }

  if (!result.key) {
    return true;
  }

  this.emit('keydown', ev);
  this.emit('key', result.key, ev);
  this.showCursor();
  this.handler(result.key);

  return this.cancel(ev, true);
};

/**
 * Returns an object that determines how a KeyboardEvent should be handled. The key of the
 * returned value is the new key code to pass to the PTY.
 *
 * Reference: http://invisible-island.net/xterm/ctlseqs/ctlseqs.html
 * @param {KeyboardEvent} ev The keyboard event to be translated to key escape sequence.
 */
Terminal.prototype.evaluateKeyEscapeSequence = function(ev) {
  var result = {
    // Whether to cancel event propogation (NOTE: this may not be needed since the event is
    // canceled at the end of keyDown
    cancel: false,
    // The new key even to emit
    key: undefined,
    // The number of characters to scroll, if this is defined it will cancel the event
    scrollDisp: undefined
  };
  var modifiers = ev.shiftKey << 0 | ev.altKey << 1 | ev.ctrlKey << 2 | ev.metaKey << 3;
  switch (ev.keyCode) {
    case 8:
      // backspace
      if (ev.shiftKey) {
        result.key = C0.BS; // ^H
        break;
      }
      result.key = C0.DEL; // ^?
      break;
    case 9:
      // tab
      if (ev.shiftKey) {
        result.key = C0.ESC + '[Z';
        break;
      }
      result.key = C0.HT;
      result.cancel = true;
      break;
    case 13:
      // return/enter
      result.key = C0.CR;
      result.cancel = true;
      break;
    case 27:
      // escape
      result.key = C0.ESC;
      result.cancel = true;
      break;
    case 37:
      // left-arrow
      if (modifiers) {
        result.key = C0.ESC + '[1;' + (modifiers + 1) + 'D';
        // HACK: Make Alt + left-arrow behave like Ctrl + left-arrow: move one word backwards
        // http://unix.stackexchange.com/a/108106
        // macOS uses different escape sequences than linux
        if (result.key == C0.ESC + '[1;3D') {
          result.key = (this.browser.isMac) ? C0.ESC + 'b' : C0.ESC + '[1;5D';
        }
      } else if (this.applicationCursor) {
        result.key = C0.ESC + 'OD';
      } else {
        result.key = C0.ESC + '[D';
      }
      break;
    case 39:
      // right-arrow
      if (modifiers) {
        result.key = C0.ESC + '[1;' + (modifiers + 1) + 'C';
        // HACK: Make Alt + right-arrow behave like Ctrl + right-arrow: move one word forward
        // http://unix.stackexchange.com/a/108106
        // macOS uses different escape sequences than linux
        if (result.key == C0.ESC + '[1;3C') {
          result.key = (this.browser.isMac) ? C0.ESC + 'f' : C0.ESC + '[1;5C';
        }
      } else if (this.applicationCursor) {
        result.key = C0.ESC + 'OC';
      } else {
        result.key = C0.ESC + '[C';
      }
      break;
    case 38:
      // up-arrow
      if (modifiers) {
        result.key = C0.ESC + '[1;' + (modifiers + 1) + 'A';
        // HACK: Make Alt + up-arrow behave like Ctrl + up-arrow
        // http://unix.stackexchange.com/a/108106
        if (result.key == C0.ESC + '[1;3A') {
          result.key = C0.ESC + '[1;5A';
        }
      } else if (this.applicationCursor) {
        result.key = C0.ESC + 'OA';
      } else {
        result.key = C0.ESC + '[A';
      }
      break;
    case 40:
      // down-arrow
      if (modifiers) {
        result.key = C0.ESC + '[1;' + (modifiers + 1) + 'B';
        // HACK: Make Alt + down-arrow behave like Ctrl + down-arrow
        // http://unix.stackexchange.com/a/108106
        if (result.key == C0.ESC + '[1;3B') {
          result.key = C0.ESC + '[1;5B';
        }
      } else if (this.applicationCursor) {
        result.key = C0.ESC + 'OB';
      } else {
        result.key = C0.ESC + '[B';
      }
      break;
    case 45:
      // insert
      if (!ev.shiftKey && !ev.ctrlKey) {
        // <Ctrl> or <Shift> + <Insert> are used to
        // copy-paste on some systems.
        result.key = C0.ESC + '[2~';
      }
      break;
    case 46:
      // delete
      if (modifiers) {
        result.key = C0.ESC + '[3;' + (modifiers + 1) + '~';
      } else {
        result.key = C0.ESC + '[3~';
      }
      break;
    case 36:
      // home
      if (modifiers)
        result.key = C0.ESC + '[1;' + (modifiers + 1) + 'H';
      else if (this.applicationCursor)
        result.key = C0.ESC + 'OH';
      else
        result.key = C0.ESC + '[H';
      break;
    case 35:
      // end
      if (modifiers)
        result.key = C0.ESC + '[1;' + (modifiers + 1) + 'F';
      else if (this.applicationCursor)
        result.key = C0.ESC + 'OF';
      else
        result.key = C0.ESC + '[F';
      break;
    case 33:
      // page up
      if (ev.shiftKey) {
        result.scrollDisp = -(this.rows - 1);
      } else {
        result.key = C0.ESC + '[5~';
      }
      break;
    case 34:
      // page down
      if (ev.shiftKey) {
        result.scrollDisp = this.rows - 1;
      } else {
        result.key = C0.ESC + '[6~';
      }
      break;
    case 112:
      // F1-F12
      if (modifiers) {
        result.key = C0.ESC + '[1;' + (modifiers + 1) + 'P';
      } else {
        result.key = C0.ESC + 'OP';
      }
      break;
    case 113:
      if (modifiers) {
        result.key = C0.ESC + '[1;' + (modifiers + 1) + 'Q';
      } else {
        result.key = C0.ESC + 'OQ';
      }
      break;
    case 114:
      if (modifiers) {
        result.key = C0.ESC + '[1;' + (modifiers + 1) + 'R';
      } else {
        result.key = C0.ESC + 'OR';
      }
      break;
    case 115:
      if (modifiers) {
        result.key = C0.ESC + '[1;' + (modifiers + 1) + 'S';
      } else {
        result.key = C0.ESC + 'OS';
      }
      break;
    case 116:
      if (modifiers) {
        result.key = C0.ESC + '[15;' + (modifiers + 1) + '~';
      } else {
        result.key = C0.ESC + '[15~';
      }
      break;
    case 117:
      if (modifiers) {
        result.key = C0.ESC + '[17;' + (modifiers + 1) + '~';
      } else {
        result.key = C0.ESC + '[17~';
      }
      break;
    case 118:
      if (modifiers) {
        result.key = C0.ESC + '[18;' + (modifiers + 1) + '~';
      } else {
        result.key = C0.ESC + '[18~';
      }
      break;
    case 119:
      if (modifiers) {
        result.key = C0.ESC + '[19;' + (modifiers + 1) + '~';
      } else {
        result.key = C0.ESC + '[19~';
      }
      break;
    case 120:
      if (modifiers) {
        result.key = C0.ESC + '[20;' + (modifiers + 1) + '~';
      } else {
        result.key = C0.ESC + '[20~';
      }
      break;
    case 121:
      if (modifiers) {
        result.key = C0.ESC + '[21;' + (modifiers + 1) + '~';
      } else {
        result.key = C0.ESC + '[21~';
      }
      break;
    case 122:
      if (modifiers) {
        result.key = C0.ESC + '[23;' + (modifiers + 1) + '~';
      } else {
        result.key = C0.ESC + '[23~';
      }
      break;
    case 123:
      if (modifiers) {
        result.key = C0.ESC + '[24;' + (modifiers + 1) + '~';
      } else {
        result.key = C0.ESC + '[24~';
      }
      break;
    default:
      // a-z and space
      if (ev.ctrlKey && !ev.shiftKey && !ev.altKey && !ev.metaKey) {
        if (ev.keyCode >= 65 && ev.keyCode <= 90) {
          result.key = String.fromCharCode(ev.keyCode - 64);
        } else if (ev.keyCode === 32) {
          // NUL
          result.key = String.fromCharCode(0);
        } else if (ev.keyCode >= 51 && ev.keyCode <= 55) {
          // escape, file sep, group sep, record sep, unit sep
          result.key = String.fromCharCode(ev.keyCode - 51 + 27);
        } else if (ev.keyCode === 56) {
          // delete
          result.key = String.fromCharCode(127);
        } else if (ev.keyCode === 219) {
          // ^[ - Control Sequence Introducer (CSI)
          result.key = String.fromCharCode(27);
        } else if (ev.keyCode === 220) {
          // ^\ - String Terminator (ST)
          result.key = String.fromCharCode(28);
        } else if (ev.keyCode === 221) {
          // ^] - Operating System Command (OSC)
          result.key = String.fromCharCode(29);
        }
      } else if (!this.browser.isMac && ev.altKey && !ev.ctrlKey && !ev.metaKey) {
        // On Mac this is a third level shift. Use <Esc> instead.
        if (ev.keyCode >= 65 && ev.keyCode <= 90) {
          result.key = C0.ESC + String.fromCharCode(ev.keyCode + 32);
        } else if (ev.keyCode === 192) {
          result.key = C0.ESC + '`';
        } else if (ev.keyCode >= 48 && ev.keyCode <= 57) {
          result.key = C0.ESC + (ev.keyCode - 48);
        }
      }
      break;
  }

  return result;
};

/**
 * Set the G level of the terminal
 * @param g
 */
Terminal.prototype.setgLevel = function(g) {
  this.glevel = g;
  this.charset = this.charsets[g];
};

/**
 * Set the charset for the given G level of the terminal
 * @param g
 * @param charset
 */
Terminal.prototype.setgCharset = function(g, charset) {
  this.charsets[g] = charset;
  if (this.glevel === g) {
    this.charset = charset;
  }
};

/**
 * Handle a keypress event.
 * Key Resources:
 *   - https://developer.mozilla.org/en-US/docs/DOM/KeyboardEvent
 * @param {KeyboardEvent} ev The keypress event to be handled.
 */
Terminal.prototype.keyPress = function(ev) {
  var key;

  this.cancel(ev);

  if (ev.charCode) {
    key = ev.charCode;
  } else if (ev.which == null) {
    key = ev.keyCode;
  } else if (ev.which !== 0 && ev.charCode !== 0) {
    key = ev.which;
  } else {
    return false;
  }

  if (!key || (
    (ev.altKey || ev.ctrlKey || ev.metaKey) && !isThirdLevelShift(this, ev)
  )) {
    return false;
  }

  key = String.fromCharCode(key);

  this.emit('keypress', key, ev);
  this.emit('key', key, ev);
  this.showCursor();
  this.handler(key);

  return false;
};

/**
 * Send data for handling to the terminal
 * @param {string} data
 */
Terminal.prototype.send = function(data) {
  var self = this;

  if (!this.queue) {
    setTimeout(function() {
      self.handler(self.queue);
      self.queue = '';
    }, 1);
  }

  this.queue += data;
};

/**
 * Ring the bell.
 * Note: We could do sweet things with webaudio here
 */
Terminal.prototype.bell = function() {
  if (!this.visualBell) return;
  var self = this;
  this.element.style.borderColor = 'white';
  setTimeout(function() {
    self.element.style.borderColor = '';
  }, 10);
  if (this.popOnBell) this.focus();
};

/**
 * Log the current state to the console.
 */
Terminal.prototype.log = function() {
  if (!this.debug) return;
  if (!this.context.console || !this.context.console.log) return;
  var args = Array.prototype.slice.call(arguments);
  this.context.console.log.apply(this.context.console, args);
};

/**
 * Log the current state as error to the console.
 */
Terminal.prototype.error = function() {
  if (!this.debug) return;
  if (!this.context.console || !this.context.console.error) return;
  var args = Array.prototype.slice.call(arguments);
  this.context.console.error.apply(this.context.console, args);
};

/**
 * Resizes the terminal.
 *
 * @param {number} x The number of columns to resize to.
 * @param {number} y The number of rows to resize to.
 */
Terminal.prototype.resize = function(x, y) {
  var line
  , el
  , i
  , j
  , ch
  , addToY;

  if (x === this.cols && y === this.rows) {
    return;
  }

  if (x < 1) x = 1;
  if (y < 1) y = 1;

  // resize cols
  j = this.cols;
  if (j < x) {
    ch = [this.defAttr, ' ', 1]; // does xterm use the default attr?
    i = this.lines.length;
    while (i--) {
      while (this.lines.get(i).length < x) {
        this.lines.get(i).push(ch);
      }
    }
  } else { // (j > x)
    i = this.lines.length;
    while (i--) {
      while (this.lines.get(i).length > x) {
        this.lines.get(i).pop();
      }
    }
  }
  this.setupStops(j);
  this.cols = x;

  // resize rows
  j = this.rows;
  addToY = 0;
  if (j < y) {
    el = this.element;
    while (j++ < y) {
      // y is rows, not this.y
      if (this.lines.length < y + this.ybase) {
        if (this.ybase > 0 && this.lines.length <= this.ybase + this.y + addToY + 1) {
          // There is room above the buffer and there are no empty elements below the line,
          // scroll up
          this.ybase--;
          addToY++
          if (this.ydisp > 0) {
            // Viewport is at the top of the buffer, must increase downwards
            this.ydisp--;
          }
        } else {
          // Add a blank line if there is no buffer left at the top to scroll to, or if there
          // are blank lines after the cursor
          this.lines.push(this.blankLine());
        }
      }
      if (this.children.length < y) {
        this.insertRow();
      }
    }
  } else { // (j > y)
    while (j-- > y) {
      if (this.lines.length > y + this.ybase) {
        if (this.lines.length > this.ybase + this.y + 1) {
          // The line is a blank line below the cursor, remove it
          this.lines.pop();
        } else {
          // The line is the cursor, scroll down
          this.ybase++;
          this.ydisp++;
        }
      }
      if (this.children.length > y) {
        el = this.children.shift();
        if (!el) continue;
        el.parentNode.removeChild(el);
      }
    }
  }
  this.rows = y;

  // Make sure that the cursor stays on screen
  if (this.y >= y) {
    this.y = y - 1;
  }
  if (addToY) {
    this.y += addToY;
  }

  if (this.x >= x) {
    this.x = x - 1;
  }

  this.scrollTop = 0;
  this.scrollBottom = y - 1;

  this.charMeasure.measure();

  this.queueRefresh(0, this.rows - 1);

  this.normal = null;

  this.geometry = [this.cols, this.rows];
  this.emit('resize', {terminal: this, cols: x, rows: y});
};

/**
 * Updates the range of rows to refresh
 * @param {number} y The number of rows to refresh next.
 */
Terminal.prototype.updateRange = function(y) {
  if (y < this.refreshStart) this.refreshStart = y;
  if (y > this.refreshEnd) this.refreshEnd = y;
  // if (y > this.refreshEnd) {
  //   this.refreshEnd = y;
  //   if (y > this.rows - 1) {
  //     this.refreshEnd = this.rows - 1;
  //   }
  // }
};

/**
 * Set the range of refreshing to the maximum value
 */
Terminal.prototype.maxRange = function() {
  this.refreshStart = 0;
  this.refreshEnd = this.rows - 1;
};



/**
 * Setup the tab stops.
 * @param {number} i
 */
Terminal.prototype.setupStops = function(i) {
  if (i != null) {
    if (!this.tabs[i]) {
      i = this.prevStop(i);
    }
  } else {
    this.tabs = {};
    i = 0;
  }

  for (; i < this.cols; i += 8) {
    this.tabs[i] = true;
  }
};


/**
 * Move the cursor to the previous tab stop from the given position (default is current).
 * @param {number} x The position to move the cursor to the previous tab stop.
 */
Terminal.prototype.prevStop = function(x) {
  if (x == null) x = this.x;
  while (!this.tabs[--x] && x > 0);
  return x >= this.cols
    ? this.cols - 1
  : x < 0 ? 0 : x;
};


/**
 * Move the cursor one tab stop forward from the given position (default is current).
 * @param {number} x The position to move the cursor one tab stop forward.
 */
Terminal.prototype.nextStop = function(x) {
  if (x == null) x = this.x;
  while (!this.tabs[++x] && x < this.cols);
  return x >= this.cols
    ? this.cols - 1
  : x < 0 ? 0 : x;
};


/**
 * Erase in the identified line everything from "x" to the end of the line (right).
 * @param {number} x The column from which to start erasing to the end of the line.
 * @param {number} y The line in which to operate.
 */
Terminal.prototype.eraseRight = function(x, y) {
  var line = this.lines.get(this.ybase + y)
  , ch = [this.eraseAttr(), ' ', 1]; // xterm


  for (; x < this.cols; x++) {
    line[x] = ch;
  }

  this.updateRange(y);
};



/**
 * Erase in the identified line everything from "x" to the start of the line (left).
 * @param {number} x The column from which to start erasing to the start of the line.
 * @param {number} y The line in which to operate.
 */
Terminal.prototype.eraseLeft = function(x, y) {
  var line = this.lines.get(this.ybase + y)
  , ch = [this.eraseAttr(), ' ', 1]; // xterm

  x++;
  while (x--) line[x] = ch;

  this.updateRange(y);
};

/**
 * Clears the entire buffer, making the prompt line the new first line.
 */
Terminal.prototype.clear = function() {
  if (this.ybase === 0 && this.y === 0) {
    // Don't clear if it's already clear
    return;
  }
  this.lines.set(0, this.lines.get(this.ybase + this.y));
  this.lines.length = 1;
  this.ydisp = 0;
  this.ybase = 0;
  this.y = 0;
  for (var i = 1; i < this.rows; i++) {
    this.lines.push(this.blankLine());
  }
  this.queueRefresh(0, this.rows - 1);
  this.emit('scroll', this.ydisp);
};

/**
 * Erase all content in the given line
 * @param {number} y The line to erase all of its contents.
 */
Terminal.prototype.eraseLine = function(y) {
  this.eraseRight(0, y);
};


/**
 * Return the data array of a blank line
 * @param {number} cur First bunch of data for each "blank" character.
 */
Terminal.prototype.blankLine = function(cur) {
  var attr = cur
  ? this.eraseAttr()
  : this.defAttr;

  var ch = [attr, ' ', 1]  // width defaults to 1 halfwidth character
  , line = []
  , i = 0;

  for (; i < this.cols; i++) {
    line[i] = ch;
  }

  return line;
};


/**
 * If cur return the back color xterm feature attribute. Else return defAttr.
 * @param {object} cur
 */
Terminal.prototype.ch = function(cur) {
  return cur
    ? [this.eraseAttr(), ' ', 1]
  : [this.defAttr, ' ', 1];
};


/**
 * Evaluate if the current erminal is the given argument.
 * @param {object} term The terminal to evaluate
 */
Terminal.prototype.is = function(term) {
  var name = this.termName;
  return (name + '').indexOf(term) === 0;
};


/**
 * Emit the 'data' event and populate the given data.
 * @param {string} data The data to populate in the event.
 */
Terminal.prototype.handler = function(data) {
  // Prevents all events to pty process if stdin is disabled
  if (this.options.disableStdin) {
    return;
  }

  // Input is being sent to the terminal, the terminal should focus the prompt.
  if (this.ybase !== this.ydisp) {
    this.scrollToBottom();
  }
  this.emit('data', data);
};


/**
 * Emit the 'title' event and populate the given title.
 * @param {string} title The title to populate in the event.
 */
Terminal.prototype.handleTitle = function(title) {
  /**
   * This event is emitted when the title of the terminal is changed
   * from inside the terminal. The parameter is the new title.
   *
   * @event title
   */
  this.emit('title', title);
};


/**
 * ESC
 */

/**
 * ESC D Index (IND is 0x84).
 */
Terminal.prototype.index = function() {
  this.y++;
  if (this.y > this.scrollBottom) {
    this.y--;
    this.scroll();
  }
};


/**
 * ESC M Reverse Index (RI is 0x8d).
 *
 * Move the cursor up one row, inserting a new blank line if necessary.
 */
Terminal.prototype.reverseIndex = function() {
  var j;
  if (this.y === this.scrollTop) {
    // possibly move the code below to term.reverseScroll();
    // test: echo -ne '\e[1;1H\e[44m\eM\e[0m'
    // blankLine(true) is xterm/linux behavior
    this.lines.shiftElements(this.y + this.ybase, this.rows - 1, 1);
    this.lines.set(this.y + this.ybase, this.blankLine(true));
    this.updateRange(this.scrollTop);
    this.updateRange(this.scrollBottom);
  } else {
    this.y--;
  }
};


/**
 * ESC c Full Reset (RIS).
 */
Terminal.prototype.reset = function() {
  this.options.rows = this.rows;
  this.options.cols = this.cols;
  var customKeydownHandler = this.customKeydownHandler;
  Terminal.call(this, this.options);
  this.customKeydownHandler = customKeydownHandler;
  this.queueRefresh(0, this.rows - 1);
  this.viewport.syncScrollArea();
};


/**
 * ESC H Tab Set (HTS is 0x88).
 */
Terminal.prototype.tabSet = function() {
  this.tabs[this.x] = true;
};


/**
 * CSI
 */


/**
 * Additions
 */


/**
 * CSI Pm l  Reset Mode (RM).
 *     Ps = 2  -> Keyboard Action Mode (AM).
 *     Ps = 4  -> Replace Mode (IRM).
 *     Ps = 1 2  -> Send/receive (SRM).
 *     Ps = 2 0  -> Normal Linefeed (LNM).
 * CSI ? Pm l
 *   DEC Private Mode Reset (DECRST).
 *     Ps = 1  -> Normal Cursor Keys (DECCKM).
 *     Ps = 2  -> Designate VT52 mode (DECANM).
 *     Ps = 3  -> 80 Column Mode (DECCOLM).
 *     Ps = 4  -> Jump (Fast) Scroll (DECSCLM).
 *     Ps = 5  -> Normal Video (DECSCNM).
 *     Ps = 6  -> Normal Cursor Mode (DECOM).
 *     Ps = 7  -> No Wraparound Mode (DECAWM).
 *     Ps = 8  -> No Auto-repeat Keys (DECARM).
 *     Ps = 9  -> Don't send Mouse X & Y on button press.
 *     Ps = 1 0  -> Hide toolbar (rxvt).
 *     Ps = 1 2  -> Stop Blinking Cursor (att610).
 *     Ps = 1 8  -> Don't print form feed (DECPFF).
 *     Ps = 1 9  -> Limit print to scrolling region (DECPEX).
 *     Ps = 2 5  -> Hide Cursor (DECTCEM).
 *     Ps = 3 0  -> Don't show scrollbar (rxvt).
 *     Ps = 3 5  -> Disable font-shifting functions (rxvt).
 *     Ps = 4 0  -> Disallow 80 -> 132 Mode.
 *     Ps = 4 1  -> No more(1) fix (see curses resource).
 *     Ps = 4 2  -> Disable Nation Replacement Character sets (DEC-
 *     NRCM).
 *     Ps = 4 4  -> Turn Off Margin Bell.
 *     Ps = 4 5  -> No Reverse-wraparound Mode.
 *     Ps = 4 6  -> Stop Logging.  (This is normally disabled by a
 *     compile-time option).
 *     Ps = 4 7  -> Use Normal Screen Buffer.
 *     Ps = 6 6  -> Numeric keypad (DECNKM).
 *     Ps = 6 7  -> Backarrow key sends delete (DECBKM).
 *     Ps = 1 0 0 0  -> Don't send Mouse X & Y on button press and
 *     release.  See the section Mouse Tracking.
 *     Ps = 1 0 0 1  -> Don't use Hilite Mouse Tracking.
 *     Ps = 1 0 0 2  -> Don't use Cell Motion Mouse Tracking.
 *     Ps = 1 0 0 3  -> Don't use All Motion Mouse Tracking.
 *     Ps = 1 0 0 4  -> Don't send FocusIn/FocusOut events.
 *     Ps = 1 0 0 5  -> Disable Extended Mouse Mode.
 *     Ps = 1 0 1 0  -> Don't scroll to bottom on tty output
 *     (rxvt).
 *     Ps = 1 0 1 1  -> Don't scroll to bottom on key press (rxvt).
 *     Ps = 1 0 3 4  -> Don't interpret "meta" key.  (This disables
 *     the eightBitInput resource).
 *     Ps = 1 0 3 5  -> Disable special modifiers for Alt and Num-
 *     Lock keys.  (This disables the numLock resource).
 *     Ps = 1 0 3 6  -> Don't send ESC  when Meta modifies a key.
 *     (This disables the metaSendsEscape resource).
 *     Ps = 1 0 3 7  -> Send VT220 Remove from the editing-keypad
 *     Delete key.
 *     Ps = 1 0 3 9  -> Don't send ESC  when Alt modifies a key.
 *     (This disables the altSendsEscape resource).
 *     Ps = 1 0 4 0  -> Do not keep selection when not highlighted.
 *     (This disables the keepSelection resource).
 *     Ps = 1 0 4 1  -> Use the PRIMARY selection.  (This disables
 *     the selectToClipboard resource).
 *     Ps = 1 0 4 2  -> Disable Urgency window manager hint when
 *     Control-G is received.  (This disables the bellIsUrgent
 *     resource).
 *     Ps = 1 0 4 3  -> Disable raising of the window when Control-
 *     G is received.  (This disables the popOnBell resource).
 *     Ps = 1 0 4 7  -> Use Normal Screen Buffer, clearing screen
 *     first if in the Alternate Screen.  (This may be disabled by
 *     the titeInhibit resource).
 *     Ps = 1 0 4 8  -> Restore cursor as in DECRC.  (This may be
 *     disabled by the titeInhibit resource).
 *     Ps = 1 0 4 9  -> Use Normal Screen Buffer and restore cursor
 *     as in DECRC.  (This may be disabled by the titeInhibit
 *     resource).  This combines the effects of the 1 0 4 7  and 1 0
 *     4 8  modes.  Use this with terminfo-based applications rather
 *     than the 4 7  mode.
 *     Ps = 1 0 5 0  -> Reset terminfo/termcap function-key mode.
 *     Ps = 1 0 5 1  -> Reset Sun function-key mode.
 *     Ps = 1 0 5 2  -> Reset HP function-key mode.
 *     Ps = 1 0 5 3  -> Reset SCO function-key mode.
 *     Ps = 1 0 6 0  -> Reset legacy keyboard emulation (X11R6).
 *     Ps = 1 0 6 1  -> Reset keyboard emulation to Sun/PC style.
 *     Ps = 2 0 0 4  -> Reset bracketed paste mode.
 */
Terminal.prototype.resetMode = function(params) {
  if (typeof params === 'object') {
    var l = params.length
    , i = 0;

    for (; i < l; i++) {
      this.resetMode(params[i]);
    }

    return;
  }

  if (!this.prefix) {
    switch (params) {
      case 4:
        this.insertMode = false;
        break;
      case 20:
        //this.convertEol = false;
        break;
    }
  } else if (this.prefix === '?') {
    switch (params) {
      case 1:
        this.applicationCursor = false;
        break;
      case 3:
        if (this.cols === 132 && this.savedCols) {
          this.resize(this.savedCols, this.rows);
        }
        delete this.savedCols;
        break;
      case 6:
        this.originMode = false;
        break;
      case 7:
        this.wraparoundMode = false;
        break;
      case 12:
        // this.cursorBlink = false;
        break;
      case 66:
        this.log('Switching back to normal keypad.');
        this.applicationKeypad = false;
        this.viewport.syncScrollArea();
        break;
      case 9: // X10 Mouse
      case 1000: // vt200 mouse
      case 1002: // button event mouse
      case 1003: // any event mouse
        this.x10Mouse = false;
        this.vt200Mouse = false;
        this.normalMouse = false;
        this.mouseEvents = false;
        this.element.style.cursor = '';
        break;
      case 1004: // send focusin/focusout events
        this.sendFocus = false;
        break;
      case 1005: // utf8 ext mode mouse
        this.utfMouse = false;
        break;
      case 1006: // sgr ext mode mouse
        this.sgrMouse = false;
        break;
      case 1015: // urxvt ext mode mouse
        this.urxvtMouse = false;
        break;
      case 25: // hide cursor
        this.cursorHidden = true;
        break;
      case 1049: // alt screen buffer cursor
        ; // FALL-THROUGH
      case 47: // normal screen buffer
      case 1047: // normal screen buffer - clearing it first
        if (this.normal) {
          this.lines = this.normal.lines;
          this.ybase = this.normal.ybase;
          this.ydisp = this.normal.ydisp;
          this.x = this.normal.x;
          this.y = this.normal.y;
          this.scrollTop = this.normal.scrollTop;
          this.scrollBottom = this.normal.scrollBottom;
          this.tabs = this.normal.tabs;
          this.normal = null;
          // if (params === 1049) {
          //   this.x = this.savedX;
          //   this.y = this.savedY;
          // }
          this.queueRefresh(0, this.rows - 1);
          this.viewport.syncScrollArea();
          this.showCursor();
        }
        break;
    }
  }
};


/**
 * CSI Ps ; Ps r
 *   Set Scrolling Region [top;bottom] (default = full size of win-
 *   dow) (DECSTBM).
 * CSI ? Pm r
 */
Terminal.prototype.setScrollRegion = function(params) {
  if (this.prefix) return;
  this.scrollTop = (params[0] || 1) - 1;
  this.scrollBottom = (params[1] || this.rows) - 1;
  this.x = 0;
  this.y = 0;
};


/**
 * CSI s
 *   Save cursor (ANSI.SYS).
 */
Terminal.prototype.saveCursor = function(params) {
  this.savedX = this.x;
  this.savedY = this.y;
};


/**
 * CSI u
 *   Restore cursor (ANSI.SYS).
 */
Terminal.prototype.restoreCursor = function(params) {
  this.x = this.savedX || 0;
  this.y = this.savedY || 0;
};


/**
 * Lesser Used
 */

/**
 * CSI Ps I
 *   Cursor Forward Tabulation Ps tab stops (default = 1) (CHT).
 */
Terminal.prototype.cursorForwardTab = function(params) {
  var param = params[0] || 1;
  while (param--) {
    this.x = this.nextStop();
  }
};


/**
 * CSI Ps S  Scroll up Ps lines (default = 1) (SU).
 */
Terminal.prototype.scrollUp = function(params) {
  var param = params[0] || 1;
  while (param--) {
    this.lines.splice(this.ybase + this.scrollTop, 1);
    this.lines.splice(this.ybase + this.scrollBottom, 0, this.blankLine());
  }
  // this.maxRange();
  this.updateRange(this.scrollTop);
  this.updateRange(this.scrollBottom);
};


/**
 * CSI Ps T  Scroll down Ps lines (default = 1) (SD).
 */
Terminal.prototype.scrollDown = function(params) {
  var param = params[0] || 1;
  while (param--) {
    this.lines.splice(this.ybase + this.scrollBottom, 1);
    this.lines.splice(this.ybase + this.scrollTop, 0, this.blankLine());
  }
  // this.maxRange();
  this.updateRange(this.scrollTop);
  this.updateRange(this.scrollBottom);
};


/**
 * CSI Ps ; Ps ; Ps ; Ps ; Ps T
 *   Initiate highlight mouse tracking.  Parameters are
 *   [func;startx;starty;firstrow;lastrow].  See the section Mouse
 *   Tracking.
 */
Terminal.prototype.initMouseTracking = function(params) {
  // Relevant: DECSET 1001
};


/**
 * CSI > Ps; Ps T
 *   Reset one or more features of the title modes to the default
 *   value.  Normally, "reset" disables the feature.  It is possi-
 *   ble to disable the ability to reset features by compiling a
 *   different default for the title modes into xterm.
 *     Ps = 0  -> Do not set window/icon labels using hexadecimal.
 *     Ps = 1  -> Do not query window/icon labels using hexadeci-
 *     mal.
 *     Ps = 2  -> Do not set window/icon labels using UTF-8.
 *     Ps = 3  -> Do not query window/icon labels using UTF-8.
 *   (See discussion of "Title Modes").
 */
Terminal.prototype.resetTitleModes = function(params) {
  ;
};


/**
 * CSI Ps Z  Cursor Backward Tabulation Ps tab stops (default = 1) (CBT).
 */
Terminal.prototype.cursorBackwardTab = function(params) {
  var param = params[0] || 1;
  while (param--) {
    this.x = this.prevStop();
  }
};


/**
 * CSI Ps b  Repeat the preceding graphic character Ps times (REP).
 */
Terminal.prototype.repeatPrecedingCharacter = function(params) {
  var param = params[0] || 1
  , line = this.lines.get(this.ybase + this.y)
  , ch = line[this.x - 1] || [this.defAttr, ' ', 1];

  while (param--) line[this.x++] = ch;
};


/**
 * CSI Ps g  Tab Clear (TBC).
 *     Ps = 0  -> Clear Current Column (default).
 *     Ps = 3  -> Clear All.
 * Potentially:
 *   Ps = 2  -> Clear Stops on Line.
 *   http://vt100.net/annarbor/aaa-ug/section6.html
 */
Terminal.prototype.tabClear = function(params) {
  var param = params[0];
  if (param <= 0) {
    delete this.tabs[this.x];
  } else if (param === 3) {
    this.tabs = {};
  }
};


/**
 * CSI Pm i  Media Copy (MC).
 *     Ps = 0  -> Print screen (default).
 *     Ps = 4  -> Turn off printer controller mode.
 *     Ps = 5  -> Turn on printer controller mode.
 * CSI ? Pm i
 *   Media Copy (MC, DEC-specific).
 *     Ps = 1  -> Print line containing cursor.
 *     Ps = 4  -> Turn off autoprint mode.
 *     Ps = 5  -> Turn on autoprint mode.
 *     Ps = 1  0  -> Print composed display, ignores DECPEX.
 *     Ps = 1  1  -> Print all pages.
 */
Terminal.prototype.mediaCopy = function(params) {
  ;
};


/**
 * CSI > Ps; Ps m
 *   Set or reset resource-values used by xterm to decide whether
 *   to construct escape sequences holding information about the
 *   modifiers pressed with a given key.  The first parameter iden-
 *   tifies the resource to set/reset.  The second parameter is the
 *   value to assign to the resource.  If the second parameter is
 *   omitted, the resource is reset to its initial value.
 *     Ps = 1  -> modifyCursorKeys.
 *     Ps = 2  -> modifyFunctionKeys.
 *     Ps = 4  -> modifyOtherKeys.
 *   If no parameters are given, all resources are reset to their
 *   initial values.
 */
Terminal.prototype.setResources = function(params) {
  ;
};


/**
 * CSI > Ps n
 *   Disable modifiers which may be enabled via the CSI > Ps; Ps m
 *   sequence.  This corresponds to a resource value of "-1", which
 *   cannot be set with the other sequence.  The parameter identi-
 *   fies the resource to be disabled:
 *     Ps = 1  -> modifyCursorKeys.
 *     Ps = 2  -> modifyFunctionKeys.
 *     Ps = 4  -> modifyOtherKeys.
 *   If the parameter is omitted, modifyFunctionKeys is disabled.
 *   When modifyFunctionKeys is disabled, xterm uses the modifier
 *   keys to make an extended sequence of functions rather than
 *   adding a parameter to each function key to denote the modi-
 *   fiers.
 */
Terminal.prototype.disableModifiers = function(params) {
  ;
};


/**
 * CSI > Ps p
 *   Set resource value pointerMode.  This is used by xterm to
 *   decide whether to hide the pointer cursor as the user types.
 *   Valid values for the parameter:
 *     Ps = 0  -> never hide the pointer.
 *     Ps = 1  -> hide if the mouse tracking mode is not enabled.
 *     Ps = 2  -> always hide the pointer.  If no parameter is
 *     given, xterm uses the default, which is 1 .
 */
Terminal.prototype.setPointerMode = function(params) {
  ;
};


/**
 * CSI ! p   Soft terminal reset (DECSTR).
 * http://vt100.net/docs/vt220-rm/table4-10.html
 */
Terminal.prototype.softReset = function(params) {
  this.cursorHidden = false;
  this.insertMode = false;
  this.originMode = false;
  this.wraparoundMode = false; // autowrap
  this.applicationKeypad = false; // ?
  this.viewport.syncScrollArea();
  this.applicationCursor = false;
  this.scrollTop = 0;
  this.scrollBottom = this.rows - 1;
  this.curAttr = this.defAttr;
  this.x = this.y = 0; // ?
  this.charset = null;
  this.glevel = 0; // ??
  this.charsets = [null]; // ??
};


/**
 * CSI Ps$ p
 *   Request ANSI mode (DECRQM).  For VT300 and up, reply is
 *     CSI Ps; Pm$ y
 *   where Ps is the mode number as in RM, and Pm is the mode
 *   value:
 *     0 - not recognized
 *     1 - set
 *     2 - reset
 *     3 - permanently set
 *     4 - permanently reset
 */
Terminal.prototype.requestAnsiMode = function(params) {
  ;
};


/**
 * CSI ? Ps$ p
 *   Request DEC private mode (DECRQM).  For VT300 and up, reply is
 *     CSI ? Ps; Pm$ p
 *   where Ps is the mode number as in DECSET, Pm is the mode value
 *   as in the ANSI DECRQM.
 */
Terminal.prototype.requestPrivateMode = function(params) {
  ;
};


/**
 * CSI Ps ; Ps " p
 *   Set conformance level (DECSCL).  Valid values for the first
 *   parameter:
 *     Ps = 6 1  -> VT100.
 *     Ps = 6 2  -> VT200.
 *     Ps = 6 3  -> VT300.
 *   Valid values for the second parameter:
 *     Ps = 0  -> 8-bit controls.
 *     Ps = 1  -> 7-bit controls (always set for VT100).
 *     Ps = 2  -> 8-bit controls.
 */
Terminal.prototype.setConformanceLevel = function(params) {
  ;
};


/**
 * CSI Ps q  Load LEDs (DECLL).
 *     Ps = 0  -> Clear all LEDS (default).
 *     Ps = 1  -> Light Num Lock.
 *     Ps = 2  -> Light Caps Lock.
 *     Ps = 3  -> Light Scroll Lock.
 *     Ps = 2  1  -> Extinguish Num Lock.
 *     Ps = 2  2  -> Extinguish Caps Lock.
 *     Ps = 2  3  -> Extinguish Scroll Lock.
 */
Terminal.prototype.loadLEDs = function(params) {
  ;
};


/**
 * CSI Ps SP q
 *   Set cursor style (DECSCUSR, VT520).
 *     Ps = 0  -> blinking block.
 *     Ps = 1  -> blinking block (default).
 *     Ps = 2  -> steady block.
 *     Ps = 3  -> blinking underline.
 *     Ps = 4  -> steady underline.
 */
Terminal.prototype.setCursorStyle = function(params) {
  ;
};


/**
 * CSI Ps " q
 *   Select character protection attribute (DECSCA).  Valid values
 *   for the parameter:
 *     Ps = 0  -> DECSED and DECSEL can erase (default).
 *     Ps = 1  -> DECSED and DECSEL cannot erase.
 *     Ps = 2  -> DECSED and DECSEL can erase.
 */
Terminal.prototype.setCharProtectionAttr = function(params) {
  ;
};


/**
 * CSI ? Pm r
 *   Restore DEC Private Mode Values.  The value of Ps previously
 *   saved is restored.  Ps values are the same as for DECSET.
 */
Terminal.prototype.restorePrivateValues = function(params) {
  ;
};


/**
 * CSI Pt; Pl; Pb; Pr; Ps$ r
 *   Change Attributes in Rectangular Area (DECCARA), VT400 and up.
 *     Pt; Pl; Pb; Pr denotes the rectangle.
 *     Ps denotes the SGR attributes to change: 0, 1, 4, 5, 7.
 * NOTE: xterm doesn't enable this code by default.
 */
Terminal.prototype.setAttrInRectangle = function(params) {
  var t = params[0]
  , l = params[1]
  , b = params[2]
  , r = params[3]
  , attr = params[4];

  var line
  , i;

  for (; t < b + 1; t++) {
    line = this.lines.get(this.ybase + t);
    for (i = l; i < r; i++) {
      line[i] = [attr, line[i][1]];
    }
  }

  // this.maxRange();
  this.updateRange(params[0]);
  this.updateRange(params[2]);
};


/**
 * CSI Pc; Pt; Pl; Pb; Pr$ x
 *   Fill Rectangular Area (DECFRA), VT420 and up.
 *     Pc is the character to use.
 *     Pt; Pl; Pb; Pr denotes the rectangle.
 * NOTE: xterm doesn't enable this code by default.
 */
Terminal.prototype.fillRectangle = function(params) {
  var ch = params[0]
  , t = params[1]
  , l = params[2]
  , b = params[3]
  , r = params[4];

  var line
  , i;

  for (; t < b + 1; t++) {
    line = this.lines.get(this.ybase + t);
    for (i = l; i < r; i++) {
      line[i] = [line[i][0], String.fromCharCode(ch)];
    }
  }

  // this.maxRange();
  this.updateRange(params[1]);
  this.updateRange(params[3]);
};


/**
 * CSI Ps ; Pu ' z
 *   Enable Locator Reporting (DECELR).
 *   Valid values for the first parameter:
 *     Ps = 0  -> Locator disabled (default).
 *     Ps = 1  -> Locator enabled.
 *     Ps = 2  -> Locator enabled for one report, then disabled.
 *   The second parameter specifies the coordinate unit for locator
 *   reports.
 *   Valid values for the second parameter:
 *     Pu = 0  <- or omitted -> default to character cells.
 *     Pu = 1  <- device physical pixels.
 *     Pu = 2  <- character cells.
 */
Terminal.prototype.enableLocatorReporting = function(params) {
  var val = params[0] > 0;
  //this.mouseEvents = val;
  //this.decLocator = val;
};


/**
 * CSI Pt; Pl; Pb; Pr$ z
 *   Erase Rectangular Area (DECERA), VT400 and up.
 *     Pt; Pl; Pb; Pr denotes the rectangle.
 * NOTE: xterm doesn't enable this code by default.
 */
Terminal.prototype.eraseRectangle = function(params) {
  var t = params[0]
  , l = params[1]
  , b = params[2]
  , r = params[3];

  var line
  , i
  , ch;

  ch = [this.eraseAttr(), ' ', 1]; // xterm?

  for (; t < b + 1; t++) {
    line = this.lines.get(this.ybase + t);
    for (i = l; i < r; i++) {
      line[i] = ch;
    }
  }

  // this.maxRange();
  this.updateRange(params[0]);
  this.updateRange(params[2]);
};


/**
 * CSI P m SP }
 * Insert P s Column(s) (default = 1) (DECIC), VT420 and up.
 * NOTE: xterm doesn't enable this code by default.
 */
Terminal.prototype.insertColumns = function() {
  var param = params[0]
  , l = this.ybase + this.rows
  , ch = [this.eraseAttr(), ' ', 1] // xterm?
  , i;

  while (param--) {
    for (i = this.ybase; i < l; i++) {
      this.lines.get(i).splice(this.x + 1, 0, ch);
      this.lines.get(i).pop();
    }
  }

  this.maxRange();
};


/**
 * CSI P m SP ~
 * Delete P s Column(s) (default = 1) (DECDC), VT420 and up
 * NOTE: xterm doesn't enable this code by default.
 */
Terminal.prototype.deleteColumns = function() {
  var param = params[0]
  , l = this.ybase + this.rows
  , ch = [this.eraseAttr(), ' ', 1] // xterm?
  , i;

  while (param--) {
    for (i = this.ybase; i < l; i++) {
      this.lines.get(i).splice(this.x, 1);
      this.lines.get(i).push(ch);
    }
  }

  this.maxRange();
};

/**
 * Helpers
 */

function on(el, type, handler, capture) {
  if (!Array.isArray(el)) {
    el = [el];
  }
  el.forEach(function (element) {
    element.addEventListener(type, handler, capture || false);
  });
}

function off(el, type, handler, capture) {
  el.removeEventListener(type, handler, capture || false);
}

function cancel(ev, force) {
  if (!this.cancelEvents && !force) {
    return;
  }
  ev.preventDefault();
  ev.stopPropagation();
  return false;
}

function inherits(child, parent) {
  function f() {
    this.constructor = child;
  }
  f.prototype = parent.prototype;
  child.prototype = new f;
}

// if bold is broken, we can't
// use it in the terminal.
function isBoldBroken(document) {
  var body = document.getElementsByTagName('body')[0];
  var el = document.createElement('span');
  el.innerHTML = 'hello world';
  body.appendChild(el);
  var w1 = el.scrollWidth;
  el.style.fontWeight = 'bold';
  var w2 = el.scrollWidth;
  body.removeChild(el);
  return w1 !== w2;
}

function indexOf(obj, el) {
  var i = obj.length;
  while (i--) {
    if (obj[i] === el) return i;
  }
  return -1;
}

function isThirdLevelShift(term, ev) {
  var thirdLevelKey =
      (term.browser.isMac && ev.altKey && !ev.ctrlKey && !ev.metaKey) ||
      (term.browser.isMSWindows && ev.altKey && ev.ctrlKey && !ev.metaKey);

  if (ev.type == 'keypress') {
    return thirdLevelKey;
  }

  // Don't invoke for arrows, pageDown, home, backspace, etc. (on non-keypress events)
  return thirdLevelKey && (!ev.keyCode || ev.keyCode > 47);
}

// Expose to InputHandler (temporary)
Terminal.prototype.matchColor = matchColor;

function matchColor(r1, g1, b1) {
  var hash = (r1 << 16) | (g1 << 8) | b1;

  if (matchColor._cache[hash] != null) {
    return matchColor._cache[hash];
  }

  var ldiff = Infinity
  , li = -1
  , i = 0
  , c
  , r2
  , g2
  , b2
  , diff;

  for (; i < Terminal.vcolors.length; i++) {
    c = Terminal.vcolors[i];
    r2 = c[0];
    g2 = c[1];
    b2 = c[2];

    diff = matchColor.distance(r1, g1, b1, r2, g2, b2);

    if (diff === 0) {
      li = i;
      break;
    }

    if (diff < ldiff) {
      ldiff = diff;
      li = i;
    }
  }

  return matchColor._cache[hash] = li;
}

matchColor._cache = {};

// http://stackoverflow.com/questions/1633828
matchColor.distance = function(r1, g1, b1, r2, g2, b2) {
  return Math.pow(30 * (r1 - r2), 2)
    + Math.pow(59 * (g1 - g2), 2)
    + Math.pow(11 * (b1 - b2), 2);
};

function each(obj, iter, con) {
  if (obj.forEach) return obj.forEach(iter, con);
  for (var i = 0; i < obj.length; i++) {
    iter.call(con, obj[i], i, obj);
  }
}

function keys(obj) {
  if (Object.keys) return Object.keys(obj);
  var key, keys = [];
  for (key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      keys.push(key);
    }
  }
  return keys;
}

/**
 * Expose
 */

Terminal.EventEmitter = EventEmitter;
Terminal.inherits = inherits;

/**
 * Adds an event listener to the terminal.
 *
 * @param {string} event The name of the event. TODO: Document all event types
 * @param {function} callback The function to call when the event is triggered.
 */
Terminal.on = on;
Terminal.off = off;
Terminal.cancel = cancel;

module.exports = Terminal;
