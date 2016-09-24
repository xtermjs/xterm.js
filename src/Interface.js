/**
 * xterm.js: xterm, in the browser
 * Copyright (c) 2014, SourceLair Limited <www.sourcelair.com> (MIT License)
 * Copyright (c) 2012-2013, Christopher Jeffrey (MIT License)
 * https://github.com/chjj/term.js
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * Originally forked from (with the author's permission):
 *   Fabrice Bellard's javascript vt100 for jslinux:
 *   http://bellard.org/jslinux/
 *   Copyright (c) 2011 Fabrice Bellard
 *   The original design remains. The terminal itself
 *   has been extended to include xterm CSI codes, among
 *   other features.
 */

import { CompositionHelper } from './CompositionHelper.js';
import { EventEmitter } from './EventEmitter.js';
import { Viewport } from './Viewport.js';
import { default as Core } from './Core.js';

// Let it work inside Node.js for automated testing purposes.
var document = (typeof window != 'undefined') ? window.document : null;

function Terminal() {
  var options = Core.apply(this, arguments);

  this.cancel = Terminal.cancel;

  // this.context = options.context || window;
  // this.document = options.document || document;
  this.parent = options.body || options.parent || (
      document ? document.getElementsByTagName('body')[0] : null
    );

  this.customKeydownHandler = null;

  // misc
  this.element;
  this.children;

  this.on('refresh', (start, end) => this.refresh(start, end));
  this.on('bell', () => this.bell());
}

Core.inherits(Terminal, Core);

/**
 * Focus the terminal. Delegates focus handling to the terminal's DOM element.
 */
Terminal.prototype.focus = function() {
  return this.textarea.focus();
};

/**
 * Binds the desired focus behavior on a given terminal object.
 *
 * @static
 */
Terminal.bindFocus = function (term) {
  on(term.textarea, 'focus', function (ev) {
    if (term.sendFocus) {
      term.send('\x1b[I');
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
    term.refresh(term.y, term.y);
    if (term.sendFocus) {
      term.send('\x1b[O');
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
  Terminal.bindPaste(this);
  Terminal.bindKeys(this);
  Terminal.bindCopy(this);
  Terminal.bindFocus(this);
  Terminal.bindBlur(this);
};

/**
 * Bind to paste event and allow both keyboard and right-click pasting, without having the
 * contentEditable value set to true.
 */
Terminal.bindPaste = function(term) {
  on([term.textarea, term.element], 'paste', function(ev) {
    ev.stopPropagation();
    if (ev.clipboardData) {
      var text = ev.clipboardData.getData('text/plain');
      term.handler(text);
      term.textarea.value = '';
      return term.cancel(ev);
    }
  });
};

/**
 * Prepares text copied from terminal selection, to be saved in the clipboard by:
 *   1. stripping all trailing white spaces
 *   2. converting all non-breaking spaces to regular spaces
 * @param {string} text The copied text that needs processing for storing in clipboard
 * @returns {string}
 * @static
 */
Terminal.prepareCopiedTextForClipboard = function (text) {
  var space = String.fromCharCode(32),
    nonBreakingSpace = String.fromCharCode(160),
    allNonBreakingSpaces = new RegExp(nonBreakingSpace, 'g'),
    processedText = text.split('\n').map(function (line) {
      /**
       * Strip all trailing white spaces and convert all non-breaking spaces to regular
       * spaces.
       */
      var processedLine = line.replace(/\s+$/g, '').replace(allNonBreakingSpaces, space);

      return processedLine;
    }).join('\n');

  return processedText;
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
 * Binds copy functionality to the given terminal.
 * @static
 */
Terminal.bindCopy = function(term) {
  on(term.element, 'copy', function(ev) {
    return; // temporary
  });
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

  // Parse User-Agent
  if (this.context.navigator && this.context.navigator.userAgent) {
    this.isMSIE = !!~this.context.navigator.userAgent.indexOf('MSIE');
  }

  // Find the users platform. We use this to interpret the meta key
  // and ISO third level shifts.
  // http://stackoverflow.com/q/19877924/577598
  if (this.context.navigator && this.context.navigator.platform) {
    this.isMac = contains(
      this.context.navigator.platform,
      ['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K']
    );
    this.isIpad = this.context.navigator.platform === 'iPad';
    this.isIphone = this.context.navigator.platform === 'iPhone';
    this.isMSWindows = contains(
      this.context.navigator.platform,
      ['Windows', 'Win16', 'Win32', 'WinCE']
    );
  }

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

  this.charMeasureElement = document.createElement('div');
  this.charMeasureElement.classList.add('xterm-char-measure-element');
  this.charMeasureElement.innerHTML = 'W';
  this.helperContainer.appendChild(this.charMeasureElement);

  for (; i < this.rows; i++) {
    this.insertRow();
  }
  this.parent.appendChild(this.element);

  this.viewport = new Viewport(this, this.viewportElement, this.viewportScrollArea, this.charMeasureElement);

  // Draw the screen.
  this.refresh(0, this.rows - 1);

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
    return require(__dirname + '/../addons/' + addon);
  } else if (typeof define == 'function') {
    // RequireJS
    return require(['../addons/' + addon + '/' + addon], callback);
  } else {
    console.error('Cannot load a module without a CommonJS or RequireJS environment.');
    return false;
  }
};


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
      var data = '\x1b[24';
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
      self.send('\x1b['
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
      self.send('\x1b[' + button + ';' + pos.x + ';' + pos.y + 'M');
      return;
    }

    if (self.sgrMouse) {
      pos.x -= 32;
      pos.y -= 32;
      self.send('\x1b[<'
        + ((button & 3) === 3 ? button & ~3 : button)
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

    self.send('\x1b[M' + String.fromCharCode.apply(String, data));
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

        if (self.isMSIE) {
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
    if (self.applicationKeypad) return;
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
 * @param {boolean} queue Whether the refresh should ran right now or be queued
 */
Terminal.prototype.refresh = function(start, end, queue) {
  var self = this;

  // queue defaults to true
  queue = (typeof queue == 'undefined') ? true : queue;

  /**
   * The refresh queue allows refresh to execute only approximately 30 times a second. For
   * commands that pass a significant amount of output to the write function, this prevents the
   * terminal from maxing out the CPU and making the UI unresponsive. While commands can still
   * run beyond what they do on the terminal, it is far better with a debounce in place as
   * every single terminal manipulation does not need to be constructed in the DOM.
   *
   * A side-effect of this is that it makes ^C to interrupt a process seem more responsive.
   */
  if (queue) {
    // If refresh should be queued, order the refresh and return.
    if (this._refreshIsQueued) {
      // If a refresh has already been queued, just order a full refresh next
      this._fullRefreshNext = true;
    } else {
      setTimeout(function () {
        self.refresh(start, end, false);
      }, 34)
      this._refreshIsQueued = true;
    }
    return;
  }

  // If refresh should be run right now (not be queued), release the lock
  this._refreshIsQueued = false;

  // If multiple refreshes were requested, make a full refresh.
  if (this._fullRefreshNext) {
    start = 0;
    end = this.rows - 1;
    this._fullRefreshNext = false // reset lock
  }

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

  if (end >= this.rows) {
    this.log('`end` is too large. Most likely a bad CSR.');
    end = this.rows - 1;
  }

  for (; y <= end; y++) {
    row = y + this.ydisp;

    line = this.lines[row];
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

            if (flags & Core.flags.BOLD) {
              if (!Terminal.brokenBold) {
                classNames.push('xterm-bold');
              }
              // See: XTerm*boldColors
              if (fg < 8) fg += 8;
            }

            if (flags & Core.flags.UNDERLINE) {
              classNames.push('xterm-underline');
            }

            if (flags & Core.flags.BLINK) {
              classNames.push('xterm-blink');
            }

            // If inverse flag is on, then swap the foreground and background variables.
            if (flags & Core.flags.INVERSE) {
              /* One-line variable swap in JavaScript: http://stackoverflow.com/a/16201730 */
              bg = [fg, fg = bg][0];
              // Should inverse just be before the
              // above boldColors effect instead?
              if ((flags & 1) && fg < 8) fg += 8;
            }

            if (flags & Core.flags.INVISIBLE) {
              classNames.push('xterm-hidden');
            }

            /**
             * Weird situation: Invert flag used black foreground and white background results
             * in invalid background color, positioned at the 256 index of the 256 terminal
             * color map. Pin the colors manually in such a case.
             *
             * Source: https://github.com/sourcelair/xterm.js/issues/57
             */
            if (flags & Core.flags.INVERSE) {
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
    return false;
  }

  var self = this;
  var result = this.evaluateKeyEscapeSequence(ev);

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
        result.key = '\x08'; // ^H
        break;
      }
      result.key = '\x7f'; // ^?
      break;
    case 9:
      // tab
      if (ev.shiftKey) {
        result.key = '\x1b[Z';
        break;
      }
      result.key = '\t';
      result.cancel = true;
      break;
    case 13:
      // return/enter
      result.key = '\r';
      result.cancel = true;
      break;
    case 27:
      // escape
      result.key = '\x1b';
      result.cancel = true;
      break;
    case 37:
      // left-arrow
      if (modifiers) {
        result.key = '\x1b[1;' + (modifiers + 1) + 'D';
        // HACK: Make Alt + left-arrow behave like Ctrl + left-arrow: move one word backwards
        // http://unix.stackexchange.com/a/108106
        if (result.key == '\x1b[1;3D') {
          result.key = '\x1b[1;5D';
        }
      } else if (this.applicationCursor) {
        result.key = '\x1bOD';
      } else {
        result.key = '\x1b[D';
      }
      break;
    case 39:
      // right-arrow
      if (modifiers) {
        result.key = '\x1b[1;' + (modifiers + 1) + 'C';
        // HACK: Make Alt + right-arrow behave like Ctrl + right-arrow: move one word forward
        // http://unix.stackexchange.com/a/108106
        if (result.key == '\x1b[1;3C') {
          result.key = '\x1b[1;5C';
        }
      } else if (this.applicationCursor) {
        result.key = '\x1bOC';
      } else {
        result.key = '\x1b[C';
      }
      break;
    case 38:
      // up-arrow
      if (modifiers) {
        result.key = '\x1b[1;' + (modifiers + 1) + 'A';
        // HACK: Make Alt + up-arrow behave like Ctrl + up-arrow
        // http://unix.stackexchange.com/a/108106
        if (result.key == '\x1b[1;3A') {
          result.key = '\x1b[1;5A';
        }
      } else if (this.applicationCursor) {
        result.key = '\x1bOA';
      } else {
        result.key = '\x1b[A';
      }
      break;
    case 40:
      // down-arrow
      if (modifiers) {
        result.key = '\x1b[1;' + (modifiers + 1) + 'B';
        // HACK: Make Alt + down-arrow behave like Ctrl + down-arrow
        // http://unix.stackexchange.com/a/108106
        if (result.key == '\x1b[1;3B') {
          result.key = '\x1b[1;5B';
        }
      } else if (this.applicationCursor) {
        result.key = '\x1bOB';
      } else {
        result.key = '\x1b[B';
      }
      break;
    case 45:
      // insert
      if (!ev.shiftKey && !ev.ctrlKey) {
        // <Ctrl> or <Shift> + <Insert> are used to
        // copy-paste on some systems.
        result.key = '\x1b[2~';
      }
      break;
    case 46:
      // delete
      if (modifiers) {
        result.key = '\x1b[3;' + (modifiers + 1) + '~';
      } else {
        result.key = '\x1b[3~';
      }
      break;
    case 36:
      // home
      if (modifiers)
        result.key = '\x1b[1;' + (modifiers + 1) + 'H';
      else if (this.applicationCursor)
        result.key = '\x1bOH';
      else
        result.key = '\x1b[H';
      break;
    case 35:
      // end
      if (modifiers)
        result.key = '\x1b[1;' + (modifiers + 1) + 'F';
      else if (this.applicationCursor)
        result.key = '\x1bOF';
      else
        result.key = '\x1b[F';
      break;
    case 33:
      // page up
      if (ev.shiftKey) {
        result.scrollDisp = -(this.rows - 1);
      } else {
        result.key = '\x1b[5~';
      }
      break;
    case 34:
      // page down
      if (ev.shiftKey) {
        result.scrollDisp = this.rows - 1;
      } else {
        result.key = '\x1b[6~';
      }
      break;
    case 112:
      // F1-F12
      if (modifiers) {
        result.key = '\x1b[1;' + (modifiers + 1) + 'P';
      } else {
        result.key = '\x1bOP';
      }
      break;
    case 113:
      if (modifiers) {
        result.key = '\x1b[1;' + (modifiers + 1) + 'Q';
      } else {
        result.key = '\x1bOQ';
      }
      break;
    case 114:
      if (modifiers) {
        result.key = '\x1b[1;' + (modifiers + 1) + 'R';
      } else {
        result.key = '\x1bOR';
      }
      break;
    case 115:
      if (modifiers) {
        result.key = '\x1b[1;' + (modifiers + 1) + 'S';
      } else {
        result.key = '\x1bOS';
      }
      break;
    case 116:
      if (modifiers) {
        result.key = '\x1b[15;' + (modifiers + 1) + '~';
      } else {
        result.key = '\x1b[15~';
      }
      break;
    case 117:
      if (modifiers) {
        result.key = '\x1b[17;' + (modifiers + 1) + '~';
      } else {
        result.key = '\x1b[17~';
      }
      break;
    case 118:
      if (modifiers) {
        result.key = '\x1b[18;' + (modifiers + 1) + '~';
      } else {
        result.key = '\x1b[18~';
      }
      break;
    case 119:
      if (modifiers) {
        result.key = '\x1b[19;' + (modifiers + 1) + '~';
      } else {
        result.key = '\x1b[19~';
      }
      break;
    case 120:
      if (modifiers) {
        result.key = '\x1b[20;' + (modifiers + 1) + '~';
      } else {
        result.key = '\x1b[20~';
      }
      break;
    case 121:
      if (modifiers) {
        result.key = '\x1b[21;' + (modifiers + 1) + '~';
      } else {
        result.key = '\x1b[21~';
      }
      break;
    case 122:
      if (modifiers) {
        result.key = '\x1b[23;' + (modifiers + 1) + '~';
      } else {
        result.key = '\x1b[23~';
      }
      break;
    case 123:
      if (modifiers) {
        result.key = '\x1b[24;' + (modifiers + 1) + '~';
      } else {
        result.key = '\x1b[24~';
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
          // ^[ - escape
          result.key = String.fromCharCode(27);
        } else if (ev.keyCode === 221) {
          // ^] - group sep
          result.key = String.fromCharCode(29);
        }
      } else if (!this.isMac && ev.altKey && !ev.ctrlKey && !ev.metaKey) {
        // On Mac this is a third level shift. Use <Esc> instead.
        if (ev.keyCode >= 65 && ev.keyCode <= 90) {
          result.key = '\x1b' + String.fromCharCode(ev.keyCode + 32);
        } else if (ev.keyCode === 192) {
          result.key = '\x1b`';
        } else if (ev.keyCode >= 48 && ev.keyCode <= 57) {
          result.key = '\x1b' + (ev.keyCode - 48);
        }
      }
      break;
  }
  return result;
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

function contains(el, arr) {
  for (var i = 0; i < arr.length; i += 1) {
    if (el === arr[i]) {
      return true;
    }
  }
  return false;
}

function cancel(ev, force) {
  if (!this.cancelEvents && !force) {
    return;
  }
  ev.preventDefault();
  ev.stopPropagation();
  return false;
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
    (term.isMac && ev.altKey && !ev.ctrlKey && !ev.metaKey) ||
    (term.isMSWindows && ev.altKey && ev.ctrlKey && !ev.metaKey);

  if (ev.type == 'keypress') {
    return thirdLevelKey;
  }

  // Don't invoke for arrows, pageDown, home, backspace, etc. (on non-keypress events)
  return thirdLevelKey && (!ev.keyCode || ev.keyCode > 47);
}

/**
 * Expose
 */
Terminal.EventEmitter = EventEmitter;
Terminal.CompositionHelper = CompositionHelper;
Terminal.Viewport = Viewport;

/**
 * Adds an event listener to the terminal.
 *
 * @param {string} event The name of the event. TODO: Document all event types
 * @param {function} callback The function to call when the event is triggered.
 */
Terminal.on = on;
Terminal.off = off;
Terminal.cancel = cancel;
Terminal.inherits = Core.inherits;

module.exports = Terminal;
