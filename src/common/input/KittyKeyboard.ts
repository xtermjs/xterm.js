/**
 * Copyright (c) 2025 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * Kitty keyboard protocol implementation.
 * @see https://sw.kovidgoyal.net/kitty/keyboard-protocol/
 */

import { IKeyboardEvent, IKeyboardResult, KeyboardResultType } from 'common/Types';
import { C0 } from 'common/data/EscapeSequences';

/**
 * Kitty keyboard protocol enhancement flags (bitfield).
 */
export const enum KittyKeyboardFlags {
  NONE                            = 0b00000,
  /** Disambiguate escape codes - fixes ambiguous legacy encodings */
  DISAMBIGUATE_ESCAPE_CODES       = 0b00001,
  /** Report event types - press/repeat/release */
  REPORT_EVENT_TYPES              = 0b00010,
  /** Report alternate keys - shifted key and base layout key */
  REPORT_ALTERNATE_KEYS           = 0b00100,
  /** Report all keys as escape codes - text-producing keys as CSI u */
  REPORT_ALL_KEYS_AS_ESCAPE_CODES = 0b01000,
  /** Report associated text - includes text codepoints in escape code */
  REPORT_ASSOCIATED_TEXT          = 0b10000,
}

/**
 * Kitty keyboard event types.
 */
export const enum KittyKeyboardEventType {
  PRESS = 1,
  REPEAT = 2,
  RELEASE = 3,
}

/**
 * Kitty modifier bits (different from xterm modifier encoding).
 * Value sent = 1 + modifier_bits
 */
export const enum KittyKeyboardModifiers {
  SHIFT     = 0b00000001,
  ALT       = 0b00000010,
  CTRL      = 0b00000100,
  SUPER     = 0b00001000,
  HYPER     = 0b00010000,
  META      = 0b00100000,
  CAPS_LOCK = 0b01000000,
  NUM_LOCK  = 0b10000000,
}

/**
 * Kitty keyboard protocol handler class.
 * Encapsulates all key code mappings and encoding logic.
 */
export class KittyKeyboard {
  /**
   * Functional key codes for Kitty protocol.
   * Keys that don't produce text have specific unicode codepoint mappings.
   */
  private readonly _functionalKeyCodes: { [key: string]: number } = {
    'Escape': 27,
    'Enter': 13,
    'Tab': 9,
    'Backspace': 127,
    'CapsLock': 57358,
    'ScrollLock': 57359,
    'NumLock': 57360,
    'PrintScreen': 57361,
    'Pause': 57362,
    'ContextMenu': 57363,
    // F13-F35 (F1-F12 use legacy encoding)
    'F13': 57376,
    'F14': 57377,
    'F15': 57378,
    'F16': 57379,
    'F17': 57380,
    'F18': 57381,
    'F19': 57382,
    'F20': 57383,
    'F21': 57384,
    'F22': 57385,
    'F23': 57386,
    'F24': 57387,
    'F25': 57388,
    // Keypad keys
    'KP_0': 57399,
    'KP_1': 57400,
    'KP_2': 57401,
    'KP_3': 57402,
    'KP_4': 57403,
    'KP_5': 57404,
    'KP_6': 57405,
    'KP_7': 57406,
    'KP_8': 57407,
    'KP_9': 57408,
    'KP_Decimal': 57409,
    'KP_Divide': 57410,
    'KP_Multiply': 57411,
    'KP_Subtract': 57412,
    'KP_Add': 57413,
    'KP_Enter': 57414,
    'KP_Equal': 57415,
    // Modifier keys
    'ShiftLeft': 57441,
    'ShiftRight': 57447,
    'ControlLeft': 57442,
    'ControlRight': 57448,
    'AltLeft': 57443,
    'AltRight': 57449,
    'MetaLeft': 57444,
    'MetaRight': 57450,
    // Media keys
    'MediaPlayPause': 57430,
    'MediaStop': 57432,
    'MediaTrackNext': 57435,
    'MediaTrackPrevious': 57436,
    'AudioVolumeDown': 57438,
    'AudioVolumeUp': 57439,
    'AudioVolumeMute': 57440
  };

  /**
   * Keys that use CSI ~ encoding with a number parameter.
   */
  private readonly _csiTildeKeys: { [key: string]: number } = {
    'Insert': 2,
    'Delete': 3,
    'PageUp': 5,
    'PageDown': 6,
    'F5': 15,
    'F6': 17,
    'F7': 18,
    'F8': 19,
    'F9': 20,
    'F10': 21,
    'F11': 23,
    'F12': 24
  };

  /**
   * Keys that use CSI letter encoding (arrows, Home, End).
   */
  private readonly _csiLetterKeys: { [key: string]: string } = {
    'ArrowUp': 'A',
    'ArrowDown': 'B',
    'ArrowRight': 'C',
    'ArrowLeft': 'D',
    'Home': 'H',
    'End': 'F'
  };

  /**
   * Function keys F1-F4 use SS3 encoding without modifiers.
   */
  private readonly _ss3FunctionKeys: { [key: string]: string } = {
    'F1': 'P',
    'F2': 'Q',
    'F3': 'R',
    'F4': 'S'
  };

  /**
   * Map browser key codes to Kitty numpad codes.
   */
  private _getNumpadKeyCode(ev: IKeyboardEvent): number | undefined {
    if (ev.code.startsWith('Numpad')) {
      const suffix = ev.code.slice(6);
      if (suffix >= '0' && suffix <= '9') {
        return 57399 + parseInt(suffix, 10);
      }
      switch (suffix) {
        case 'Decimal': return 57409;
        case 'Divide': return 57410;
        case 'Multiply': return 57411;
        case 'Subtract': return 57412;
        case 'Add': return 57413;
        case 'Enter': return 57414;
        case 'Equal': return 57415;
      }
    }
    return undefined;
  }

  /**
   * Get modifier key code from code property.
   */
  private _getModifierKeyCode(ev: IKeyboardEvent): number | undefined {
    switch (ev.code) {
      case 'ShiftLeft': return 57441;
      case 'ShiftRight': return 57447;
      case 'ControlLeft': return 57442;
      case 'ControlRight': return 57448;
      case 'AltLeft': return 57443;
      case 'AltRight': return 57449;
      case 'MetaLeft': return 57444;
      case 'MetaRight': return 57450;
    }
    return undefined;
  }

  /**
   * Encode modifiers for Kitty protocol.
   * Returns 1 + modifier bits, or 0 if no modifiers.
   */
  private _encodeModifiers(ev: IKeyboardEvent): number {
    let mods = 0;
    if (ev.shiftKey) mods |= KittyKeyboardModifiers.SHIFT;
    if (ev.altKey) mods |= KittyKeyboardModifiers.ALT;
    if (ev.ctrlKey) mods |= KittyKeyboardModifiers.CTRL;
    if (ev.metaKey) mods |= KittyKeyboardModifiers.SUPER;
    return mods > 0 ? mods + 1 : 0;
  }

  /**
   * Get the unicode key code for a keyboard event.
   * Returns the lowercase codepoint for letters.
   * For shifted keys, uses the code property to get the base key.
   */
  private _getKeyCode(ev: IKeyboardEvent): number | undefined {
    const numpadCode = this._getNumpadKeyCode(ev);
    if (numpadCode !== undefined) {
      return numpadCode;
    }

    const modifierCode = this._getModifierKeyCode(ev);
    if (modifierCode !== undefined) {
      return modifierCode;
    }

    const funcCode = this._functionalKeyCodes[ev.key];
    if (funcCode !== undefined) {
      return funcCode;
    }

    if (ev.shiftKey && ev.code) {
      if (ev.code.startsWith('Digit') && ev.code.length === 6) {
        const digit = ev.code.charAt(5);
        if (digit >= '0' && digit <= '9') {
          return digit.charCodeAt(0);
        }
      }
      if (ev.code.startsWith('Key') && ev.code.length === 4) {
        const letter = ev.code.charAt(3).toLowerCase();
        return letter.charCodeAt(0);
      }
    }

    if (ev.key.length === 1) {
      const code = ev.key.codePointAt(0)!;
      if (code >= 65 && code <= 90) {
        return code + 32;
      }
      return code;
    }

    return undefined;
  }

  /**
   * Check if a key is a modifier key.
   */
  private _isModifierKey(ev: IKeyboardEvent): boolean {
    return ev.key === 'Shift' || ev.key === 'Control' || ev.key === 'Alt' || ev.key === 'Meta';
  }

  /**
   * Build CSI letter sequence for arrow keys, Home, End.
   * Format: CSI [1;mod] letter
   */
  private _buildCsiLetterSequence(
    letter: string,
    modifiers: number,
    eventType: KittyKeyboardEventType,
    reportEventTypes: boolean
  ): string {
    const needsEventType = reportEventTypes && eventType !== KittyKeyboardEventType.PRESS;

    if (modifiers > 0 || needsEventType) {
      let seq = C0.ESC + '[1;' + (modifiers > 0 ? modifiers : '1');
      if (needsEventType) {
        seq += ':' + eventType;
      }
      seq += letter;
      return seq;
    }
    return C0.ESC + '[' + letter;
  }

  /**
   * Build SS3 sequence for F1-F4.
   * Without modifiers: SS3 letter
   * With modifiers: CSI 1;mod letter
   */
  private _buildSs3Sequence(
    letter: string,
    modifiers: number,
    eventType: KittyKeyboardEventType,
    reportEventTypes: boolean
  ): string {
    const needsEventType = reportEventTypes && eventType !== KittyKeyboardEventType.PRESS;

    if (modifiers > 0 || needsEventType) {
      let seq = C0.ESC + '[1;' + (modifiers > 0 ? modifiers : '1');
      if (needsEventType) {
        seq += ':' + eventType;
      }
      seq += letter;
      return seq;
    }
    return C0.ESC + 'O' + letter;
  }

  /**
   * Build CSI ~ sequence for Insert, Delete, PageUp/Down, F5-F12.
   * Format: CSI number [;mod[:event]] ~
   */
  private _buildCsiTildeSequence(
    number: number,
    modifiers: number,
    eventType: KittyKeyboardEventType,
    reportEventTypes: boolean
  ): string {
    const needsEventType = reportEventTypes && eventType !== KittyKeyboardEventType.PRESS;

    let seq = C0.ESC + '[' + number;
    if (modifiers > 0 || needsEventType) {
      seq += ';' + (modifiers > 0 ? modifiers : '1');
      if (needsEventType) {
        seq += ':' + eventType;
      }
    }
    seq += '~';
    return seq;
  }

  /**
   * Build CSI u sequence.
   * Format: CSI keycode[:shifted[:base]] [;mod[:event][;text]] u
   */
  private _buildCsiUSequence(
    ev: IKeyboardEvent,
    keyCode: number,
    modifiers: number,
    eventType: KittyKeyboardEventType,
    flags: number,
    isFunc: boolean,
    isMod: boolean
  ): string {
    const reportEventTypes = !!(flags & KittyKeyboardFlags.REPORT_EVENT_TYPES);
    const reportAlternateKeys = !!(flags & KittyKeyboardFlags.REPORT_ALTERNATE_KEYS);

    let seq = C0.ESC + '[' + keyCode;

    let shiftedKey: number | undefined;
    if (reportAlternateKeys && ev.shiftKey && ev.key.length === 1 && !isFunc && !isMod) {
      shiftedKey = ev.key.codePointAt(0);
      seq += ':' + shiftedKey;
    }

    const reportAssociatedText = !!(flags & KittyKeyboardFlags.REPORT_ASSOCIATED_TEXT) &&
      eventType !== KittyKeyboardEventType.RELEASE &&
      ev.key.length === 1 &&
      !isFunc &&
      !isMod &&
      !ev.ctrlKey;
    const textCode = reportAssociatedText ? ev.key.codePointAt(0) : undefined;

    const needsEventType = reportEventTypes &&
      eventType !== KittyKeyboardEventType.PRESS &&
      (eventType === KittyKeyboardEventType.RELEASE || textCode === undefined);

    if (modifiers > 0 || needsEventType || textCode !== undefined) {
      seq += ';';
      if (modifiers > 0) {
        seq += modifiers;
      } else if (needsEventType) {
        seq += '1';
      }
      if (needsEventType) {
        seq += ':' + eventType;
      }
    }

    if (textCode !== undefined) {
      seq += ';' + textCode;
    }

    seq += 'u';
    return seq;
  }

  /**
   * Evaluate a keyboard event using Kitty keyboard protocol.
   *
   * @param ev The keyboard event.
   * @param flags The active Kitty keyboard enhancement flags.
   * @param eventType The event type (press, repeat, release).
   * @returns The keyboard result with the encoded key sequence.
   */
  public evaluate(
    ev: IKeyboardEvent,
    flags: number,
    eventType: KittyKeyboardEventType = KittyKeyboardEventType.PRESS
  ): IKeyboardResult {
    const result: IKeyboardResult = {
      type: KeyboardResultType.SEND_KEY,
      cancel: false,
      key: undefined
    };

    const modifiers = this._encodeModifiers(ev);
    const isMod = this._isModifierKey(ev);
    const reportEventTypes = !!(flags & KittyKeyboardFlags.REPORT_EVENT_TYPES);

    if (!reportEventTypes && eventType === KittyKeyboardEventType.RELEASE) {
      return result;
    }

    if (isMod && !(flags & KittyKeyboardFlags.REPORT_ALL_KEYS_AS_ESCAPE_CODES) && !reportEventTypes) {
      return result;
    }

    const csiLetter = this._csiLetterKeys[ev.key];
    if (csiLetter) {
      result.key = this._buildCsiLetterSequence(csiLetter, modifiers, eventType, reportEventTypes);
      result.cancel = true;
      return result;
    }

    const ss3Letter = this._ss3FunctionKeys[ev.key];
    if (ss3Letter) {
      result.key = this._buildSs3Sequence(ss3Letter, modifiers, eventType, reportEventTypes);
      result.cancel = true;
      return result;
    }

    const tildeCode = this._csiTildeKeys[ev.key];
    if (tildeCode !== undefined) {
      result.key = this._buildCsiTildeSequence(tildeCode, modifiers, eventType, reportEventTypes);
      result.cancel = true;
      return result;
    }

    const keyCode = this._getKeyCode(ev);
    if (keyCode === undefined) {
      return result;
    }

    const isFunc = this._functionalKeyCodes[ev.key] !== undefined || this._getNumpadKeyCode(ev) !== undefined;

    let useCsiU = false;

    if (flags & KittyKeyboardFlags.REPORT_ALL_KEYS_AS_ESCAPE_CODES) {
      useCsiU = true;
    } else if (reportEventTypes) {
      useCsiU = true;
    } else if (flags & KittyKeyboardFlags.DISAMBIGUATE_ESCAPE_CODES) {
      if (keyCode === 27 || keyCode === 127 || keyCode === 13 || keyCode === 9 || keyCode === 32) {
        useCsiU = true;
      } else if (isFunc) {
        useCsiU = true;
      } else if (modifiers > 0) {
        if (ev.shiftKey && !ev.ctrlKey && !ev.altKey && !ev.metaKey && ev.key.length === 1) {
          useCsiU = false;
        } else {
          useCsiU = true;
        }
      }
    }

    if (useCsiU) {
      result.key = this._buildCsiUSequence(ev, keyCode, modifiers, eventType, flags, isFunc, isMod);
      result.cancel = true;
    } else {
      if (ev.key.length === 1 && !ev.ctrlKey && !ev.altKey && !ev.metaKey) {
        result.key = ev.key;
      }
    }

    return result;
  }

  /**
   * Check if Kitty protocol should be used based on flags.
   */
  public static shouldUseProtocol(flags: number): boolean {
    return flags > 0;
  }
}
