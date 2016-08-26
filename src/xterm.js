/**
 * xterm.js: xterm, in the browser
 * Copyright (c) 2014, sourceLair Limited (www.sourcelair.com (MIT License)
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

'use strict';



const EventEmitter      = require('./lib/eventemitter');
const CompositionHelper = require('./lib/compositionhelper');
const Viewport          = require('./lib/viewport');

const escapeSequence    = require('./lib/escapeSequence');

    //those are 3rd party generics
const matchColor        = require('./utils/matchColor');
const off               = require('./utils/off');
const on                = require('./utils/on');
const contains          = require('./utils/contains');
const wcwidth           = require('./utils/wcwidth')({nul: 0, control: 0});  // configurable options
const isThirdLevelShift = require('./utils/isThirdLevelShift');

const isBoldBroken      = require('./utils/dom/isBoldBroken');



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


const States = {
  normal  : 0,
  escaped : 1,
  csi     : 2,
  osc     : 3,
  charset : 4,
  dcs     : 5,
  ignore  : 6,
};


    /**
     * Terminal
     */

    /**
     * Creates a new `Terminal` object.
     *
     * @param {object} options An object containing a set of options, the available options are:
     *   - cursorBlink (boolean): Whether the terminal cursor blinks
     *
     * @public
     * @class Xterm Xterm
     * @alias module:xterm/src/xterm
     */

  class Terminal extends EventEmitter {

    constructor (options) {
      super(); //set 'this'

      this.initialize.apply(this, arguments);
    }

    initialize(options) {

      if (typeof options === 'number') {
        options = {
          cols: arguments[0],
          rows: arguments[1],
          handler: arguments[2]
        };
      }

      options = options || {};


      Object.keys(Terminal.defaults).forEach( (key) => {
        if (options[key] == null) {
          options[key] = Terminal.options[key];

          if (Terminal[key] !== Terminal.defaults[key]) {
            options[key] = Terminal[key];
          }
        }
        this[key] = options[key];
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

        //container node xterm is bound to
        //until you call open(dom), parent might not bound
      this.parent = options.body || options.parent;

        //document context, beware as it might be null (e.g. in nodejs)
      this.document = this.parent ? this.parent.ownerDocument : options.document;


      this.cols = options.cols || options.geometry[0];
      this.rows = options.rows || options.geometry[1];

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

      /**
       * Used to debounce the refresh function
       */
      this.isRefreshing = false;

      /**
       * Whether there is a full terminal refresh queued
       */

      this.cursorState = 0;
      this.cursorHidden = false;
      this.convertEol;
      this.state = 0;
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

      // leftover surrogate high from previous write invocation
      this.surrogate_high = '';

      /**
       * An array of all lines in the entire buffer, including the prompt. The lines are array of
       * characters which are 2-length arrays where [0] is an attribute and [1] is the character.
       */
      this.lines = [];
      var i = this.rows;
      while (i--) {
        this.lines.push(this.blankLine());
      }

      this.tabs;
      this.setupStops();
    }



		/**
		 * back_color_erase feature for xterm.
		 */
    eraseAttr() {
      // if (this.is('screen')) return this.defAttr;
      return (this.defAttr & ~0x1ff) | (this.curAttr & 0x1ff);
    }

    /**
     * Focus the terminal. Delegates focus handling to the terminal's DOM element.
     */
    focus() {
      return this.textarea.focus();
    }

    /**
     * Binds the desired focus behavior on a given terminal object.
     *
     * @static
     */
    static bindFocus(term) {
      on(term.textarea, 'focus', function (ev) {
        if (term.sendFocus) {
          term.send('\x1b[I');
        }
        term.element.classList.add('focus');
        term.showCursor();
        Terminal.focus = term;
        term.emit('focus', {terminal: term});
      });
    }

    /**
     * Blur the terminal. Delegates blur handling to the terminal's DOM element.
     */
    blur() {
      return this.textarea.blur();
    }

    /**
     * Binds the desired blur behavior on a given terminal object.
     *
     * @static
     */
    static bindBlur(term) {
      on(term.textarea, 'blur', function (ev) {
        term.refresh(term.y, term.y);
        if (term.sendFocus) {
          term.send('\x1b[O');
        }
        term.element.classList.remove('focus');
        Terminal.focus = null;
        term.emit('blur', {terminal: term});
      });
    }

    /**
     * Initialize default behavior
     */
    initGlobal() {
      Terminal.bindPaste(this);
      Terminal.bindKeys(this);
      Terminal.bindCopy(this);
      Terminal.bindFocus(this);
      Terminal.bindBlur(this);
    }

    /**
     * Bind to paste event and allow both keyboard and right-click pasting, without having the
     * contentEditable value set to true.
     */
    static bindPaste(term) {
      on([term.textarea, term.element], 'paste', function(ev) {
        ev.stopPropagation();
        if (ev.clipboardData) {
          var text = ev.clipboardData.getData('text/plain');
          term.handler(text);
          term.textarea.value = '';
          return term.cancel(ev);
        }
      });
    }

    /**
     * Prepares text copied from terminal selection, to be saved in the clipboard by:
     *   1. stripping all trailing white spaces
     *   2. converting all non-breaking spaces to regular spaces
     * @param {string} text The copied text that needs processing for storing in clipboard
     * @returns {string}
     * @static
     */
    static prepareCopiedTextForClipboard(text) {
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
    }

    /**
     * Apply key handling to the terminal
     */
    static bindKeys(term) {
      on(term.element, 'keydown', function(ev) {
        if (term.document.activeElement != this) {
          return;
         }
         term.keyDown(ev);
      }, true);

      on(term.element, 'keypress', function(ev) {
        if (term.document.activeElement != this) {
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
    }

    /**
     * Binds copy functionality to the given terminal.
     * @static
     */
    static bindCopy(term) {
      on(term.element, 'copy', function(ev) {
        return; // temporary
      });
    }


    /**
     * Insert the given row to the terminal or produce a new one
     * if no row argument is passed. Return the inserted row.
     * @param {HTMLElement} row (optional) The row to append to the terminal.
     */
    insertRow (row) {
      if (typeof row != 'object') {
        row = this.document.createElement('div');
      }

      this.rowContainer.appendChild(row);
      this.children.push(row);

      return row;
    }

    /**
     * Opens the terminal within an element.
     *
     * @param {HTMLElement} parent The element to create the terminal within.
     */
    open(parent) {
      var self=this, i=0, div;

      this.parent = parent || this.parent;

      if (!this.parent) {
        throw new Error('Terminal requires a parent element.');
      }

      /*
      * Grab global elements
      */
      this.context = this.parent.ownerDocument.defaultView;
      this.document = this.parent.ownerDocument;
      this.body = this.document.getElementsByTagName('body')[0];

      /*
      * Parse User-Agent
      */
      if (this.context.navigator && this.context.navigator.userAgent) {
        this.isMSIE = !!~this.context.navigator.userAgent.indexOf('MSIE');
      }

      /*
      * Find the users platform. We use this to interpret the meta key
      * and ISO third level shifts.
      * http://stackoverflow.com/questions/19877924/what-is-the-list-of-possible-values-for-navigator-platform-as-of-today
      */
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

      /*
      * Create main element container
      */
      this.element = this.document.createElement('div');
      this.element.classList.add('terminal');
      this.element.classList.add('xterm');
      this.element.classList.add('xterm-theme-' + this.theme);

      this.element.setAttribute('tabindex', 0);

      this.viewportElement = this.document.createElement('div');
      this.viewportElement.classList.add('xterm-viewport');
      this.element.appendChild(this.viewportElement);
      this.viewportScrollArea = this.document.createElement('div');
      this.viewportScrollArea.classList.add('xterm-scroll-area');
      this.viewportElement.appendChild(this.viewportScrollArea);

      /*
      * Create the container that will hold the lines of the terminal and then
      * produce the lines the lines.
      */
      this.rowContainer = this.document.createElement('div');
      this.rowContainer.classList.add('xterm-rows');
      this.element.appendChild(this.rowContainer);
      this.children = [];

      /*
      * Create the container that will hold helpers like the textarea for
      * capturing DOM Events. Then produce the helpers.
      */
      this.helperContainer = this.document.createElement('div');
      this.helperContainer.classList.add('xterm-helpers');
      // TODO: This should probably be inserted once it's filled to prevent an additional layout
      this.element.appendChild(this.helperContainer);
      this.textarea = this.document.createElement('textarea');
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

      this.compositionView = this.document.createElement('div');
      this.compositionView.classList.add('composition-view');
      this.compositionHelper = new CompositionHelper(this.textarea, this.compositionView, this);
      this.helperContainer.appendChild(this.compositionView);

      this.charMeasureElement = this.document.createElement('div');
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

      on(this.element, 'mouseup', function() {
        var selection = self.document.getSelection(),
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
      // if bold is broken, we can't
      // use it in the terminal.
      if (Terminal.brokenBold == null) {
        Terminal.brokenBold = isBoldBroken(this.document);
      }

      this.emit('open');
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
    bindMouse() {
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
    }

    /**
     * Destroys the terminal.
     */
    destroy() {
      this.readable = false;
      this.writable = false;
      this._events = {};
      this.handler = function() {};
      this.write = function() {};
      if (this.element.parentNode) {
        this.element.parentNode.removeChild(this.element);
      }
      //this.emit('close');
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
     * @param {boolean} queue Whether the refresh should ran right now or be queued
     */
    refresh(start, end, queue) {
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

      var x, y, i, line, out, ch, ch_width, width, data, attr, bg, fg, flags, row, parent, focused = this.document.activeElement;

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

                /**
                 * If inverse flag is on, then swap the foreground and background variables.
                 */
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

      this.emit('refresh', {element: this.element, start: start, end: end});
    }

    /**
     * Display the cursor element
     */
    showCursor() {
      if (!this.cursorState) {
        this.cursorState = 1;
        this.refresh(this.y, this.y);
      }
    }

    /**
     * Scroll the terminal
     */
    scroll() {
      var row;

      if (++this.ybase === this.scrollback) {
        this.ybase = this.ybase / 2 | 0;
        this.lines = this.lines.slice(-(this.ybase + this.rows) + 1);
      }

      this.ydisp = this.ybase;

      // last line
      row = this.ybase + this.rows - 1;

      // subtract the bottom scroll region
      row -= this.rows - 1 - this.scrollBottom;

      if (row === this.lines.length) {
        // potential optimization:
        // pushing is faster than splicing
        // when they amount to the same
        // behavior.
        this.lines.push(this.blankLine());
      } else {
        // add our new line
        this.lines.splice(row, 0, this.blankLine());
      }

      if (this.scrollTop !== 0) {
        if (this.ybase !== 0) {
          this.ybase--;
          this.ydisp = this.ybase;
        }
        this.lines.splice(this.ybase + this.scrollTop, 1);
      }

      // this.maxRange();
      this.updateRange(this.scrollTop);
      this.updateRange(this.scrollBottom);

      this.emit('scroll', this.ydisp);
    }

    /**
     * Scroll the display of the terminal
     * @param {number} disp The number of lines to scroll down (negatives scroll up).
     * @param {boolean} suppressScrollEvent Don't emit the scroll event as scrollDisp. This is used
     * to avoid unwanted events being handled by the veiwport when the event was triggered from the
     * viewport originally.
     */
    scrollDisp(disp, suppressScrollEvent) {
      this.ydisp += disp;

      if (this.ydisp > this.ybase) {
        this.ydisp = this.ybase;
      } else if (this.ydisp < 0) {
        this.ydisp = 0;
      }

      if (!suppressScrollEvent) {
        this.emit('scroll', this.ydisp);
      }

      this.refresh(0, this.rows - 1);
    }

    /**
     * Writes text to the terminal.
     * @param {string} text The text to write to the terminal.
     */
    write(data) {
      var l = data.length, i = 0, j, cs, ch, code, low, ch_width, row;

      this.refreshStart = this.y;
      this.refreshEnd = this.y;

      if (this.ybase !== this.ydisp) {
        this.ydisp = this.ybase;
        this.emit('scroll', this.ydisp);
        this.maxRange();
      }

      // apply leftover surrogate high from last write
      if (this.surrogate_high) {
        data = this.surrogate_high + data;
        this.surrogate_high = '';
      }

      for (; i < l; i++) {
        ch = data[i];

        // FIXME: higher chars than 0xa0 are not allowed in escape sequences
        //        --> maybe move to default
        code = data.charCodeAt(i);
        if (0xD800 <= code && code <= 0xDBFF) {
          // we got a surrogate high
          // get surrogate low (next 2 bytes)
          low = data.charCodeAt(i+1);
          if (isNaN(low)) {
            // end of data stream, save surrogate high
            this.surrogate_high = ch;
            continue;
          }
          code = ((code - 0xD800) * 0x400) + (low - 0xDC00) + 0x10000;
          ch += data.charAt(i+1);
        }
        // surrogate low - already handled above
        if (0xDC00 <= code && code <= 0xDFFF)
          continue;

        switch (this.state) {
          case States.normal:
            switch (ch) {
              case '\x07':
                this.bell();
                break;

              // '\n', '\v', '\f'
              case '\n':
              case '\x0b':
              case '\x0c':
                if (this.convertEol) {
                  this.x = 0;
                }
                this.y++;
                if (this.y > this.scrollBottom) {
                  this.y--;
                  this.scroll();
                }
                break;

              // '\r'
              case '\r':
                this.x = 0;
                break;

              // '\b'
              case '\x08':
                if (this.x > 0) {
                  this.x--;
                }
                break;

              // '\t'
              case '\t':
                this.x = this.nextStop();
                break;

              // shift out
              case '\x0e':
                this.setgLevel(1);
                break;

              // shift in
              case '\x0f':
                this.setgLevel(0);
                break;

              // '\e'
              case '\x1b':
                this.state = States.escaped;
                break;

              default:
                // ' '
                // calculate print space
                // expensive call, therefore we save width in line buffer
                ch_width = wcwidth(code);

                if (ch >= ' ') {
                  if (this.charset && this.charset[ch]) {
                    ch = this.charset[ch];
                  }

                  row = this.y + this.ybase;

                  // insert combining char in last cell
                  // FIXME: needs handling after cursor jumps
                  if (!ch_width && this.x) {

                    // dont overflow left
                    if (this.lines[row][this.x-1]) {
                      if (!this.lines[row][this.x-1][2]) {

                        // found empty cell after fullwidth, need to go 2 cells back
                        if (this.lines[row][this.x-2])
                          this.lines[row][this.x-2][1] += ch;

                      } else {
                        this.lines[row][this.x-1][1] += ch;
                      }
                      this.updateRange(this.y);
                    }
                    break;
                  }

                  // goto next line if ch would overflow
                  // TODO: needs a global min terminal width of 2
                  if (this.x+ch_width-1 >= this.cols) {
                    // autowrap - DECAWM
                    if (this.wraparoundMode) {
                      this.x = 0;
                      this.y++;
                      if (this.y > this.scrollBottom) {
                        this.y--;
                        this.scroll();
                      }
                    } else {
                      this.x = this.cols-1;
                      if(ch_width===2)  // FIXME: check for xterm behavior
                        continue;
                    }
                  }
                  row = this.y + this.ybase;

                  // insert mode: move characters to right
                  if (this.insertMode) {
                    // do this twice for a fullwidth char
                    for (var moves=0; moves<ch_width; ++moves) {
                      // remove last cell, if it's width is 0
                      // we have to adjust the second last cell as well
                      var removed = this.lines[this.y + this.ybase].pop();
                      if (removed[2]===0
                          && this.lines[row][this.cols-2]
                          && this.lines[row][this.cols-2][2]===2)
                        this.lines[row][this.cols-2] = [this.curAttr, ' ', 1];

                      // insert empty cell at cursor
                      this.lines[row].splice(this.x, 0, [this.curAttr, ' ', 1]);
                    }
                  }

                  this.lines[row][this.x] = [this.curAttr, ch, ch_width];
                  this.x++;
                  this.updateRange(this.y);

                  // fullwidth char - set next cell width to zero and advance cursor
                  if (ch_width===2) {
                    this.lines[row][this.x] = [this.curAttr, '', 0];
                    this.x++;
                  }
                }
                break;
            }
            break;
          case States.escaped:
            switch (ch) {
              // ESC [ Control Sequence Introducer ( CSI is 0x9b).
              case '[':
                this.params = [];
                this.currentParam = 0;
                this.state = States.csi;
                break;

              // ESC ] Operating System Command ( OSC is 0x9d).
              case ']':
                this.params = [];
                this.currentParam = 0;
                this.state = States.osc;
                break;

              // ESC P Device Control String ( DCS is 0x90).
              case 'P':
                this.params = [];
                this.currentParam = 0;
                this.state = States.dcs;
                break;

              // ESC _ Application Program Command ( APC is 0x9f).
              case '_':
                this.state = States.ignore;
                break;

              // ESC ^ Privacy Message ( PM is 0x9e).
              case '^':
                this.state = States.ignore;
                break;

              // ESC c Full Reset (RIS).
              case 'c':
                this.reset();
                break;

              // ESC E Next Line ( NEL is 0x85).
              // ESC D Index ( IND is 0x84).
              case 'E':
                this.x = 0;
                ;
              case 'D':
                this.index();
                break;

              // ESC M Reverse Index ( RI is 0x8d).
              case 'M':
                this.reverseIndex();
                break;

              // ESC % Select default/utf-8 character set.
              // @ = default, G = utf-8
              case '%':
                //this.charset = null;
                this.setgLevel(0);
                this.setgCharset(0, Terminal.charsets.US);
                this.state = States.normal;
                i++;
                break;

              // ESC (,),*,+,-,. Designate G0-G2 Character Set.
              case '(': // <-- this seems to get all the attention
              case ')':
              case '*':
              case '+':
              case '-':
              case '.':
                switch (ch) {
                  case '(':
                    this.gcharset = 0;
                    break;
                  case ')':
                    this.gcharset = 1;
                    break;
                  case '*':
                    this.gcharset = 2;
                    break;
                  case '+':
                    this.gcharset = 3;
                    break;
                  case '-':
                    this.gcharset = 1;
                    break;
                  case '.':
                    this.gcharset = 2;
                    break;
                }
                this.state = States.charset;
                break;

              // Designate G3 Character Set (VT300).
              // A = ISO Latin-1 Supplemental.
              // Not implemented.
              case '/':
                this.gcharset = 3;
                this.state = States.charset;
                i--;
                break;

              // ESC N
              // Single Shift Select of G2 Character Set
              // ( SS2 is 0x8e). This affects next character only.
              case 'N':
                break;
              // ESC O
              // Single Shift Select of G3 Character Set
              // ( SS3 is 0x8f). This affects next character only.
              case 'O':
                break;
              // ESC n
              // Invoke the G2 Character Set as GL (LS2).
              case 'n':
                this.setgLevel(2);
                break;
              // ESC o
              // Invoke the G3 Character Set as GL (LS3).
              case 'o':
                this.setgLevel(3);
                break;
              // ESC |
              // Invoke the G3 Character Set as GR (LS3R).
              case '|':
                this.setgLevel(3);
                break;
              // ESC }
              // Invoke the G2 Character Set as GR (LS2R).
              case '}':
                this.setgLevel(2);
                break;
              // ESC ~
              // Invoke the G1 Character Set as GR (LS1R).
              case '~':
                this.setgLevel(1);
                break;

              // ESC 7 Save Cursor (DECSC).
              case '7':
                this.saveCursor();
                this.state = States.normal;
                break;

              // ESC 8 Restore Cursor (DECRC).
              case '8':
                this.restoreCursor();
                this.state = States.normal;
                break;

              // ESC # 3 DEC line height/width
              case '#':
                this.state = States.normal;
                i++;
                break;

              // ESC H Tab Set (HTS is 0x88).
              case 'H':
                this.tabSet();
                break;

              // ESC = Application Keypad (DECKPAM).
              case '=':
                this.log('Serial port requested application keypad.');
                this.applicationKeypad = true;
                this.viewport.setApplicationMode(true);
                this.state = States.normal;
                break;

              // ESC > Normal Keypad (DECKPNM).
              case '>':
                this.log('Switching back to normal keypad.');
                this.applicationKeypad = false;
                this.viewport.setApplicationMode(false);
                this.state = States.normal;
                break;

              default:
                this.state = States.normal;
                this.error('Unknown ESC control: %s.', ch);
                break;
            }
            break;

          case States.charset:
            switch (ch) {
              case '0': // DEC Special Character and Line Drawing Set.
                cs = Terminal.charsets.SCLD;
                break;
              case 'A': // UK
                cs = Terminal.charsets.UK;
                break;
              case 'B': // United States (USASCII).
                cs = Terminal.charsets.US;
                break;
              case '4': // Dutch
                cs = Terminal.charsets.Dutch;
                break;
              case 'C': // Finnish
              case '5':
                cs = Terminal.charsets.Finnish;
                break;
              case 'R': // French
                cs = Terminal.charsets.French;
                break;
              case 'Q': // FrenchCanadian
                cs = Terminal.charsets.FrenchCanadian;
                break;
              case 'K': // German
                cs = Terminal.charsets.German;
                break;
              case 'Y': // Italian
                cs = Terminal.charsets.Italian;
                break;
              case 'E': // NorwegianDanish
              case '6':
                cs = Terminal.charsets.NorwegianDanish;
                break;
              case 'Z': // Spanish
                cs = Terminal.charsets.Spanish;
                break;
              case 'H': // Swedish
              case '7':
                cs = Terminal.charsets.Swedish;
                break;
              case '=': // Swiss
                cs = Terminal.charsets.Swiss;
                break;
              case '/': // ISOLatin (actually /A)
                cs = Terminal.charsets.ISOLatin;
                i++;
                break;
              default: // Default
                cs = Terminal.charsets.US;
                break;
            }
            this.setgCharset(this.gcharset, cs);
            this.gcharset = null;
            this.state = States.normal;
            break;

          case States.osc:
            // OSC Ps ; Pt ST
            // OSC Ps ; Pt BEL
            //   Set Text Parameters.
            if (ch === '\x1b' || ch === '\x07') {
              if (ch === '\x1b') i++;

              this.params.push(this.currentParam);

              switch (this.params[0]) {
                case 0:
                case 1:
                case 2:
                  if (this.params[1]) {
                    this.title = this.params[1];
                    this.handleTitle(this.title);
                  }
                  break;
                case 3:
                  // set X property
                  break;
                case 4:
                case 5:
                  // change dynamic colors
                  break;
                case 10:
                case 11:
                case 12:
                case 13:
                case 14:
                case 15:
                case 16:
                case 17:
                case 18:
                case 19:
                  // change dynamic ui colors
                  break;
                case 46:
                  // change log file
                  break;
                case 50:
                  // dynamic font
                  break;
                case 51:
                  // emacs shell
                  break;
                case 52:
                  // manipulate selection data
                  break;
                case 104:
                case 105:
                case 110:
                case 111:
                case 112:
                case 113:
                case 114:
                case 115:
                case 116:
                case 117:
                case 118:
                  // reset colors
                  break;
              }

              this.params = [];
              this.currentParam = 0;
              this.state = States.normal;
            } else {
              if (!this.params.length) {
                if (ch >= '0' && ch <= '9') {
                  this.currentParam =
                    this.currentParam * 10 + ch.charCodeAt(0) - 48;
                } else if (ch === ';') {
                  this.params.push(this.currentParam);
                  this.currentParam = '';
                }
              } else {
                this.currentParam += ch;
              }
            }
            break;

          case States.csi:
            // '?', '>', '!'
            if (ch === '?' || ch === '>' || ch === '!') {
              this.prefix = ch;
              break;
            }

            // 0 - 9
            if (ch >= '0' && ch <= '9') {
              this.currentParam = this.currentParam * 10 + ch.charCodeAt(0) - 48;
              break;
            }

            // '$', '"', ' ', '\''
            if (ch === '$' || ch === '"' || ch === ' ' || ch === '\'') {
              this.postfix = ch;
              break;
            }

            this.params.push(this.currentParam);
            this.currentParam = 0;

            // ';'
            if (ch === ';') break;

            this.state = States.normal;

            switch (ch) {
              // CSI Ps A
              // Cursor Up Ps Times (default = 1) (CUU).
              case 'A':
                this.cursorUp(this.params);
                break;

              // CSI Ps B
              // Cursor Down Ps Times (default = 1) (CUD).
              case 'B':
                this.cursorDown(this.params);
                break;

              // CSI Ps C
              // Cursor Forward Ps Times (default = 1) (CUF).
              case 'C':
                this.cursorForward(this.params);
                break;

              // CSI Ps D
              // Cursor Backward Ps Times (default = 1) (CUB).
              case 'D':
                this.cursorBackward(this.params);
                break;

              // CSI Ps ; Ps H
              // Cursor Position [row;column] (default = [1,1]) (CUP).
              case 'H':
                this.cursorPos(this.params);
                break;

              // CSI Ps J  Erase in Display (ED).
              case 'J':
                this.eraseInDisplay(this.params);
                break;

              // CSI Ps K  Erase in Line (EL).
              case 'K':
                this.eraseInLine(this.params);
                break;

              // CSI Pm m  Character Attributes (SGR).
              case 'm':
                if (!this.prefix) {
                  this.charAttributes(this.params);
                }
                break;

              // CSI Ps n  Device Status Report (DSR).
              case 'n':
                if (!this.prefix) {
                  this.deviceStatus(this.params);
                }
                break;

              /**
               * Additions
               */

              // CSI Ps @
              // Insert Ps (Blank) Character(s) (default = 1) (ICH).
              case '@':
                this.insertChars(this.params);
                break;

              // CSI Ps E
              // Cursor Next Line Ps Times (default = 1) (CNL).
              case 'E':
                this.cursorNextLine(this.params);
                break;

              // CSI Ps F
              // Cursor Preceding Line Ps Times (default = 1) (CNL).
              case 'F':
                this.cursorPrecedingLine(this.params);
                break;

              // CSI Ps G
              // Cursor Character Absolute  [column] (default = [row,1]) (CHA).
              case 'G':
                this.cursorCharAbsolute(this.params);
                break;

              // CSI Ps L
              // Insert Ps Line(s) (default = 1) (IL).
              case 'L':
                this.insertLines(this.params);
                break;

              // CSI Ps M
              // Delete Ps Line(s) (default = 1) (DL).
              case 'M':
                this.deleteLines(this.params);
                break;

              // CSI Ps P
              // Delete Ps Character(s) (default = 1) (DCH).
              case 'P':
                this.deleteChars(this.params);
                break;

              // CSI Ps X
              // Erase Ps Character(s) (default = 1) (ECH).
              case 'X':
                this.eraseChars(this.params);
                break;

              // CSI Pm `  Character Position Absolute
              //   [column] (default = [row,1]) (HPA).
              case '`':
                this.charPosAbsolute(this.params);
                break;

              // 141 61 a * HPR -
              // Horizontal Position Relative
              case 'a':
                this.HPositionRelative(this.params);
                break;

              // CSI P s c
              // Send Device Attributes (Primary DA).
              // CSI > P s c
              // Send Device Attributes (Secondary DA)
              case 'c':
                this.sendDeviceAttributes(this.params);
                break;

              // CSI Pm d
              // Line Position Absolute  [row] (default = [1,column]) (VPA).
              case 'd':
                this.linePosAbsolute(this.params);
                break;

              // 145 65 e * VPR - Vertical Position Relative
              case 'e':
                this.VPositionRelative(this.params);
                break;

              // CSI Ps ; Ps f
              //   Horizontal and Vertical Position [row;column] (default =
              //   [1,1]) (HVP).
              case 'f':
                this.HVPosition(this.params);
                break;

              // CSI Pm h  Set Mode (SM).
              // CSI ? Pm h - mouse escape codes, cursor escape codes
              case 'h':
                this.setMode(this.params);
                break;

              // CSI Pm l  Reset Mode (RM).
              // CSI ? Pm l
              case 'l':
                this.resetMode(this.params);
                break;

              // CSI Ps ; Ps r
              //   Set Scrolling Region [top;bottom] (default = full size of win-
              //   dow) (DECSTBM).
              // CSI ? Pm r
              case 'r':
                this.setScrollRegion(this.params);
                break;

              // CSI s
              //   Save cursor (ANSI.SYS).
              case 's':
                this.saveCursor(this.params);
                break;

              // CSI u
              //   Restore cursor (ANSI.SYS).
              case 'u':
                this.restoreCursor(this.params);
                break;

              /**
               * Lesser Used
               */

              // CSI Ps I
              // Cursor Forward Tabulation Ps tab stops (default = 1) (CHT).
              case 'I':
                this.cursorForwardTab(this.params);
                break;

              // CSI Ps S  Scroll up Ps lines (default = 1) (SU).
              case 'S':
                this.scrollUp(this.params);
                break;

              // CSI Ps T  Scroll down Ps lines (default = 1) (SD).
              // CSI Ps ; Ps ; Ps ; Ps ; Ps T
              // CSI > Ps; Ps T
              case 'T':
                // if (this.prefix === '>') {
                //   this.resetTitleModes(this.params);
                //   break;
                // }
                // if (this.params.length > 2) {
                //   this.initMouseTracking(this.params);
                //   break;
                // }
                if (this.params.length < 2 && !this.prefix) {
                  this.scrollDown(this.params);
                }
                break;

              // CSI Ps Z
              // Cursor Backward Tabulation Ps tab stops (default = 1) (CBT).
              case 'Z':
                this.cursorBackwardTab(this.params);
                break;

              // CSI Ps b  Repeat the preceding graphic character Ps times (REP).
              case 'b':
                this.repeatPrecedingCharacter(this.params);
                break;

              // CSI Ps g  Tab Clear (TBC).
              case 'g':
                this.tabClear(this.params);
                break;

              // CSI Pm i  Media Copy (MC).
              // CSI ? Pm i
              // case 'i':
              //   this.mediaCopy(this.params);
              //   break;

              // CSI Pm m  Character Attributes (SGR).
              // CSI > Ps; Ps m
              // case 'm': // duplicate
              //   if (this.prefix === '>') {
              //     this.setResources(this.params);
              //   } else {
              //     this.charAttributes(this.params);
              //   }
              //   break;

              // CSI Ps n  Device Status Report (DSR).
              // CSI > Ps n
              // case 'n': // duplicate
              //   if (this.prefix === '>') {
              //     this.disableModifiers(this.params);
              //   } else {
              //     this.deviceStatus(this.params);
              //   }
              //   break;

              // CSI > Ps p  Set pointer mode.
              // CSI ! p   Soft terminal reset (DECSTR).
              // CSI Ps$ p
              //   Request ANSI mode (DECRQM).
              // CSI ? Ps$ p
              //   Request DEC private mode (DECRQM).
              // CSI Ps ; Ps " p
              case 'p':
                switch (this.prefix) {
                  // case '>':
                  //   this.setPointerMode(this.params);
                  //   break;
                  case '!':
                    this.softReset(this.params);
                    break;
                  // case '?':
                  //   if (this.postfix === '$') {
                  //     this.requestPrivateMode(this.params);
                  //   }
                  //   break;
                  // default:
                  //   if (this.postfix === '"') {
                  //     this.setConformanceLevel(this.params);
                  //   } else if (this.postfix === '$') {
                  //     this.requestAnsiMode(this.params);
                  //   }
                  //   break;
                }
                break;

              // CSI Ps q  Load LEDs (DECLL).
              // CSI Ps SP q
              // CSI Ps " q
              // case 'q':
              //   if (this.postfix === ' ') {
              //     this.setCursorStyle(this.params);
              //     break;
              //   }
              //   if (this.postfix === '"') {
              //     this.setCharProtectionAttr(this.params);
              //     break;
              //   }
              //   this.loadLEDs(this.params);
              //   break;

              // CSI Ps ; Ps r
              //   Set Scrolling Region [top;bottom] (default = full size of win-
              //   dow) (DECSTBM).
              // CSI ? Pm r
              // CSI Pt; Pl; Pb; Pr; Ps$ r
              // case 'r': // duplicate
              //   if (this.prefix === '?') {
              //     this.restorePrivateValues(this.params);
              //   } else if (this.postfix === '$') {
              //     this.setAttrInRectangle(this.params);
              //   } else {
              //     this.setScrollRegion(this.params);
              //   }
              //   break;

              // CSI s     Save cursor (ANSI.SYS).
              // CSI ? Pm s
              // case 's': // duplicate
              //   if (this.prefix === '?') {
              //     this.savePrivateValues(this.params);
              //   } else {
              //     this.saveCursor(this.params);
              //   }
              //   break;

              // CSI Ps ; Ps ; Ps t
              // CSI Pt; Pl; Pb; Pr; Ps$ t
              // CSI > Ps; Ps t
              // CSI Ps SP t
              // case 't':
              //   if (this.postfix === '$') {
              //     this.reverseAttrInRectangle(this.params);
              //   } else if (this.postfix === ' ') {
              //     this.setWarningBellVolume(this.params);
              //   } else {
              //     if (this.prefix === '>') {
              //       this.setTitleModeFeature(this.params);
              //     } else {
              //       this.manipulateWindow(this.params);
              //     }
              //   }
              //   break;

              // CSI u     Restore cursor (ANSI.SYS).
              // CSI Ps SP u
              // case 'u': // duplicate
              //   if (this.postfix === ' ') {
              //     this.setMarginBellVolume(this.params);
              //   } else {
              //     this.restoreCursor(this.params);
              //   }
              //   break;

              // CSI Pt; Pl; Pb; Pr; Pp; Pt; Pl; Pp$ v
              // case 'v':
              //   if (this.postfix === '$') {
              //     this.copyRectagle(this.params);
              //   }
              //   break;

              // CSI Pt ; Pl ; Pb ; Pr ' w
              // case 'w':
              //   if (this.postfix === '\'') {
              //     this.enableFilterRectangle(this.params);
              //   }
              //   break;

              // CSI Ps x  Request Terminal Parameters (DECREQTPARM).
              // CSI Ps x  Select Attribute Change Extent (DECSACE).
              // CSI Pc; Pt; Pl; Pb; Pr$ x
              // case 'x':
              //   if (this.postfix === '$') {
              //     this.fillRectangle(this.params);
              //   } else {
              //     this.requestParameters(this.params);
              //     //this.__(this.params);
              //   }
              //   break;

              // CSI Ps ; Pu ' z
              // CSI Pt; Pl; Pb; Pr$ z
              // case 'z':
              //   if (this.postfix === '\'') {
              //     this.enableLocatorReporting(this.params);
              //   } else if (this.postfix === '$') {
              //     this.eraseRectangle(this.params);
              //   }
              //   break;

              // CSI Pm ' {
              // CSI Pt; Pl; Pb; Pr$ {
              // case '{':
              //   if (this.postfix === '\'') {
              //     this.setLocatorEvents(this.params);
              //   } else if (this.postfix === '$') {
              //     this.selectiveEraseRectangle(this.params);
              //   }
              //   break;

              // CSI Ps ' |
              // case '|':
              //   if (this.postfix === '\'') {
              //     this.requestLocatorPosition(this.params);
              //   }
              //   break;

              // CSI P m SP }
              // Insert P s Column(s) (default = 1) (DECIC), VT420 and up.
              // case '}':
              //   if (this.postfix === ' ') {
              //     this.insertColumns(this.params);
              //   }
              //   break;

              // CSI P m SP ~
              // Delete P s Column(s) (default = 1) (DECDC), VT420 and up
              // case '~':
              //   if (this.postfix === ' ') {
              //     this.deleteColumns(this.params);
              //   }
              //   break;

              default:
                this.error('Unknown CSI code: %s.', ch);
                break;
            }

            this.prefix = '';
            this.postfix = '';
            break;

          case States.dcs:
            if (ch === '\x1b' || ch === '\x07') {
              if (ch === '\x1b') i++;

              switch (this.prefix) {
                // User-Defined Keys (DECUDK).
                case '':
                  break;

                // Request Status String (DECRQSS).
                // test: echo -e '\eP$q"p\e\\'
                case '$q':
                  var pt = this.currentParam
                    , valid = false;

                  switch (pt) {
                    // DECSCA
                    case '"q':
                      pt = '0"q';
                      break;

                    // DECSCL
                    case '"p':
                      pt = '61"p';
                      break;

                    // DECSTBM
                    case 'r':
                      pt = ''
                        + (this.scrollTop + 1)
                        + ';'
                        + (this.scrollBottom + 1)
                        + 'r';
                      break;

                    // SGR
                    case 'm':
                      pt = '0m';
                      break;

                    default:
                      this.error('Unknown DCS Pt: %s.', pt);
                      pt = '';
                      break;
                  }

                  this.send('\x1bP' + +valid + '$r' + pt + '\x1b\\');
                  break;

                // Set Termcap/Terminfo Data (xterm, experimental).
                case '+p':
                  break;

                // Request Termcap/Terminfo String (xterm, experimental)
                // Regular xterm does not even respond to this sequence.
                // This can cause a small glitch in vim.
                // test: echo -ne '\eP+q6b64\e\\'
                case '+q':
                  var pt = this.currentParam
                    , valid = false;

                  this.send('\x1bP' + +valid + '+r' + pt + '\x1b\\');
                  break;

                default:
                  this.error('Unknown DCS prefix: %s.', this.prefix);
                  break;
              }

              this.currentParam = 0;
              this.prefix = '';
              this.state = States.normal;
            } else if (!this.currentParam) {
              if (!this.prefix && ch !== '$' && ch !== '+') {
                this.currentParam = ch;
              } else if (this.prefix.length === 2) {
                this.currentParam = ch;
              } else {
                this.prefix += ch;
              }
            } else {
              this.currentParam += ch;
            }
            break;

          case States.ignore:
            // For PM and APC.
            if (ch === '\x1b' || ch === '\x07') {
              if (ch === '\x1b') i++;
              this.state = States.normal;
            }
            break;
        }
      }

      this.updateRange(this.y);
      this.refresh(this.refreshStart, this.refreshEnd);
    }

    /**
     * Writes text to the terminal, followed by a break line character (\n).
     * @param {string} text The text to write to the terminal.
     */
    writeln(data) {
      this.write(data + '\r\n');
    }

    /**
     * Attaches a custom keydown handler which is run before keys are processed, giving consumers of
     * xterm.js ultimate control as to what keys should be processed by the terminal and what keys
     * should not.
     * @param {function} customKeydownHandler The custom KeyboardEvent handler to attach. This is a
     *   function that takes a KeyboardEvent, allowing consumers to stop propogation and/or prevent
     *   the default action. The function returns whether the event should be processed by xterm.js.
     */
    attachCustomKeydownHandler(customKeydownHandler) {
      this.customKeydownHandler = customKeydownHandler;
    }

    /**
     * Handle a keydown event
     * Key Resources:
     *   - https://developer.mozilla.org/en-US/docs/DOM/KeyboardEvent
     * @param {KeyboardEvent} ev The keydown event to be handled.
     */
    keyDown(ev) {

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
        return this.cancel(ev);
      }

      if (isThirdLevelShift(ev, this.isMac, this.isMSWindows))
        return true;

      if (result.cancel ) {
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
    }


    evaluateKeyEscapeSequence(ev) {
      return escapeSequence(ev, this.applicationCursor, this.rows, this.isMac);
    }

    /**
     * Set the G level of the terminal
     * @param g
     */
    setgLevel(g) {
      this.glevel = g;
      this.charset = this.charsets[g];
    }

    /**
     * Set the charset for the given G level of the terminal
     * @param g
     * @param charset
     */
    setgCharset(g, charset) {
      this.charsets[g] = charset;
      if (this.glevel === g) {
        this.charset = charset;
      }
    }

    /**
     * Handle a keypress event.
     * Key Resources:
     *   - https://developer.mozilla.org/en-US/docs/DOM/KeyboardEvent
     * @param {KeyboardEvent} ev The keypress event to be handled.
     */
    keyPress(ev) {
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
        (ev.altKey || ev.ctrlKey || ev.metaKey) && !isThirdLevelShift(ev, this.isMac, this.isMSWindows)
      )) {
        return false;
      }

      key = String.fromCharCode(key);

      this.emit('keypress', key, ev);
      this.emit('key', key, ev);
      this.showCursor();
      this.handler(key);

      return false;
    }

    /**
     * Send data for handling to the terminal
     * @param {string} data
     */
    send(data) {
      var self = this;

      if (!this.queue) {
        setTimeout(function() {
          self.handler(self.queue);
          self.queue = '';
        }, 1);
      }

      this.queue += data;
    }

    /**
     * Ring the bell.
     * Note: We could do sweet things with webaudio here
     */
    bell() {
      if (!this.visualBell) return;
      var self = this;
      this.element.style.borderColor = 'white';
      setTimeout(function() {
        self.element.style.borderColor = '';
      }, 10);
      if (this.popOnBell) this.focus();
    }

    /**
     * Log the current state to the console.
     */
    log() {
      if (!this.debug) return;
      if (!this.context.console || !this.context.console.log) return;
      var args = Array.prototype.slice.call(arguments);
      this.context.console.log.apply(this.context.console, args);
    }

    /**
     * Log the current state as error to the console.
     */
    error() {
      if (!this.debug) return;
      if (!this.context.console || !this.context.console.error) return;
      var args = Array.prototype.slice.call(arguments);
      this.context.console.error.apply(this.context.console, args);
    }

    /**
     * Resizes the terminal.
     *
     * @param {number} x The number of columns to resize to.
     * @param {number} y The number of rows to resize to.
     */
    resize(x, y) {
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
          while (this.lines[i].length < x) {
            this.lines[i].push(ch);
          }
        }
      } else { // (j > x)
        i = this.lines.length;
        while (i--) {
          while (this.lines[i].length > x) {
            this.lines[i].pop();
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

      /*
      *  Make sure that the cursor stays on screen
      */
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

      this.refresh(0, this.rows - 1);

      this.normal = null;

      this.emit('resize', {terminal: this, cols: x, rows: y});
    }

    /**
     * Updates the range of rows to refresh
     * @param {number} y The number of rows to refresh next.
     */
    updateRange(y) {
      if (y < this.refreshStart) this.refreshStart = y;
      if (y > this.refreshEnd) this.refreshEnd = y;
      // if (y > this.refreshEnd) {
      //   this.refreshEnd = y;
      //   if (y > this.rows - 1) {
      //     this.refreshEnd = this.rows - 1;
      //   }
      // }
    }

    /**
     * Set the range of refreshing to the maximyum value
     */
    maxRange() {
      this.refreshStart = 0;
      this.refreshEnd = this.rows - 1;
    }



    /**
     * Setup the tab stops.
     * @param {number} i
     */
    setupStops(i) {
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
    }


    /**
     * Move the cursor to the previous tab stop from the given position (default is current).
     * @param {number} x The position to move the cursor to the previous tab stop.
     */
    prevStop(x) {
      if (x == null) x = this.x;
      while (!this.tabs[--x] && x > 0);
      return x >= this.cols
        ? this.cols - 1
        : x < 0 ? 0 : x;
    }


    /**
     * Move the cursor one tab stop forward from the given position (default is current).
     * @param {number} x The position to move the cursor one tab stop forward.
     */
    nextStop(x) {
      if (x == null) x = this.x;
      while (!this.tabs[++x] && x < this.cols);
      return x >= this.cols
        ? this.cols - 1
        : x < 0 ? 0 : x;
    }


    /**
     * Erase in the identified line everything from "x" to the end of the line (right).
     * @param {number} x The column from which to start erasing to the end of the line.
     * @param {number} y The line in which to operate.
     */
    eraseRight(x, y) {
      var line = this.lines[this.ybase + y]
        , ch = [this.eraseAttr(), ' ', 1]; // xterm


      for (; x < this.cols; x++) {
        line[x] = ch;
      }

      this.updateRange(y);
    }



    /**
     * Erase in the identified line everything from "x" to the start of the line (left).
     * @param {number} x The column from which to start erasing to the start of the line.
     * @param {number} y The line in which to operate.
     */
    eraseLeft(x, y) {
      var line = this.lines[this.ybase + y]
        , ch = [this.eraseAttr(), ' ', 1]; // xterm

      x++;
      while (x--) line[x] = ch;

      this.updateRange(y);
    }


    /**
     * Erase all content in the given line
     * @param {number} y The line to erase all of its contents.
     */
    eraseLine(y) {
      this.eraseRight(0, y);
    }


    /**
     * Return the data array of a blank line/
     * @param {number} cur First bunch of data for each "blank" character.
     */
    blankLine(cur) {
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
    }


    /**
     * If cur return the back color xterm feature attribute. Else return defAttr.
     * @param {object} cur
     */
    ch(cur) {
      return cur
        ? [this.eraseAttr(), ' ', 1]
        : [this.defAttr, ' ', 1];
    }


    /**
     * Evaluate if the current erminal is the given argument.
     * @param {object} term The terminal to evaluate
     */
    is(term) {
      var name = this.termName;
      return (name + '').indexOf(term) === 0;
    }


    /**
     * Emit the 'data' event and populate the given data.
     * @param {string} data The data to populate in the event.
     */
    handler(data) {
      this.emit('data', data);
    }


    /**
     * Emit the 'title' event and populate the given title.
     * @param {string} title The title to populate in the event.
     */
    handleTitle(title) {
      this.emit('title', title);
    }


    /**
     * ESC
     */

    /**
     * ESC D Index (IND is 0x84).
     */
    index() {
      this.y++;
      if (this.y > this.scrollBottom) {
        this.y--;
        this.scroll();
      }
      this.state = States.normal;
    }


    /**
     * ESC M Reverse Index (RI is 0x8d).
     */
    reverseIndex() {
      var j;
      this.y--;
      if (this.y < this.scrollTop) {
        this.y++;
        // possibly move the code below to term.reverseScroll();
        // test: echo -ne '\e[1;1H\e[44m\eM\e[0m'
        // blankLine(true) is xterm/linux behavior
        this.lines.splice(this.y + this.ybase, 0, this.blankLine(true));
        j = this.rows - 1 - this.scrollBottom;
        this.lines.splice(this.rows - 1 + this.ybase - j + 1, 1);
        // this.maxRange();
        this.updateRange(this.scrollTop);
        this.updateRange(this.scrollBottom);
      }
      this.state = States.normal;
    }


    /**
     * ESC c Full Reset (RIS).
     */
    reset() {
      this.options.rows = this.rows;
      this.options.cols = this.cols;
      this.options.document = this.document;

      var customKeydownHandler = this.customKeydownHandler;
      this.initialize.call(this, this.options);
      this.customKeydownHandler = customKeydownHandler;
      this.refresh(0, this.rows - 1);
    }


    /**
     * ESC H Tab Set (HTS is 0x88).
     */
    tabSet() {
      this.tabs[this.x] = true;
      this.state = States.normal;
    }


    /**
     * CSI
     */

    /**
     * CSI Ps A
     * Cursor Up Ps Times (default = 1) (CUU).
     */
    cursorUp(params) {
      var param = params[0];
      if (param < 1) param = 1;
      this.y -= param;
      if (this.y < 0) this.y = 0;
    }


    /**
     * CSI Ps B
     * Cursor Down Ps Times (default = 1) (CUD).
     */
    cursorDown(params) {
      var param = params[0];
      if (param < 1) param = 1;
      this.y += param;
      if (this.y >= this.rows) {
        this.y = this.rows - 1;
      }
    }


    /**
     * CSI Ps C
     * Cursor Forward Ps Times (default = 1) (CUF).
     */
    cursorForward(params) {
      var param = params[0];
      if (param < 1) param = 1;
      this.x += param;
      if (this.x >= this.cols) {
        this.x = this.cols - 1;
      }
    }


    /**
     * CSI Ps D
     * Cursor Backward Ps Times (default = 1) (CUB).
     */
    cursorBackward(params) {
      var param = params[0];
      if (param < 1) param = 1;
      this.x -= param;
      if (this.x < 0) this.x = 0;
    }


    /**
     * CSI Ps ; Ps H
     * Cursor Position [row;column] (default = [1,1]) (CUP).
     */
    cursorPos(params) {
      var row, col;

      row = params[0] - 1;

      if (params.length >= 2) {
        col = params[1] - 1;
      } else {
        col = 0;
      }

      if (row < 0) {
        row = 0;
      } else if (row >= this.rows) {
        row = this.rows - 1;
      }

      if (col < 0) {
        col = 0;
      } else if (col >= this.cols) {
        col = this.cols - 1;
      }

      this.x = col;
      this.y = row;
    }


    /**
     * CSI Ps J  Erase in Display (ED).
     *     Ps = 0  -> Erase Below (default).
     *     Ps = 1  -> Erase Above.
     *     Ps = 2  -> Erase All.
     *     Ps = 3  -> Erase Saved Lines (xterm).
     * CSI ? Ps J
     *   Erase in Display (DECSED).
     *     Ps = 0  -> Selective Erase Below (default).
     *     Ps = 1  -> Selective Erase Above.
     *     Ps = 2  -> Selective Erase All.
     */
    eraseInDisplay(params) {
      var j;
      switch (params[0]) {
        case 0:
          this.eraseRight(this.x, this.y);
          j = this.y + 1;
          for (; j < this.rows; j++) {
            this.eraseLine(j);
          }
          break;
        case 1:
          this.eraseLeft(this.x, this.y);
          j = this.y;
          while (j--) {
            this.eraseLine(j);
          }
          break;
        case 2:
          j = this.rows;
          while (j--) this.eraseLine(j);
          break;
        case 3:
          ; // no saved lines
          break;
      }
    }


    /**
     * CSI Ps K  Erase in Line (EL).
     *     Ps = 0  -> Erase to Right (default).
     *     Ps = 1  -> Erase to Left.
     *     Ps = 2  -> Erase All.
     * CSI ? Ps K
     *   Erase in Line (DECSEL).
     *     Ps = 0  -> Selective Erase to Right (default).
     *     Ps = 1  -> Selective Erase to Left.
     *     Ps = 2  -> Selective Erase All.
     */
    eraseInLine(params) {
      switch (params[0]) {
        case 0:
          this.eraseRight(this.x, this.y);
          break;
        case 1:
          this.eraseLeft(this.x, this.y);
          break;
        case 2:
          this.eraseLine(this.y);
          break;
      }
    }


   	/**
     * CSI Pm m  Character Attributes (SGR).
     *     Ps = 0  -> Normal (default).
     *     Ps = 1  -> Bold.
     *     Ps = 4  -> Underlined.
     *     Ps = 5  -> Blink (appears as Bold).
     *     Ps = 7  -> Inverse.
     *     Ps = 8  -> Invisible, i.e., hidden (VT300).
     *     Ps = 2 2  -> Normal (neither bold nor faint).
     *     Ps = 2 4  -> Not underlined.
     *     Ps = 2 5  -> Steady (not blinking).
     *     Ps = 2 7  -> Positive (not inverse).
     *     Ps = 2 8  -> Visible, i.e., not hidden (VT300).
     *     Ps = 3 0  -> Set foreground color to Black.
     *     Ps = 3 1  -> Set foreground color to Red.
     *     Ps = 3 2  -> Set foreground color to Green.
     *     Ps = 3 3  -> Set foreground color to Yellow.
     *     Ps = 3 4  -> Set foreground color to Blue.
     *     Ps = 3 5  -> Set foreground color to Magenta.
     *     Ps = 3 6  -> Set foreground color to Cyan.
     *     Ps = 3 7  -> Set foreground color to White.
     *     Ps = 3 9  -> Set foreground color to default (original).
     *     Ps = 4 0  -> Set background color to Black.
     *     Ps = 4 1  -> Set background color to Red.
     *     Ps = 4 2  -> Set background color to Green.
     *     Ps = 4 3  -> Set background color to Yellow.
     *     Ps = 4 4  -> Set background color to Blue.
     *     Ps = 4 5  -> Set background color to Magenta.
     *     Ps = 4 6  -> Set background color to Cyan.
     *     Ps = 4 7  -> Set background color to White.
     *     Ps = 4 9  -> Set background color to default (original).
		 *
     *   If 16-color support is compiled, the following apply.  Assume
     *   that xterm's resources are set so that the ISO color codes are
     *   the first 8 of a set of 16.  Then the aixterm colors are the
     *   bright versions of the ISO colors:
     *     Ps = 9 0  -> Set foreground color to Black.
     *     Ps = 9 1  -> Set foreground color to Red.
     *     Ps = 9 2  -> Set foreground color to Green.
     *     Ps = 9 3  -> Set foreground color to Yellow.
     *     Ps = 9 4  -> Set foreground color to Blue.
     *     Ps = 9 5  -> Set foreground color to Magenta.
     *     Ps = 9 6  -> Set foreground color to Cyan.
     *     Ps = 9 7  -> Set foreground color to White.
     *     Ps = 1 0 0  -> Set background color to Black.
     *     Ps = 1 0 1  -> Set background color to Red.
     *     Ps = 1 0 2  -> Set background color to Green.
     *     Ps = 1 0 3  -> Set background color to Yellow.
     *     Ps = 1 0 4  -> Set background color to Blue.
     *     Ps = 1 0 5  -> Set background color to Magenta.
     *     Ps = 1 0 6  -> Set background color to Cyan.
     *     Ps = 1 0 7  -> Set background color to White.
		 *
     *   If xterm is compiled with the 16-color support disabled, it
     *   supports the following, from rxvt:
     *     Ps = 1 0 0  -> Set foreground and background color to
     *     default.
		 *
     *   If 88- or 256-color support is compiled, the following apply.
     *     Ps = 3 8  ; 5  ; Ps -> Set foreground color to the second
     *     Ps.
     *     Ps = 4 8  ; 5  ; Ps -> Set background color to the second
     *     Ps.
     */
    charAttributes(params) {
      // Optimize a single SGR0.
      if (params.length === 1 && params[0] === 0) {
        this.curAttr = this.defAttr;
        return;
      }

      var l = params.length
        , i = 0
        , flags = this.curAttr >> 18
        , fg = (this.curAttr >> 9) & 0x1ff
        , bg = this.curAttr & 0x1ff
        , p;

      for (; i < l; i++) {
        p = params[i];
        if (p >= 30 && p <= 37) {
          // fg color 8
          fg = p - 30;
        } else if (p >= 40 && p <= 47) {
          // bg color 8
          bg = p - 40;
        } else if (p >= 90 && p <= 97) {
          // fg color 16
          p += 8;
          fg = p - 90;
        } else if (p >= 100 && p <= 107) {
          // bg color 16
          p += 8;
          bg = p - 100;
        } else if (p === 0) {
          // default
          flags = this.defAttr >> 18;
          fg = (this.defAttr >> 9) & 0x1ff;
          bg = this.defAttr & 0x1ff;
          // flags = 0;
          // fg = 0x1ff;
          // bg = 0x1ff;
        } else if (p === 1) {
          // bold text
          flags |= 1;
        } else if (p === 4) {
          // underlined text
          flags |= 2;
        } else if (p === 5) {
          // blink
          flags |= 4;
        } else if (p === 7) {
          // inverse and positive
          // test with: echo -e '\e[31m\e[42mhello\e[7mworld\e[27mhi\e[m'
          flags |= 8;
        } else if (p === 8) {
          // invisible
          flags |= 16;
        } else if (p === 22) {
          // not bold
          flags &= ~1;
        } else if (p === 24) {
          // not underlined
          flags &= ~2;
        } else if (p === 25) {
          // not blink
          flags &= ~4;
        } else if (p === 27) {
          // not inverse
          flags &= ~8;
        } else if (p === 28) {
          // not invisible
          flags &= ~16;
        } else if (p === 39) {
          // reset fg
          fg = (this.defAttr >> 9) & 0x1ff;
        } else if (p === 49) {
          // reset bg
          bg = this.defAttr & 0x1ff;
        } else if (p === 38) {
          // fg color 256
          if (params[i + 1] === 2) {
            i += 2;
            fg = matchColor(
              params[i] & 0xff,
              params[i + 1] & 0xff,
              params[i + 2] & 0xff);
            if (fg === -1) fg = 0x1ff;
            i += 2;
          } else if (params[i + 1] === 5) {
            i += 2;
            p = params[i] & 0xff;
            fg = p;
          }
        } else if (p === 48) {
          // bg color 256
          if (params[i + 1] === 2) {
            i += 2;
            bg = matchColor(
              params[i] & 0xff,
              params[i + 1] & 0xff,
              params[i + 2] & 0xff);
            if (bg === -1) bg = 0x1ff;
            i += 2;
          } else if (params[i + 1] === 5) {
            i += 2;
            p = params[i] & 0xff;
            bg = p;
          }
        } else if (p === 100) {
          // reset fg/bg
          fg = (this.defAttr >> 9) & 0x1ff;
          bg = this.defAttr & 0x1ff;
        } else {
          this.error('Unknown SGR attribute: %d.', p);
        }
      }

      this.curAttr = (flags << 18) | (fg << 9) | bg;
    }


   	/**
     * CSI Ps n  Device Status Report (DSR).
     *     Ps = 5  -> Status Report.  Result (``OK'') is
     *   CSI 0 n
     *     Ps = 6  -> Report Cursor Position (CPR) [row;column].
     *   Result is
     *   CSI r ; c R
     * CSI ? Ps n
     *   Device Status Report (DSR, DEC-specific).
     *     Ps = 6  -> Report Cursor Position (CPR) [row;column] as CSI
     *     ? r ; c R (assumes page is zero).
     *     Ps = 1 5  -> Report Printer status as CSI ? 1 0  n  (ready).
     *     or CSI ? 1 1  n  (not ready).
     *     Ps = 2 5  -> Report UDK status as CSI ? 2 0  n  (unlocked)
     *     or CSI ? 2 1  n  (locked).
     *     Ps = 2 6  -> Report Keyboard status as
     *   CSI ? 2 7  ;  1  ;  0  ;  0  n  (North American).
     *   The last two parameters apply to VT400 & up, and denote key-
     *   board ready and LK01 respectively.
     *     Ps = 5 3  -> Report Locator status as
     *   CSI ? 5 3  n  Locator available, if compiled-in, or
     *   CSI ? 5 0  n  No Locator, if not.
     */
    deviceStatus(params) {
      if (!this.prefix) {
        switch (params[0]) {
          case 5:
            // status report
            this.send('\x1b[0n');
            break;
          case 6:
            // cursor position
            this.send('\x1b['
              + (this.y + 1)
              + ';'
              + (this.x + 1)
              + 'R');
            break;
        }
      } else if (this.prefix === '?') {
        // modern xterm doesnt seem to
        // respond to any of these except ?6, 6, and 5
        switch (params[0]) {
          case 6:
            // cursor position
            this.send('\x1b[?'
              + (this.y + 1)
              + ';'
              + (this.x + 1)
              + 'R');
            break;
          case 15:
            // no printer
            // this.send('\x1b[?11n');
            break;
          case 25:
            // dont support user defined keys
            // this.send('\x1b[?21n');
            break;
          case 26:
            // north american keyboard
            // this.send('\x1b[?27;1;0;0n');
            break;
          case 53:
            // no dec locator/mouse
            // this.send('\x1b[?50n');
            break;
        }
      }
    }


    /**
     * Additions
     */

   	/**
     * CSI Ps @
     * Insert Ps (Blank) Character(s) (default = 1) (ICH).
     */
    insertChars(params) {
      var param, row, j, ch;

      param = params[0];
      if (param < 1) param = 1;

      row = this.y + this.ybase;
      j = this.x;
      ch = [this.eraseAttr(), ' ', 1]; // xterm

      while (param-- && j < this.cols) {
        this.lines[row].splice(j++, 0, ch);
        this.lines[row].pop();
      }
    }

   	/**
     * CSI Ps E
     * Cursor Next Line Ps Times (default = 1) (CNL).
     * same as CSI Ps B ?
     */
    cursorNextLine(params) {
      var param = params[0];
      if (param < 1) param = 1;
      this.y += param;
      if (this.y >= this.rows) {
        this.y = this.rows - 1;
      }
      this.x = 0;
    }


    /**
     * CSI Ps F
     * Cursor Preceding Line Ps Times (default = 1) (CNL).
     * reuse CSI Ps A ?
     */
    cursorPrecedingLine(params) {
      var param = params[0];
      if (param < 1) param = 1;
      this.y -= param;
      if (this.y < 0) this.y = 0;
      this.x = 0;
    }


    /**
     * CSI Ps G
     * Cursor Character Absolute  [column] (default = [row,1]) (CHA).
     */
    cursorCharAbsolute(params) {
      var param = params[0];
      if (param < 1) param = 1;
      this.x = param - 1;
    }


    /**
     * CSI Ps L
     * Insert Ps Line(s) (default = 1) (IL).
     */
    insertLines(params) {
      var param, row, j;

      param = params[0];
      if (param < 1) param = 1;
      row = this.y + this.ybase;

      j = this.rows - 1 - this.scrollBottom;
      j = this.rows - 1 + this.ybase - j + 1;

      while (param--) {
        // test: echo -e '\e[44m\e[1L\e[0m'
        // blankLine(true) - xterm/linux behavior
        this.lines.splice(row, 0, this.blankLine(true));
        this.lines.splice(j, 1);
      }

      // this.maxRange();
      this.updateRange(this.y);
      this.updateRange(this.scrollBottom);
    }


    /**
     * CSI Ps M
     * Delete Ps Line(s) (default = 1) (DL).
     */
    deleteLines(params) {
      var param, row, j;

      param = params[0];
      if (param < 1) param = 1;
      row = this.y + this.ybase;

      j = this.rows - 1 - this.scrollBottom;
      j = this.rows - 1 + this.ybase - j;

      while (param--) {
        // test: echo -e '\e[44m\e[1M\e[0m'
        // blankLine(true) - xterm/linux behavior
        this.lines.splice(j + 1, 0, this.blankLine(true));
        this.lines.splice(row, 1);
      }

      // this.maxRange();
      this.updateRange(this.y);
      this.updateRange(this.scrollBottom);
    }


    /**
     * CSI Ps P
     * Delete Ps Character(s) (default = 1) (DCH).
     */
    deleteChars(params) {
      var param, row, ch;

      param = params[0];
      if (param < 1) param = 1;

      row = this.y + this.ybase;
      ch = [this.eraseAttr(), ' ', 1]; // xterm

      while (param--) {
        this.lines[row].splice(this.x, 1);
        this.lines[row].push(ch);
      }
    }

    /**
     * CSI Ps X
     * Erase Ps Character(s) (default = 1) (ECH).
     */
    eraseChars(params) {
      var param, row, j, ch;

      param = params[0];
      if (param < 1) param = 1;

      row = this.y + this.ybase;
      j = this.x;
      ch = [this.eraseAttr(), ' ', 1]; // xterm

      while (param-- && j < this.cols) {
        this.lines[row][j++] = ch;
      }
    }

    /**
     * CSI Pm `  Character Position Absolute
     *   [column] (default = [row,1]) (HPA).
     */
    charPosAbsolute(params) {
      var param = params[0];
      if (param < 1) param = 1;
      this.x = param - 1;
      if (this.x >= this.cols) {
        this.x = this.cols - 1;
      }
    }


    /**
     * 141 61 a * HPR -
     * Horizontal Position Relative
     * reuse CSI Ps C ?
     */
    HPositionRelative(params) {
      var param = params[0];
      if (param < 1) param = 1;
      this.x += param;
      if (this.x >= this.cols) {
        this.x = this.cols - 1;
      }
    }


    /**
     * CSI Ps c  Send Device Attributes (Primary DA).
     *     Ps = 0  or omitted -> request attributes from terminal.  The
     *     response depends on the decTerminalID resource setting.
     *     -> CSI ? 1 ; 2 c  (``VT100 with Advanced Video Option'')
     *     -> CSI ? 1 ; 0 c  (``VT101 with No Options'')
     *     -> CSI ? 6 c  (``VT102'')
     *     -> CSI ? 6 0 ; 1 ; 2 ; 6 ; 8 ; 9 ; 1 5 ; c  (``VT220'')
     *   The VT100-style response parameters do not mean anything by
     *   themselves.  VT220 parameters do, telling the host what fea-
     *   tures the terminal supports:
     *     Ps = 1  -> 132-columns.
     *     Ps = 2  -> Printer.
     *     Ps = 6  -> Selective erase.
     *     Ps = 8  -> User-defined keys.
     *     Ps = 9  -> National replacement character sets.
     *     Ps = 1 5  -> Technical characters.
     *     Ps = 2 2  -> ANSI color, e.g., VT525.
     *     Ps = 2 9  -> ANSI text locator (i.e., DEC Locator mode).
     * CSI > Ps c
     *   Send Device Attributes (Secondary DA).
     *     Ps = 0  or omitted -> request the terminal's identification
     *     code.  The response depends on the decTerminalID resource set-
     *     ting.  It should apply only to VT220 and up, but xterm extends
     *     this to VT100.
     *     -> CSI  > Pp ; Pv ; Pc c
     *   where Pp denotes the terminal type
     *     Pp = 0  -> ``VT100''.
     *     Pp = 1  -> ``VT220''.
     *   and Pv is the firmware version (for xterm, this was originally
     *   the XFree86 patch number, starting with 95).  In a DEC termi-
     *   nal, Pc indicates the ROM cartridge registration number and is
     *   always zero.
     * More information:
     *   xterm/charproc.c - line 2012, for more information.
     *   vim responds with ^[[?0c or ^[[?1c after the terminal's response (?)
		 */
    sendDeviceAttributes(params) {
      if (params[0] > 0) return;

      if (!this.prefix) {
        if (this.is('xterm')
            || this.is('rxvt-unicode')
            || this.is('screen')) {
          this.send('\x1b[?1;2c');
        } else if (this.is('linux')) {
          this.send('\x1b[?6c');
        }
      } else if (this.prefix === '>') {
        // xterm and urxvt
        // seem to spit this
        // out around ~370 times (?).
        if (this.is('xterm')) {
          this.send('\x1b[>0;276;0c');
        } else if (this.is('rxvt-unicode')) {
          this.send('\x1b[>85;95;0c');
        } else if (this.is('linux')) {
          // not supported by linux console.
          // linux console echoes parameters.
          this.send(params[0] + 'c');
        } else if (this.is('screen')) {
          this.send('\x1b[>83;40003;0c');
        }
      }
    }


    /**
     * CSI Pm d
     * Line Position Absolute  [row] (default = [1,column]) (VPA).
     */
    linePosAbsolute(params) {
      var param = params[0];
      if (param < 1) param = 1;
      this.y = param - 1;
      if (this.y >= this.rows) {
        this.y = this.rows - 1;
      }
    }


    /**
     * 145 65 e * VPR - Vertical Position Relative
     * reuse CSI Ps B ?
     */
    VPositionRelative(params) {
      var param = params[0];
      if (param < 1) param = 1;
      this.y += param;
      if (this.y >= this.rows) {
        this.y = this.rows - 1;
      }
    }


    /**
     * CSI Ps ; Ps f
     *   Horizontal and Vertical Position [row;column] (default =
     *   [1,1]) (HVP).
     */
    HVPosition(params) {
      if (params[0] < 1) params[0] = 1;
      if (params[1] < 1) params[1] = 1;

      this.y = params[0] - 1;
      if (this.y >= this.rows) {
        this.y = this.rows - 1;
      }

      this.x = params[1] - 1;
      if (this.x >= this.cols) {
        this.x = this.cols - 1;
      }
    }


    /**
     * CSI Pm h  Set Mode (SM).
     *     Ps = 2  -> Keyboard Action Mode (AM).
     *     Ps = 4  -> Insert Mode (IRM).
     *     Ps = 1 2  -> Send/receive (SRM).
     *     Ps = 2 0  -> Automatic Newline (LNM).
     * CSI ? Pm h
     *   DEC Private Mode Set (DECSET).
     *     Ps = 1  -> Application Cursor Keys (DECCKM).
     *     Ps = 2  -> Designate USASCII for character sets G0-G3
     *     (DECANM), and set VT100 mode.
     *     Ps = 3  -> 132 Column Mode (DECCOLM).
     *     Ps = 4  -> Smooth (Slow) Scroll (DECSCLM).
     *     Ps = 5  -> Reverse Video (DECSCNM).
     *     Ps = 6  -> Origin Mode (DECOM).
     *     Ps = 7  -> Wraparound Mode (DECAWM).
     *     Ps = 8  -> Auto-repeat Keys (DECARM).
     *     Ps = 9  -> Send Mouse X & Y on button press.  See the sec-
     *     tion Mouse Tracking.
     *     Ps = 1 0  -> Show toolbar (rxvt).
     *     Ps = 1 2  -> Start Blinking Cursor (att610).
     *     Ps = 1 8  -> Print form feed (DECPFF).
     *     Ps = 1 9  -> Set print extent to full screen (DECPEX).
     *     Ps = 2 5  -> Show Cursor (DECTCEM).
     *     Ps = 3 0  -> Show scrollbar (rxvt).
     *     Ps = 3 5  -> Enable font-shifting functions (rxvt).
     *     Ps = 3 8  -> Enter Tektronix Mode (DECTEK).
     *     Ps = 4 0  -> Allow 80 -> 132 Mode.
     *     Ps = 4 1  -> more(1) fix (see curses resource).
     *     Ps = 4 2  -> Enable Nation Replacement Character sets (DECN-
     *     RCM).
     *     Ps = 4 4  -> Turn On Margin Bell.
     *     Ps = 4 5  -> Reverse-wraparound Mode.
     *     Ps = 4 6  -> Start Logging.  This is normally disabled by a
     *     compile-time option.
     *     Ps = 4 7  -> Use Alternate Screen Buffer.  (This may be dis-
     *     abled by the titeInhibit resource).
     *     Ps = 6 6  -> Application keypad (DECNKM).
     *     Ps = 6 7  -> Backarrow key sends backspace (DECBKM).
     *     Ps = 1 0 0 0  -> Send Mouse X & Y on button press and
     *     release.  See the section Mouse Tracking.
     *     Ps = 1 0 0 1  -> Use Hilite Mouse Tracking.
     *     Ps = 1 0 0 2  -> Use Cell Motion Mouse Tracking.
     *     Ps = 1 0 0 3  -> Use All Motion Mouse Tracking.
     *     Ps = 1 0 0 4  -> Send FocusIn/FocusOut events.
     *     Ps = 1 0 0 5  -> Enable Extended Mouse Mode.
     *     Ps = 1 0 1 0  -> Scroll to bottom on tty output (rxvt).
     *     Ps = 1 0 1 1  -> Scroll to bottom on key press (rxvt).
     *     Ps = 1 0 3 4  -> Interpret "meta" key, sets eighth bit.
     *     (enables the eightBitInput resource).
     *     Ps = 1 0 3 5  -> Enable special modifiers for Alt and Num-
     *     Lock keys.  (This enables the numLock resource).
     *     Ps = 1 0 3 6  -> Send ESC   when Meta modifies a key.  (This
     *     enables the metaSendsEscape resource).
     *     Ps = 1 0 3 7  -> Send DEL from the editing-keypad Delete
     *     key.
     *     Ps = 1 0 3 9  -> Send ESC  when Alt modifies a key.  (This
     *     enables the altSendsEscape resource).
     *     Ps = 1 0 4 0  -> Keep selection even if not highlighted.
     *     (This enables the keepSelection resource).
     *     Ps = 1 0 4 1  -> Use the CLIPBOARD selection.  (This enables
     *     the selectToClipboard resource).
     *     Ps = 1 0 4 2  -> Enable Urgency window manager hint when
     *     Control-G is received.  (This enables the bellIsUrgent
     *     resource).
     *     Ps = 1 0 4 3  -> Enable raising of the window when Control-G
     *     is received.  (enables the popOnBell resource).
     *     Ps = 1 0 4 7  -> Use Alternate Screen Buffer.  (This may be
     *     disabled by the titeInhibit resource).
     *     Ps = 1 0 4 8  -> Save cursor as in DECSC.  (This may be dis-
     *     abled by the titeInhibit resource).
     *     Ps = 1 0 4 9  -> Save cursor as in DECSC and use Alternate
     *     Screen Buffer, clearing it first.  (This may be disabled by
     *     the titeInhibit resource).  This combines the effects of the 1
     *     0 4 7  and 1 0 4 8  modes.  Use this with terminfo-based
     *     applications rather than the 4 7  mode.
     *     Ps = 1 0 5 0  -> Set terminfo/termcap function-key mode.
     *     Ps = 1 0 5 1  -> Set Sun function-key mode.
     *     Ps = 1 0 5 2  -> Set HP function-key mode.
     *     Ps = 1 0 5 3  -> Set SCO function-key mode.
     *     Ps = 1 0 6 0  -> Set legacy keyboard emulation (X11R6).
     *     Ps = 1 0 6 1  -> Set VT220 keyboard emulation.
     *     Ps = 2 0 0 4  -> Set bracketed paste mode.
     * Modes:
     *   http: *vt100.net/docs/vt220-rm/chapter4.html
     */
    setMode(params) {
      if (typeof params === 'object') {
        var l = params.length
          , i = 0;

        for (; i < l; i++) {
          this.setMode(params[i]);
        }

        return;
      }

      if (!this.prefix) {
        switch (params) {
          case 4:
            this.insertMode = true;
            break;
          case 20:
            //this.convertEol = true;
            break;
        }
      } else if (this.prefix === '?') {
        switch (params) {
          case 1:
            this.applicationCursor = true;
            break;
          case 2:
            this.setgCharset(0, Terminal.charsets.US);
            this.setgCharset(1, Terminal.charsets.US);
            this.setgCharset(2, Terminal.charsets.US);
            this.setgCharset(3, Terminal.charsets.US);
            // set VT100 mode here
            break;
          case 3: // 132 col mode
            this.savedCols = this.cols;
            this.resize(132, this.rows);
            break;
          case 6:
            this.originMode = true;
            break;
          case 7:
            this.wraparoundMode = true;
            break;
          case 12:
            // this.cursorBlink = true;
            break;
          case 66:
            this.log('Serial port requested application keypad.');
            this.applicationKeypad = true;
            this.viewport.setApplicationMode(true);
            break;
          case 9: // X10 Mouse
            // no release, no motion, no wheel, no modifiers.
          case 1000: // vt200 mouse
            // no motion.
            // no modifiers, except control on the wheel.
          case 1002: // button event mouse
          case 1003: // any event mouse
            // any event - sends motion events,
            // even if there is no button held down.
            this.x10Mouse = params === 9;
            this.vt200Mouse = params === 1000;
            this.normalMouse = params > 1000;
            this.mouseEvents = true;
            this.element.style.cursor = 'default';
            this.log('Binding to mouse events.');
            break;
          case 1004: // send focusin/focusout events
            // focusin: ^[[I
            // focusout: ^[[O
            this.sendFocus = true;
            break;
          case 1005: // utf8 ext mode mouse
            this.utfMouse = true;
            // for wide terminals
            // simply encodes large values as utf8 characters
            break;
          case 1006: // sgr ext mode mouse
            this.sgrMouse = true;
            // for wide terminals
            // does not add 32 to fields
            // press: ^[[<b;x;yM
            // release: ^[[<b;x;ym
            break;
          case 1015: // urxvt ext mode mouse
            this.urxvtMouse = true;
            // for wide terminals
            // numbers for fields
            // press: ^[[b;x;yM
            // motion: ^[[b;x;yT
            break;
          case 25: // show cursor
            this.cursorHidden = false;
            break;
          case 1049: // alt screen buffer cursor
            //this.saveCursor();
            ; // FALL-THROUGH
          case 47: // alt screen buffer
          case 1047: // alt screen buffer
            if (!this.normal) {
              var normal = {
                lines: this.lines,
                ybase: this.ybase,
                ydisp: this.ydisp,
                x: this.x,
                y: this.y,
                scrollTop: this.scrollTop,
                scrollBottom: this.scrollBottom,
                tabs: this.tabs
                // XXX save charset(s) here?
                // charset: this.charset,
                // glevel: this.glevel,
                // charsets: this.charsets
              };
              this.reset();
              this.normal = normal;
              this.showCursor();
            }
            break;
        }
      }
    }

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
    resetMode(params) {
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
            this.viewport.setApplicationMode(false);
            this.applicationKeypad = false;
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
              this.refresh(0, this.rows - 1);
              this.showCursor();
            }
            break;
        }
      }
    }


    /**
     * CSI Ps ; Ps r
     *   Set Scrolling Region [top;bottom] (default = full size of win-
     *   dow) (DECSTBM).
     * CSI ? Pm r
     */
    setScrollRegion(params) {
      if (this.prefix) return;
      this.scrollTop = (params[0] || 1) - 1;
      this.scrollBottom = (params[1] || this.rows) - 1;
      this.x = 0;
      this.y = 0;
    }


    /**
     * CSI s
     *   Save cursor (ANSI.SYS).
     */
    saveCursor(params) {
      this.savedX = this.x;
      this.savedY = this.y;
    }


    /**
     * CSI u
     *   Restore cursor (ANSI.SYS).
     */
    restoreCursor(params) {
      this.x = this.savedX || 0;
      this.y = this.savedY || 0;
    }


    /**
     * Lesser Used
     */

    /**
     * CSI Ps I
     *   Cursor Forward Tabulation Ps tab stops (default = 1) (CHT).
     */
    cursorForwardTab(params) {
      var param = params[0] || 1;
      while (param--) {
        this.x = this.nextStop();
      }
    }


    /**
     * CSI Ps S  Scroll up Ps lines (default = 1) (SU).
     */
    scrollUp(params) {
      var param = params[0] || 1;
      while (param--) {
        this.lines.splice(this.ybase + this.scrollTop, 1);
        this.lines.splice(this.ybase + this.scrollBottom, 0, this.blankLine());
      }
      // this.maxRange();
      this.updateRange(this.scrollTop);
      this.updateRange(this.scrollBottom);
    }


    /**
     * CSI Ps T  Scroll down Ps lines (default = 1) (SD).
     */
    scrollDown(params) {
      var param = params[0] || 1;
      while (param--) {
        this.lines.splice(this.ybase + this.scrollBottom, 1);
        this.lines.splice(this.ybase + this.scrollTop, 0, this.blankLine());
      }
      // this.maxRange();
      this.updateRange(this.scrollTop);
      this.updateRange(this.scrollBottom);
    }


    /**
     * CSI Ps ; Ps ; Ps ; Ps ; Ps T
     *   Initiate highlight mouse tracking.  Parameters are
     *   [func;startx;starty;firstrow;lastrow].  See the section Mouse
     *   Tracking.
     */
    initMouseTracking(params) {
      // Relevant: DECSET 1001
    }


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
    resetTitleModes(params) {
      ;
    }


    /**
     * CSI Ps Z  Cursor Backward Tabulation Ps tab stops (default = 1) (CBT).
     */
    cursorBackwardTab(params) {
      var param = params[0] || 1;
      while (param--) {
        this.x = this.prevStop();
      }
    }


    /**
     * CSI Ps b  Repeat the preceding graphic character Ps times (REP).
     */
    repeatPrecedingCharacter(params) {
      var param = params[0] || 1
        , line = this.lines[this.ybase + this.y]
        , ch = line[this.x - 1] || [this.defAttr, ' ', 1];

      while (param--) line[this.x++] = ch;
    }


    /**
     * CSI Ps g  Tab Clear (TBC).
     *     Ps = 0  -> Clear Current Column (default).
     *     Ps = 3  -> Clear All.
     * Potentially:
     *   Ps = 2  -> Clear Stops on Line.
     *   http://vt100.net/annarbor/aaa-ug/section6.html
     */
    tabClear(params) {
      var param = params[0];
      if (param <= 0) {
        delete this.tabs[this.x];
      } else if (param === 3) {
        this.tabs = {};
      }
    }


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
    mediaCopy(params) {
      ;
    }


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
    setResources(params) {
      ;
    }


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
    disableModifiers(params) {
      ;
    }


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
    setPointerMode(params) {
      ;
    }


		/**
     * CSI ! p   Soft terminal reset (DECSTR).
     * http://vt100.net/docs/vt220-rm/table4-10.html
     */
    softReset(params) {
      this.cursorHidden = false;
      this.insertMode = false;
      this.originMode = false;
      this.wraparoundMode = false; // autowrap
      this.applicationKeypad = false; // ?
      this.applicationCursor = false;
      this.scrollTop = 0;
      this.scrollBottom = this.rows - 1;
      this.curAttr = this.defAttr;
      this.x = this.y = 0; // ?
      this.charset = null;
      this.glevel = 0; // ??
      this.charsets = [null]; // ??
    }


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
    requestAnsiMode(params) {
      ;
    }


    /**
     * CSI ? Ps$ p
     *   Request DEC private mode (DECRQM).  For VT300 and up, reply is
     *     CSI ? Ps; Pm$ p
     *   where Ps is the mode number as in DECSET, Pm is the mode value
     *   as in the ANSI DECRQM.
     */
    requestPrivateMode(params) {
      ;
    }


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
    setConformanceLevel(params) {
      ;
    }


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
    loadLEDs(params) {
      ;
    }


    /**
     * CSI Ps SP q
     *   Set cursor style (DECSCUSR, VT520).
     *     Ps = 0  -> blinking block.
     *     Ps = 1  -> blinking block (default).
     *     Ps = 2  -> steady block.
     *     Ps = 3  -> blinking underline.
     *     Ps = 4  -> steady underline.
     */
    setCursorStyle(params) {
      ;
    }


    /**
     * CSI Ps " q
     *   Select character protection attribute (DECSCA).  Valid values
     *   for the parameter:
     *     Ps = 0  -> DECSED and DECSEL can erase (default).
     *     Ps = 1  -> DECSED and DECSEL cannot erase.
     *     Ps = 2  -> DECSED and DECSEL can erase.
     */
    setCharProtectionAttr(params) {
      ;
    }


    /**
     * CSI ? Pm r
     *   Restore DEC Private Mode Values.  The value of Ps previously
     *   saved is restored.  Ps values are the same as for DECSET.
     */
    restorePrivateValues(params) {
      ;
    }


    /**
     * CSI Pt; Pl; Pb; Pr; Ps$ r
     *   Change Attributes in Rectangular Area (DECCARA), VT400 and up.
     *     Pt; Pl; Pb; Pr denotes the rectangle.
     *     Ps denotes the SGR attributes to change: 0, 1, 4, 5, 7.
     * NOTE: xterm doesn't enable this code by default.
     */
    setAttrInRectangle(params) {
      var t = params[0]
        , l = params[1]
        , b = params[2]
        , r = params[3]
        , attr = params[4];

      var line
        , i;

      for (; t < b + 1; t++) {
        line = this.lines[this.ybase + t];
        for (i = l; i < r; i++) {
          line[i] = [attr, line[i][1]];
        }
      }

      // this.maxRange();
      this.updateRange(params[0]);
      this.updateRange(params[2]);
    }


    /**
     * CSI Pc; Pt; Pl; Pb; Pr$ x
     *   Fill Rectangular Area (DECFRA), VT420 and up.
     *     Pc is the character to use.
     *     Pt; Pl; Pb; Pr denotes the rectangle.
     * NOTE: xterm doesn't enable this code by default.
     */
    fillRectangle(params) {
      var ch = params[0]
        , t = params[1]
        , l = params[2]
        , b = params[3]
        , r = params[4];

      var line
        , i;

      for (; t < b + 1; t++) {
        line = this.lines[this.ybase + t];
        for (i = l; i < r; i++) {
          line[i] = [line[i][0], String.fromCharCode(ch)];
        }
      }

      // this.maxRange();
      this.updateRange(params[1]);
      this.updateRange(params[3]);
    }


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
    enableLocatorReporting(params) {
      var val = params[0] > 0;
      //this.mouseEvents = val;
      //this.decLocator = val;
    }


    /**
     * CSI Pt; Pl; Pb; Pr$ z
     *   Erase Rectangular Area (DECERA), VT400 and up.
     *     Pt; Pl; Pb; Pr denotes the rectangle.
     * NOTE: xterm doesn't enable this code by default.
     */
    eraseRectangle(params) {
      var t = params[0]
        , l = params[1]
        , b = params[2]
        , r = params[3];

      var line
        , i
        , ch;

      ch = [this.eraseAttr(), ' ', 1]; // xterm?

      for (; t < b + 1; t++) {
        line = this.lines[this.ybase + t];
        for (i = l; i < r; i++) {
          line[i] = ch;
        }
      }

      // this.maxRange();
      this.updateRange(params[0]);
      this.updateRange(params[2]);
    }


    /**
     * CSI P m SP }
     * Insert P s Column(s) (default = 1) (DECIC), VT420 and up.
     * NOTE: xterm doesn't enable this code by default.
     */
    insertColumns() {
      var param = params[0]
        , l = this.ybase + this.rows
        , ch = [this.eraseAttr(), ' ', 1] // xterm?
        , i;

      while (param--) {
        for (i = this.ybase; i < l; i++) {
          this.lines[i].splice(this.x + 1, 0, ch);
          this.lines[i].pop();
        }
      }

      this.maxRange();
    }

    cancel(ev, force) {
      if (!this.cancelEvents && !force) {
        return;
      }
      ev.preventDefault();
      ev.stopPropagation();
      return false;
    }


    /**
     * CSI P m SP ~
     * Delete P s Column(s) (default = 1) (DECDC), VT420 and up
     * NOTE: xterm doesn't enable this code by default.
     */
    deleteColumns() {
      var param = params[0]
        , l = this.ybase + this.rows
        , ch = [this.eraseAttr(), ' ', 1] // xterm?
        , i;

      while (param--) {
        for (i = this.ybase; i < l; i++) {
          this.lines[i].splice(this.x, 1);
          this.lines[i].push(ch);
        }
      }

      this.maxRange();
    }



  }; //end of class



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
      cancelEvents: false
      // programFeatures: false,
      // focusKeys: false,
    };

    Terminal.options = {};

    Terminal.focus = null;

    Object.keys(Terminal.defaults).forEach(function(key) {
      Terminal[key] = Terminal.defaults[key];
      Terminal.options[key] = Terminal.defaults[key];
    });



    /**
     * Character Sets
     */

    Terminal.charsets = {};

    // DEC Special Character and Line Drawing Set.
    // http://vt100.net/docs/vt102-ug/table5-13.html
    // A lot of curses apps use this if they see TERM=xterm.
    // testing: echo -e '\e(0a\e(B'
    // The xterm output sometimes seems to conflict with the
    // reference above. xterm seems in line with the reference
    // when running vttest however.
    // The table below now uses xterm's output from vttest.
    Terminal.charsets.SCLD = { // (0
      '`': '\u25c6', // '◆'
      'a': '\u2592', // '▒'
      'b': '\u0009', // '\t'
      'c': '\u000c', // '\f'
      'd': '\u000d', // '\r'
      'e': '\u000a', // '\n'
      'f': '\u00b0', // '°'
      'g': '\u00b1', // '±'
      'h': '\u2424', // '\u2424' (NL)
      'i': '\u000b', // '\v'
      'j': '\u2518', // '┘'
      'k': '\u2510', // '┐'
      'l': '\u250c', // '┌'
      'm': '\u2514', // '└'
      'n': '\u253c', // '┼'
      'o': '\u23ba', // '⎺'
      'p': '\u23bb', // '⎻'
      'q': '\u2500', // '─'
      'r': '\u23bc', // '⎼'
      's': '\u23bd', // '⎽'
      't': '\u251c', // '├'
      'u': '\u2524', // '┤'
      'v': '\u2534', // '┴'
      'w': '\u252c', // '┬'
      'x': '\u2502', // '│'
      'y': '\u2264', // '≤'
      'z': '\u2265', // '≥'
      '{': '\u03c0', // 'π'
      '|': '\u2260', // '≠'
      '}': '\u00a3', // '£'
      '~': '\u00b7'  // '·'
    };

    Terminal.charsets.UK = null; // (A
    Terminal.charsets.US = null; // (B (USASCII)
    Terminal.charsets.Dutch = null; // (4
    Terminal.charsets.Finnish = null; // (C or (5
    Terminal.charsets.French = null; // (R
    Terminal.charsets.FrenchCanadian = null; // (Q
    Terminal.charsets.German = null; // (K
    Terminal.charsets.Italian = null; // (Y
    Terminal.charsets.NorwegianDanish = null; // (E or (6
    Terminal.charsets.Spanish = null; // (Z
    Terminal.charsets.Swedish = null; // (H or (7
    Terminal.charsets.Swiss = null; // (=
    Terminal.charsets.ISOLatin = null; // /A



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

module.exports = Terminal;
