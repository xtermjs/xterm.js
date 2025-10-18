/**
 * Copyright (c) 2014 The xterm.js authors. All rights reserved.
 * Copyright (c) 2012-2013, Christopher Jeffrey (MIT License)
 * @license MIT
 */

import { IKeyboardEvent, IKeyboardResult, KeyboardResultType } from 'common/Types';
import { C0 } from 'common/data/EscapeSequences';

// Kitty keyboard protocol functional key codes (Unicode Private Use Area)
const KITTY_FUNCTIONAL_KEYS: { [key: string]: number } = {
  // F13-F35 keys
  'F13': 57376, 'F14': 57377, 'F15': 57378, 'F16': 57379,
  'F17': 57380, 'F18': 57381, 'F19': 57382, 'F20': 57383,
  'F21': 57384, 'F22': 57385, 'F23': 57386, 'F24': 57387,
  'F25': 57388, 'F26': 57389, 'F27': 57390, 'F28': 57391,
  'F29': 57392, 'F30': 57393, 'F31': 57394, 'F32': 57395,
  'F33': 57396, 'F34': 57397, 'F35': 57398,
  // Keypad keys
  'Numpad0': 57399, 'Numpad1': 57400, 'Numpad2': 57401, 'Numpad3': 57402,
  'Numpad4': 57403, 'Numpad5': 57404, 'Numpad6': 57405, 'Numpad7': 57406,
  'Numpad8': 57407, 'Numpad9': 57408, 'NumpadDecimal': 57409,
  'NumpadDivide': 57410, 'NumpadMultiply': 57411, 'NumpadSubtract': 57412,
  'NumpadAdd': 57413, 'NumpadEnter': 57414, 'NumpadEqual': 57415,
  'NumpadSeparator': 57416,
  // Arrow keys on keypad
  'NumpadArrowLeft': 57417, 'NumpadArrowRight': 57418, 'NumpadArrowUp': 57419,
  'NumpadArrowDown': 57420, 'NumpadPageUp': 57421, 'NumpadPageDown': 57422,
  'NumpadHome': 57423, 'NumpadEnd': 57424, 'NumpadInsert': 57425,
  'NumpadDelete': 57426, 'NumpadBegin': 57427,
  // Media keys
  'MediaPlay': 57428, 'MediaPause': 57429, 'MediaPlayPause': 57430,
  'MediaReverse': 57431, 'MediaStop': 57432, 'MediaFastForward': 57433,
  'MediaRewind': 57434, 'MediaTrackNext': 57435, 'MediaTrackPrevious': 57436,
  'MediaRecord': 57437, 'AudioVolumeDown': 57438, 'AudioVolumeUp': 57439,
  'AudioVolumeMute': 57440,
  // Modifier keys
  'ShiftLeft': 57441, 'ControlLeft': 57442, 'AltLeft': 57443,
  'MetaLeft': 57444, 'HyperLeft': 57445, 'SuperLeft': 57446,
  'ShiftRight': 57447, 'ControlRight': 57448, 'AltRight': 57449,
  'MetaRight': 57450, 'HyperRight': 57451, 'SuperRight': 57452,
  // Lock keys
  'CapsLock': 57358, 'ScrollLock': 57359, 'NumLock': 57360,
  'PrintScreen': 57361, 'Pause': 57362, 'ContextMenu': 57363
};

// reg + shift key mappings for digits and special chars
const KEYCODE_KEY_MAPPINGS: { [key: number]: [string, string]} = {
  // digits 0-9
  48: ['0', ')'],
  49: ['1', '!'],
  50: ['2', '@'],
  51: ['3', '#'],
  52: ['4', '$'],
  53: ['5', '%'],
  54: ['6', '^'],
  55: ['7', '&'],
  56: ['8', '*'],
  57: ['9', '('],

  // special chars
  186: [';', ':'],
  187: ['=', '+'],
  188: [',', '<'],
  189: ['-', '_'],
  190: ['.', '>'],
  191: ['/', '?'],
  192: ['`', '~'],
  219: ['[', '{'],
  220: ['\\', '|'],
  221: [']', '}'],
  222: ['\'', '"']
};

// Kitty keyboard protocol flags
const KITTY_FLAG_DISAMBIGUATE = 1;        // 0b1
const KITTY_FLAG_REPORT_EVENTS = 2;       // 0b10
const KITTY_FLAG_REPORT_ALTERNATE = 4;    // 0b100
const KITTY_FLAG_REPORT_ALL_KEYS = 8;     // 0b1000
const KITTY_FLAG_REPORT_TEXT = 16;        // 0b10000

/**
 * Encodes a key event using the Kitty keyboard protocol format:
 * CSI unicode-key-code:alternate-key-codes ; modifiers:event-type ; text-as-codepoints u
 */
export function encodeKittyKeyboardEvent(
  ev: IKeyboardEvent,
  flags: number,
  eventType: number = 1
): string {
  // Calculate modifiers (1 + actual modifiers)
  let modifiers = 1;
  if (ev.shiftKey) modifiers += 1;
  if (ev.altKey) modifiers += 2;
  if (ev.ctrlKey) modifiers += 4;
  if (ev.metaKey) modifiers += 8;
  // Note: Hyper, Meta, CapsLock, NumLock would be added here for full implementation

  let keyCode: number;
  let alternateKeys = '';
  let textCodepoints = '';
  let reportModifiers = modifiers;

  // Determine the base key code
  if (ev.key.length === 1) {
    // Single character key - use lowercase Unicode codepoint
    keyCode = ev.key.toLowerCase().charCodeAt(0);
    
    // For single character keys, don't report shift modifier alone
    // but do report it when combined with other modifiers
    if (ev.shiftKey && !ev.altKey && !ev.ctrlKey && !ev.metaKey) {
      reportModifiers = 1; // Don't report shift modifier for single chars
    }

    // Add shifted key if shift is pressed and reporting alternate keys
    if ((flags & KITTY_FLAG_REPORT_ALTERNATE) && ev.shiftKey && ev.key !== ev.key.toLowerCase()) {
      alternateKeys = ':' + ev.key.charCodeAt(0);
    }

    // Add text codepoints if reporting associated text
    if ((flags & KITTY_FLAG_REPORT_TEXT) && (flags & KITTY_FLAG_REPORT_ALL_KEYS)) {
      textCodepoints = ';' + ev.key.charCodeAt(0);
    }
  } else {
    // Functional key - map to Kitty key codes
    keyCode = getKittyFunctionalKeyCode(ev.key, ev.code);
  }

  // Build the escape sequence
  let sequence = `${C0.ESC}[${keyCode}`;

  if (alternateKeys) {
    sequence += alternateKeys;
  }

  // Add modifiers if present or if event type is not press
  if (reportModifiers > 1 || eventType !== 1) {
    sequence += `;${reportModifiers}`;
    if (eventType !== 1) {
      sequence += `:${eventType}`;
    }
  }

  // Add text codepoints if present
  if (textCodepoints) {
    sequence += textCodepoints;
  }

  sequence += 'u';
  return sequence;
}

/**
 * Determines if a key event should use Kitty keyboard protocol
 */
function shouldUseKittyKeyboard(ev: IKeyboardEvent, flags: number): boolean {
  // Always use Kitty protocol if REPORT_ALL_KEYS is set
  if (flags & KITTY_FLAG_REPORT_ALL_KEYS) {
    return true;
  }

  // Use Kitty protocol for disambiguation if flag is set and key needs disambiguation
  if (flags & KITTY_FLAG_DISAMBIGUATE) {
    // Keys that need disambiguation
    if (ev.key === 'Escape' ||
        (ev.altKey && ev.key.length === 1) ||
        (ev.ctrlKey && ev.key.length === 1)) {
      return true;
    }
  }

  // Use for functional keys that have Kitty codes
  if (ev.key.length > 1) {
    const keyCode = getKittyFunctionalKeyCode(ev.key, ev.code);
    if (keyCode >= 57344) { // Private Use Area keys
      return true;
    }
  }

  return false;
}

/**
 * Maps DOM key/code values to Kitty functional key codes
 */
function getKittyFunctionalKeyCode(key: string, code: string): number {
  // Check direct mapping first
  if (KITTY_FUNCTIONAL_KEYS[key]) {
    return KITTY_FUNCTIONAL_KEYS[key];
  }

  // Handle special cases
  switch (key) {
    case 'Escape': return 27;
    case 'Enter': return 13;
    case 'Tab': return 9;
    case 'Backspace': return 127;
    case 'Insert': return 2;  // Will use legacy ~ form
    case 'Delete': return 3;  // Will use legacy ~ form
    case 'ArrowLeft': return 1;  // Will use legacy D form
    case 'ArrowRight': return 1; // Will use legacy C form
    case 'ArrowUp': return 1;    // Will use legacy A form
    case 'ArrowDown': return 1;  // Will use legacy B form
    case 'PageUp': return 5;     // Will use legacy ~ form
    case 'PageDown': return 6;   // Will use legacy ~ form
    case 'Home': return 1;       // Will use legacy H form
    case 'End': return 1;        // Will use legacy F form
    case 'F1': return 1;         // Will use legacy P form
    case 'F2': return 1;         // Will use legacy Q form
    case 'F3': return 13;        // Will use legacy ~ form
    case 'F4': return 1;         // Will use legacy S form
    case 'F5': return 15;        // Will use legacy ~ form
    case 'F6': return 17;        // Will use legacy ~ form
    case 'F7': return 18;        // Will use legacy ~ form
    case 'F8': return 19;        // Will use legacy ~ form
    case 'F9': return 20;        // Will use legacy ~ form
    case 'F10': return 21;       // Will use legacy ~ form
    case 'F11': return 23;       // Will use legacy ~ form
    case 'F12': return 24;       // Will use legacy ~ form
    default:
      // Try to match by code for keypad keys
      if (code.startsWith('Numpad')) {
        const numpadKey = 'Numpad' + code.slice(6);
        return KITTY_FUNCTIONAL_KEYS[numpadKey] || 0;
      }
      return 0; // Unknown key
  }
}

export function evaluateKeyboardEvent(
  ev: IKeyboardEvent,
  applicationCursorMode: boolean,
  isMac: boolean,
  macOptionIsMeta: boolean,
  kittyKeyboardFlags: number = 0
): IKeyboardResult {
  const result: IKeyboardResult = {
    type: KeyboardResultType.SEND_KEY,
    // Whether to cancel event propagation (NOTE: this may not be needed since the event is
    // canceled at the end of keyDown
    cancel: false,
    // The new key even to emit
    key: undefined
  };

  // Handle Kitty keyboard protocol if enabled
  if (kittyKeyboardFlags > 0) {
    const shouldUseKittyProtocol = shouldUseKittyKeyboard(ev, kittyKeyboardFlags);
    if (shouldUseKittyProtocol) {
      result.key = encodeKittyKeyboardEvent(ev, kittyKeyboardFlags, 1); // 1 = press event
      result.cancel = true;
      return result;
    }
  }

  const modifiers = (ev.shiftKey ? 1 : 0) | (ev.altKey ? 2 : 0) | (ev.ctrlKey ? 4 : 0) | (ev.metaKey ? 8 : 0);
  switch (ev.keyCode) {
    case 0:
      if (ev.key === 'UIKeyInputUpArrow') {
        if (applicationCursorMode) {
          result.key = C0.ESC + 'OA';
        } else {
          result.key = C0.ESC + '[A';
        }
      }
      else if (ev.key === 'UIKeyInputLeftArrow') {
        if (applicationCursorMode) {
          result.key = C0.ESC + 'OD';
        } else {
          result.key = C0.ESC + '[D';
        }
      }
      else if (ev.key === 'UIKeyInputRightArrow') {
        if (applicationCursorMode) {
          result.key = C0.ESC + 'OC';
        } else {
          result.key = C0.ESC + '[C';
        }
      }
      else if (ev.key === 'UIKeyInputDownArrow') {
        if (applicationCursorMode) {
          result.key = C0.ESC + 'OB';
        } else {
          result.key = C0.ESC + '[B';
        }
      }
      break;
    case 8:
      // backspace
      result.key = ev.ctrlKey ? '\b' : C0.DEL; // ^H or ^?
      if (ev.altKey) {
        result.key = C0.ESC + result.key;
      }
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
      result.key = ev.altKey ? C0.ESC + C0.CR : C0.CR;
      result.cancel = true;
      break;
    case 27:
      // escape
      result.key = C0.ESC;
      if (ev.altKey) {
        result.key = C0.ESC + C0.ESC;
      }
      result.cancel = true;
      break;
    case 37:
      // left-arrow
      if (ev.metaKey) {
        break;
      }
      if (modifiers) {
        result.key = C0.ESC + '[1;' + (modifiers + 1) + 'D';
      } else if (applicationCursorMode) {
        result.key = C0.ESC + 'OD';
      } else {
        result.key = C0.ESC + '[D';
      }
      break;
    case 39:
      // right-arrow
      if (ev.metaKey) {
        break;
      }
      if (modifiers) {
        result.key = C0.ESC + '[1;' + (modifiers + 1) + 'C';
      } else if (applicationCursorMode) {
        result.key = C0.ESC + 'OC';
      } else {
        result.key = C0.ESC + '[C';
      }
      break;
    case 38:
      // up-arrow
      if (ev.metaKey) {
        break;
      }
      if (modifiers) {
        result.key = C0.ESC + '[1;' + (modifiers + 1) + 'A';
      } else if (applicationCursorMode) {
        result.key = C0.ESC + 'OA';
      } else {
        result.key = C0.ESC + '[A';
      }
      break;
    case 40:
      // down-arrow
      if (ev.metaKey) {
        break;
      }
      if (modifiers) {
        result.key = C0.ESC + '[1;' + (modifiers + 1) + 'B';
      } else if (applicationCursorMode) {
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
      if (modifiers) {
        result.key = C0.ESC + '[1;' + (modifiers + 1) + 'H';
      } else if (applicationCursorMode) {
        result.key = C0.ESC + 'OH';
      } else {
        result.key = C0.ESC + '[H';
      }
      break;
    case 35:
      // end
      if (modifiers) {
        result.key = C0.ESC + '[1;' + (modifiers + 1) + 'F';
      } else if (applicationCursorMode) {
        result.key = C0.ESC + 'OF';
      } else {
        result.key = C0.ESC + '[F';
      }
      break;
    case 33:
      // page up
      if (ev.shiftKey) {
        result.type = KeyboardResultType.PAGE_UP;
      } else if (ev.ctrlKey) {
        result.key = C0.ESC + '[5;' + (modifiers + 1) + '~';
      } else {
        result.key = C0.ESC + '[5~';
      }
      break;
    case 34:
      // page down
      if (ev.shiftKey) {
        result.type = KeyboardResultType.PAGE_DOWN;
      } else if (ev.ctrlKey) {
        result.key = C0.ESC + '[6;' + (modifiers + 1) + '~';
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
          result.key = C0.NUL;
        } else if (ev.keyCode >= 51 && ev.keyCode <= 55) {
          // escape, file sep, group sep, record sep, unit sep
          result.key = String.fromCharCode(ev.keyCode - 51 + 27);
        } else if (ev.keyCode === 56) {
          result.key = C0.DEL;
        } else if (ev.keyCode === 219) {
          result.key = C0.ESC;
        } else if (ev.keyCode === 220) {
          result.key = C0.FS;
        } else if (ev.keyCode === 221) {
          result.key = C0.GS;
        }
      } else if ((!isMac || macOptionIsMeta) && ev.altKey && !ev.metaKey) {
        // On macOS this is a third level shift when !macOptionIsMeta. Use <Esc> instead.
        const keyMapping = KEYCODE_KEY_MAPPINGS[ev.keyCode];
        const key = keyMapping?.[!ev.shiftKey ? 0 : 1];
        if (key) {
          result.key = C0.ESC + key;
        } else if (ev.keyCode >= 65 && ev.keyCode <= 90) {
          const keyCode = ev.ctrlKey ? ev.keyCode - 64 : ev.keyCode + 32;
          let keyString = String.fromCharCode(keyCode);
          if (ev.shiftKey) {
            keyString = keyString.toUpperCase();
          }
          result.key = C0.ESC + keyString;
        } else if (ev.keyCode === 32) {
          result.key = C0.ESC + (ev.ctrlKey ? C0.NUL : ' ');
        } else if (ev.key === 'Dead' && ev.code.startsWith('Key')) {
          // Reference: https://github.com/xtermjs/xterm.js/issues/3725
          // Alt will produce a "dead key" (initate composition) with some
          // of the letters in US layout (e.g. N/E/U).
          // It's safe to match against Key* since no other `code` values begin with "Key".
          // https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code/code_values#code_values_on_mac
          let keyString = ev.code.slice(3, 4);
          if (!ev.shiftKey) {
            keyString = keyString.toLowerCase();
          }
          result.key = C0.ESC + keyString;
          result.cancel = true;
        }
      } else if (isMac && !ev.altKey && !ev.ctrlKey && !ev.shiftKey && ev.metaKey) {
        if (ev.keyCode === 65) { // cmd + a
          result.type = KeyboardResultType.SELECT_ALL;
        }
      } else if (ev.key && !ev.ctrlKey && !ev.altKey && !ev.metaKey && ev.keyCode >= 48 && ev.key.length === 1) {
        // Include only keys that that result in a _single_ character; don't include num lock,
        // volume up, etc.
        result.key = ev.key;
      } else if (ev.key && ev.ctrlKey) {
        if (ev.key === '_') { // ^_
          result.key = C0.US;
        }
        if (ev.key === '@') { // ^ + shift + 2 = ^ + @
          result.key = C0.NUL;
        }
      }
      break;
  }

  return result;
}
