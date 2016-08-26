"use strict";

/**
* Returns an object that determines how a KeyboardEvent should be handled. The key of the
* returned value is the new key code to pass to the PTY.
*
* Reference: http://invisible-island.net/xterm/ctlseqs/ctlseqs.html
* @param {KeyboardEvent} ev The keyboard event to be translated to key escape sequence.
* @param {boolean} applicationCursor 
* @param {int} rows terminal rows
* @param {boolean} isMac 
*/
module.exports = function(ev, applicationCursor, rows, isMac) {
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
    // backspace
    case 8:
      if (ev.shiftKey) {
        result.key = '\x08'; // ^H
        break;
      }
      result.key = '\x7f'; // ^?
      break;
    // tab
    case 9:
      if (ev.shiftKey) {
        result.key = '\x1b[Z';
        break;
      }
      result.key = '\t';
      result.cancel = true;
      break;
    // return/enter
    case 13:
      result.key = '\r';
      result.cancel = true;
      break;
    // escape
    case 27:
      result.key = '\x1b';
      result.cancel = true;
      break;
    // left-arrow
    case 37:
      if (modifiers) {
        result.key = '\x1b[1;' + (modifiers + 1) + 'D';
        // HACK: Make Alt + left-arrow behave like Ctrl + left-arrow: move one word backwards
        // http://unix.stackexchange.com/a/108106
        if (result.key == '\x1b[1;3D') {
          result.key = '\x1b[1;5D';
        }
      } else if (applicationCursor) {
        result.key = '\x1bOD';
      } else {
        result.key = '\x1b[D';
      }
      break;
    // right-arrow
    case 39:
      if (modifiers) {
        result.key = '\x1b[1;' + (modifiers + 1) + 'C';
        // HACK: Make Alt + right-arrow behave like Ctrl + right-arrow: move one word forward
        // http://unix.stackexchange.com/a/108106
        if (result.key == '\x1b[1;3C') {
          result.key = '\x1b[1;5C';
        }
      } else if (applicationCursor) {
        result.key = '\x1bOC';
      } else {
        result.key = '\x1b[C';
      }
      break;
    // up-arrow
    case 38:
      if (modifiers) {
        result.key = '\x1b[1;' + (modifiers + 1) + 'A';
        // HACK: Make Alt + up-arrow behave like Ctrl + up-arrow
        // http://unix.stackexchange.com/a/108106
        if (result.key == '\x1b[1;3A') {
          result.key = '\x1b[1;5A';
        }
      } else if (applicationCursor) {
        result.key = '\x1bOA';
      } else {
        result.key = '\x1b[A';
      }
      break;
    // down-arrow
    case 40:
      if (modifiers) {
        result.key = '\x1b[1;' + (modifiers + 1) + 'B';
        // HACK: Make Alt + down-arrow behave like Ctrl + down-arrow
        // http://unix.stackexchange.com/a/108106
        if (result.key == '\x1b[1;3B') {
          result.key = '\x1b[1;5B';
        }
      } else if (applicationCursor) {
        result.key = '\x1bOB';
      } else {
        result.key = '\x1b[B';
      }
      break;
    // insert
    case 45:
      if (!ev.shiftKey && !ev.ctrlKey) {
        // <Ctrl> or <Shift> + <Insert> are used to
        // copy-paste on some systems.
        result.key = '\x1b[2~';
      }
      break;
    // delete
    case 46: result.key = '\x1b[3~'; break;
    // home
    case 36:
      if (modifiers)
        result.key = '\x1b[1;' + (modifiers + 1) + 'H';
      else if (applicationCursor)
        result.key = '\x1bOH';
      else
        result.key = '\x1b[H';
      break;
    // end
    case 35:
      if (modifiers)
        result.key = '\x1b[1;' + (modifiers + 1) + 'F';
      else if (applicationCursor)
        result.key = '\x1bOF';
      else
        result.key = '\x1b[F';
      break;
    // page up
    case 33:
      if (ev.shiftKey) {
        result.scrollDisp = -(rows - 1);
      } else {
        result.key = '\x1b[5~';
      }
      break;
    // page down
    case 34:
      if (ev.shiftKey) {
        result.scrollDisp = rows - 1;
      } else {
        result.key = '\x1b[6~';
      }
      break;
    // F1-F12
    case 112: result.key = '\x1bOP'; break;
    case 113: result.key = '\x1bOQ'; break;
    case 114: result.key = '\x1bOR'; break;
    case 115: result.key = '\x1bOS'; break;
    case 116: result.key = '\x1b[15~'; break;
    case 117: result.key = '\x1b[17~'; break;
    case 118: result.key = '\x1b[18~'; break;
    case 119: result.key = '\x1b[19~'; break;
    case 120: result.key = '\x1b[20~'; break;
    case 121: result.key = '\x1b[21~'; break;
    case 122: result.key = '\x1b[23~'; break;
    case 123: result.key = '\x1b[24~'; break;
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
      } else if (!isMac && ev.altKey && !ev.ctrlKey && !ev.metaKey) {
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

