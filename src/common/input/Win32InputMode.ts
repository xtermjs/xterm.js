/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * Win32 input mode implementation.
 * @see https://github.com/microsoft/terminal/blob/main/doc/specs/%234999%20-%20Improved%20keyboard%20handling%20in%20Conpty.md
 *
 * Format: CSI Vk ; Sc ; Uc ; Kd ; Cs ; Rc _
 *   Vk: Virtual key code (decimal)
 *   Sc: Scan code (decimal)
 *   Uc: Unicode character (decimal codepoint, 0 if none)
 *   Kd: Key down (1) or up (0)
 *   Cs: Control key state (modifier flags)
 *   Rc: Repeat count (usually 1)
 */

import { IKeyboardEvent, IKeyboardResult, KeyboardResultType } from 'common/Types';
import { C0 } from 'common/data/EscapeSequences';

/**
 * Win32 control key state flags (from Windows API).
 */
export const enum Win32ControlKeyState {
  RIGHT_ALT_PRESSED   = 0b000000001,
  LEFT_ALT_PRESSED    = 0b000000010,
  RIGHT_CTRL_PRESSED  = 0b000000100,
  LEFT_CTRL_PRESSED   = 0b000001000,
  SHIFT_PRESSED       = 0b000010000,
  NUMLOCK_ON          = 0b000100000,
  SCROLLLOCK_ON       = 0b001000000,
  CAPSLOCK_ON         = 0b010000000,
  ENHANCED_KEY        = 0b100000000,
}

/**
 * Win32 input mode handler. Lookup tables are only initialized when this class
 * is instantiated, reducing bundle size for environments that don't use this mode.
 */
export class Win32InputMode {
  /**
   * Mapping from browser KeyboardEvent.code to Win32 virtual key codes.
   * Based on https://docs.microsoft.com/en-us/windows/win32/inputdev/virtual-key-codes
   */
  private readonly _codeToVk: { [code: string]: number } = {
    // Letters
    'KeyA': 0x41, 'KeyB': 0x42, 'KeyC': 0x43, 'KeyD': 0x44, 'KeyE': 0x45,
    'KeyF': 0x46, 'KeyG': 0x47, 'KeyH': 0x48, 'KeyI': 0x49, 'KeyJ': 0x4A,
    'KeyK': 0x4B, 'KeyL': 0x4C, 'KeyM': 0x4D, 'KeyN': 0x4E, 'KeyO': 0x4F,
    'KeyP': 0x50, 'KeyQ': 0x51, 'KeyR': 0x52, 'KeyS': 0x53, 'KeyT': 0x54,
    'KeyU': 0x55, 'KeyV': 0x56, 'KeyW': 0x57, 'KeyX': 0x58, 'KeyY': 0x59,
    'KeyZ': 0x5A,

    // Digits
    'Digit0': 0x30, 'Digit1': 0x31, 'Digit2': 0x32, 'Digit3': 0x33, 'Digit4': 0x34,
    'Digit5': 0x35, 'Digit6': 0x36, 'Digit7': 0x37, 'Digit8': 0x38, 'Digit9': 0x39,

    // Function keys
    'F1': 0x70, 'F2': 0x71, 'F3': 0x72, 'F4': 0x73, 'F5': 0x74, 'F6': 0x75,
    'F7': 0x76, 'F8': 0x77, 'F9': 0x78, 'F10': 0x79, 'F11': 0x7A, 'F12': 0x7B,
    'F13': 0x7C, 'F14': 0x7D, 'F15': 0x7E, 'F16': 0x7F, 'F17': 0x80, 'F18': 0x81,
    'F19': 0x82, 'F20': 0x83, 'F21': 0x84, 'F22': 0x85, 'F23': 0x86, 'F24': 0x87,

    // Numpad
    'Numpad0': 0x60, 'Numpad1': 0x61, 'Numpad2': 0x62, 'Numpad3': 0x63, 'Numpad4': 0x64,
    'Numpad5': 0x65, 'Numpad6': 0x66, 'Numpad7': 0x67, 'Numpad8': 0x68, 'Numpad9': 0x69,
    'NumpadMultiply': 0x6A, 'NumpadAdd': 0x6B, 'NumpadSeparator': 0x6C,
    'NumpadSubtract': 0x6D, 'NumpadDecimal': 0x6E, 'NumpadDivide': 0x6F,
    'NumpadEnter': 0x0D, // Same as Enter but with ENHANCED_KEY flag
    'NumLock': 0x90,

    // Navigation
    'ArrowUp': 0x26, 'ArrowDown': 0x28, 'ArrowLeft': 0x25, 'ArrowRight': 0x27,
    'Home': 0x24, 'End': 0x23, 'PageUp': 0x21, 'PageDown': 0x22,
    'Insert': 0x2D, 'Delete': 0x2E,

    // Modifiers
    'ShiftLeft': 0x10, 'ShiftRight': 0x10,
    'ControlLeft': 0x11, 'ControlRight': 0x11,
    'AltLeft': 0x12, 'AltRight': 0x12,
    'MetaLeft': 0x5B, 'MetaRight': 0x5C,
    'CapsLock': 0x14, 'ScrollLock': 0x91,

    // Special keys
    'Escape': 0x1B, 'Enter': 0x0D, 'Tab': 0x09, 'Space': 0x20,
    'Backspace': 0x08, 'Pause': 0x13, 'ContextMenu': 0x5D, 'PrintScreen': 0x2C,

    // OEM keys (US keyboard layout)
    'Semicolon': 0xBA,      // ;:
    'Equal': 0xBB,          // =+
    'Comma': 0xBC,          // ,<
    'Minus': 0xBD,          // -_
    'Period': 0xBE,         // .>
    'Slash': 0xBF,          // /?
    'Backquote': 0xC0,      // `~
    'BracketLeft': 0xDB,    // [{
    'Backslash': 0xDC,      // \|
    'BracketRight': 0xDD,   // ]}
    'Quote': 0xDE,          // '"
    'IntlBackslash': 0xE2   // Non-US backslash
  };

  /**
   * Mapping from browser KeyboardEvent.code to approximate Win32 scan codes.
   * Note: Scan codes can vary by keyboard layout. These are approximations
   * based on standard US keyboard layout.
   */
  private readonly _codeToScancode: { [code: string]: number } = {
    // Letters (row by row)
    'KeyQ': 0x10, 'KeyW': 0x11, 'KeyE': 0x12, 'KeyR': 0x13, 'KeyT': 0x14,
    'KeyY': 0x15, 'KeyU': 0x16, 'KeyI': 0x17, 'KeyO': 0x18, 'KeyP': 0x19,
    'KeyA': 0x1E, 'KeyS': 0x1F, 'KeyD': 0x20, 'KeyF': 0x21, 'KeyG': 0x22,
    'KeyH': 0x23, 'KeyJ': 0x24, 'KeyK': 0x25, 'KeyL': 0x26,
    'KeyZ': 0x2C, 'KeyX': 0x2D, 'KeyC': 0x2E, 'KeyV': 0x2F, 'KeyB': 0x30,
    'KeyN': 0x31, 'KeyM': 0x32,

    // Digits
    'Digit1': 0x02, 'Digit2': 0x03, 'Digit3': 0x04, 'Digit4': 0x05, 'Digit5': 0x06,
    'Digit6': 0x07, 'Digit7': 0x08, 'Digit8': 0x09, 'Digit9': 0x0A, 'Digit0': 0x0B,

    // Function keys
    'F1': 0x3B, 'F2': 0x3C, 'F3': 0x3D, 'F4': 0x3E, 'F5': 0x3F, 'F6': 0x40,
    'F7': 0x41, 'F8': 0x42, 'F9': 0x43, 'F10': 0x44, 'F11': 0x57, 'F12': 0x58,

    // Numpad
    'Numpad0': 0x52, 'Numpad1': 0x4F, 'Numpad2': 0x50, 'Numpad3': 0x51, 'Numpad4': 0x4B,
    'Numpad5': 0x4C, 'Numpad6': 0x4D, 'Numpad7': 0x47, 'Numpad8': 0x48, 'Numpad9': 0x49,
    'NumpadMultiply': 0x37, 'NumpadAdd': 0x4E, 'NumpadSubtract': 0x4A,
    'NumpadDecimal': 0x53, 'NumpadDivide': 0x35, 'NumpadEnter': 0x1C,
    'NumLock': 0x45,

    // Navigation (extended keys)
    'ArrowUp': 0x48, 'ArrowDown': 0x50, 'ArrowLeft': 0x4B, 'ArrowRight': 0x4D,
    'Home': 0x47, 'End': 0x4F, 'PageUp': 0x49, 'PageDown': 0x51,
    'Insert': 0x52, 'Delete': 0x53,

    // Modifiers
    'ShiftLeft': 0x2A, 'ShiftRight': 0x36,
    'ControlLeft': 0x1D, 'ControlRight': 0x1D,
    'AltLeft': 0x38, 'AltRight': 0x38,
    'CapsLock': 0x3A, 'ScrollLock': 0x46,

    // Special keys
    'Escape': 0x01, 'Enter': 0x1C, 'Tab': 0x0F, 'Space': 0x39,
    'Backspace': 0x0E, 'Pause': 0x45,

    // OEM keys
    'Semicolon': 0x27, 'Equal': 0x0D, 'Comma': 0x33, 'Minus': 0x0C,
    'Period': 0x34, 'Slash': 0x35, 'Backquote': 0x29,
    'BracketLeft': 0x1A, 'Backslash': 0x2B, 'BracketRight': 0x1B, 'Quote': 0x28
  };

  /**
   * Codes that represent enhanced keys (extended keyboard keys).
   */
  private readonly _enhancedKeyCodes = new Set([
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'Home', 'End', 'PageUp', 'PageDown', 'Insert', 'Delete',
    'NumpadEnter', 'NumpadDivide',
    'ControlRight', 'AltRight',
    'PrintScreen', 'Pause', 'ContextMenu',
    'MetaLeft', 'MetaRight'
  ]);

  /**
   * Mapping of special keys (ev.key values) to their Unicode control character codes.
   * These keys have multi-character ev.key strings but produce control characters.
   * @see https://docs.microsoft.com/en-us/windows/console/key-event-record-str
   */
  private readonly _keyToControlChar: { [key: string]: number } = {
    'Enter': 0x0D,      // Carriage return
    'Backspace': 0x08,  // Backspace
    'Tab': 0x09,        // Horizontal tab
    'Escape': 0x1B      // Escape
  };

  /**
   * Get the Win32 virtual key code for a keyboard event.
   */
  private _getVirtualKeyCode(ev: IKeyboardEvent): number {
    const vk = this._codeToVk[ev.code];
    if (vk !== undefined) {
      return vk;
    }
    // Fall back to keyCode for unmapped keys
    return ev.keyCode || 0;
  }

  /**
   * Get the Win32 scan code for a keyboard event.
   * Returns 0 if unknown (scan codes vary by hardware).
   */
  private _getScanCode(ev: IKeyboardEvent): number {
    return this._codeToScancode[ev.code] || 0;
  }

  /**
   * Get the unicode character for a keyboard event.
   * Returns 0 for non-character keys.
   */
  private _getUnicodeChar(ev: IKeyboardEvent): number {
    // Handle special keys that produce control characters
    // Ctrl modifies some of these: Ctrl+Enter=LF, Ctrl+Backspace=DEL
    if (ev.ctrlKey && !ev.altKey && !ev.metaKey) {
      if (ev.key === 'Enter') {
        return 0x0A; // Line feed (Ctrl+Enter)
      }
      if (ev.key === 'Backspace') {
        return 0x7F; // DEL (Ctrl+Backspace)
      }
    }

    // Check for special keys that always produce control characters
    const controlChar = this._keyToControlChar[ev.key];
    if (controlChar !== undefined) {
      return controlChar;
    }

    // Only single-character keys produce unicode output
    if (ev.key.length === 1) {
      const codePoint = ev.key.codePointAt(0) || 0;

      // Handle Ctrl+letter combinations - these produce control characters (0x01-0x1A)
      if (ev.ctrlKey && !ev.altKey && !ev.metaKey) {
        // Convert A-Z or a-z to control character (Ctrl+A = 0x01, Ctrl+C = 0x03, etc.)
        if (codePoint >= 0x41 && codePoint <= 0x5A) { // A-Z
          return codePoint - 0x40;
        }
        if (codePoint >= 0x61 && codePoint <= 0x7A) { // a-z
          return codePoint - 0x60;
        }
      }

      return codePoint;
    }
    return 0;
  }

  /**
   * Get the Win32 control key state flags.
   */
  private _getControlKeyState(ev: IKeyboardEvent): number {
    let state = 0;

    if (ev.shiftKey) {
      state |= Win32ControlKeyState.SHIFT_PRESSED;
    }

    // Note: We can't distinguish left/right for ctrl/alt in standard browser events,
    // so we use the generic pressed flags. The right-side flags are used when
    // we can detect them (e.g., via code property).
    if (ev.ctrlKey) {
      if (ev.code === 'ControlRight') {
        state |= Win32ControlKeyState.RIGHT_CTRL_PRESSED;
      } else {
        state |= Win32ControlKeyState.LEFT_CTRL_PRESSED;
      }
    }

    if (ev.altKey) {
      if (ev.code === 'AltRight') {
        state |= Win32ControlKeyState.RIGHT_ALT_PRESSED;
      } else {
        state |= Win32ControlKeyState.LEFT_ALT_PRESSED;
      }
    }

    // Check for enhanced key
    if (this._enhancedKeyCodes.has(ev.code)) {
      state |= Win32ControlKeyState.ENHANCED_KEY;
    }

    return state;
  }

  /**
   * Evaluate a keyboard event using Win32 input mode.
   *
   * @param ev The keyboard event.
   * @param isKeyDown Whether this is a keydown (true) or keyup (false) event.
   * @returns The keyboard result with the encoded key sequence.
   */
  public evaluateKeyboardEvent(ev: IKeyboardEvent, isKeyDown: boolean): IKeyboardResult {
    const vk = this._getVirtualKeyCode(ev);
    const sc = this._getScanCode(ev);
    const uc = this._getUnicodeChar(ev);
    const kd = isKeyDown ? 1 : 0;
    const cs = this._getControlKeyState(ev);
    const rc = 1; // Repeat count, always 1 for now

    // Format: CSI Vk ; Sc ; Uc ; Kd ; Cs ; Rc _
    return {
      type: KeyboardResultType.SEND_KEY,
      cancel: true,
      key: `${C0.ESC}[${vk};${sc};${uc};${kd};${cs};${rc}_`
    };
  }
}
