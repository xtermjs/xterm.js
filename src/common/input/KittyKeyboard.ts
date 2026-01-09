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
 * Functional key codes for Kitty protocol.
 * Keys that don't produce text have specific unicode codepoint mappings.
 */
const FUNCTIONAL_KEY_CODES: { [key: string]: number } = {
  'Escape': 27,
  'Enter': 13,
  'Tab': 9,
  'Backspace': 127,
  'Insert': 2,
  'Delete': 3,
  'ArrowLeft': 57419,
  'ArrowRight': 57421,
  'ArrowUp': 57417,
  'ArrowDown': 57420,
  'PageUp': 57423,
  'PageDown': 57424,
  'Home': 57416,
  'End': 57418,
  'CapsLock': 57358,
  'ScrollLock': 57359,
  'NumLock': 57360,
  'PrintScreen': 57361,
  'Pause': 57362,
  'ContextMenu': 57363,
  // F1-F35
  'F1': 57364,
  'F2': 57365,
  'F3': 57366,
  'F4': 57367,
  'F5': 57368,
  'F6': 57369,
  'F7': 57370,
  'F8': 57371,
  'F9': 57372,
  'F10': 57373,
  'F11': 57374,
  'F12': 57375,
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
 * Map browser key codes to Kitty numpad codes.
 */
function getNumpadKeyCode(ev: IKeyboardEvent): number | undefined {
  // Detect numpad via code property
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
function getModifierKeyCode(ev: IKeyboardEvent): number | undefined {
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
function encodeModifiers(ev: IKeyboardEvent): number {
  let mods = 0;
  if (ev.shiftKey) mods |= KittyKeyboardModifiers.SHIFT;
  if (ev.altKey) mods |= KittyKeyboardModifiers.ALT;
  if (ev.ctrlKey) mods |= KittyKeyboardModifiers.CTRL;
  if (ev.metaKey) mods |= KittyKeyboardModifiers.SUPER;
  // Note: getModifierState would be needed for CAPS_LOCK/NUM_LOCK but not in IKeyboardEvent
  return mods > 0 ? mods + 1 : 0;
}

/**
 * Get the unicode key code for a keyboard event.
 */
function getKeyCode(ev: IKeyboardEvent): number | undefined {
  // Check for numpad first
  const numpadCode = getNumpadKeyCode(ev);
  if (numpadCode !== undefined) {
    return numpadCode;
  }

  // Check for modifier keys
  const modifierCode = getModifierKeyCode(ev);
  if (modifierCode !== undefined) {
    return modifierCode;
  }

  // Check functional keys
  const funcCode = FUNCTIONAL_KEY_CODES[ev.key];
  if (funcCode !== undefined) {
    return funcCode;
  }

  // For regular keys, use the key character's codepoint
  if (ev.key.length === 1) {
    return ev.key.codePointAt(0);
  }

  return undefined;
}

/**
 * Check if a key is a modifier key.
 */
function isModifierKey(ev: IKeyboardEvent): boolean {
  return ev.key === 'Shift' || ev.key === 'Control' || ev.key === 'Alt' || ev.key === 'Meta';
}

/**
 * Evaluate a keyboard event using Kitty keyboard protocol.
 *
 * @param ev The keyboard event.
 * @param flags The active Kitty keyboard enhancement flags.
 * @param eventType The event type (press, repeat, release).
 * @returns The keyboard result with the encoded key sequence.
 */
export function evaluateKeyboardEventKitty(
  ev: IKeyboardEvent,
  flags: number,
  eventType: KittyKeyboardEventType = KittyKeyboardEventType.PRESS
): IKeyboardResult {
  const result: IKeyboardResult = {
    type: KeyboardResultType.SEND_KEY,
    cancel: false,
    key: undefined
  };

  // Get the key code
  const keyCode = getKeyCode(ev);
  if (keyCode === undefined) {
    return result;
  }

  const modifiers = encodeModifiers(ev);
  const isFunc = FUNCTIONAL_KEY_CODES[ev.key] !== undefined || getNumpadKeyCode(ev) !== undefined;
  const isMod = isModifierKey(ev);

  // Determine if we should use CSI u encoding or can use legacy
  let useCsiU = false;

  if (flags & KittyKeyboardFlags.REPORT_ALL_KEYS_AS_ESCAPE_CODES) {
    // All keys use CSI u
    useCsiU = true;
  } else if (flags & KittyKeyboardFlags.REPORT_EVENT_TYPES) {
    // When reporting event types, use CSI u for all keys
    useCsiU = true;
  } else if (flags & KittyKeyboardFlags.DISAMBIGUATE_ESCAPE_CODES) {
    // Modifier-only keys are never reported without REPORT_EVENT_TYPES
    if (isMod) {
      return result;
    }
    // Use CSI u for keys that would be ambiguous in legacy encoding
    if (keyCode === 27 || keyCode === 127 || keyCode === 13) {
      // Escape, Backspace, Enter
      useCsiU = true;
    } else if (keyCode === 9 && ev.shiftKey) {
      // Shift+Tab
      useCsiU = true;
    } else if (isFunc) {
      useCsiU = true;
    } else if (modifiers > 0) {
      // Any modified key
      useCsiU = true;
    }
  }

  // Determine if we should report this event type
  const reportEventTypes = !!(flags & KittyKeyboardFlags.REPORT_EVENT_TYPES);
  if (!reportEventTypes && eventType === KittyKeyboardEventType.RELEASE) {
    // Don't report release events unless flag is set
    return result;
  }

  if (useCsiU) {
    // Build CSI u sequence: CSI keycode ; modifiers:event-type u
    // Format: CSI <keycode>[:<shifted>][:<base>] ; <modifiers>[:<event>] u
    let seq = C0.ESC + '[' + keyCode;

    // Check if we need associated text (press and repeat events, not release)
    const reportAssociatedText = !!(flags & KittyKeyboardFlags.REPORT_ASSOCIATED_TEXT) &&
      eventType !== KittyKeyboardEventType.RELEASE && ev.key.length === 1 && !isFunc && !isMod;
    const textCode = reportAssociatedText ? ev.key.codePointAt(0) : undefined;

    // When text is present, don't include event type marker (even for repeat)
    // Release events always need event type marker
    const needsEventType = reportEventTypes && eventType !== KittyKeyboardEventType.PRESS && textCode === undefined;
    if (modifiers > 0 || needsEventType || textCode !== undefined) {
      seq += ';';
      // Use 1 as base when event type needed but no modifiers (kitty format: 1 + modifier_bits)
      if (modifiers > 0) {
        seq += modifiers;
      } else if (needsEventType) {
        seq += '1';
      }
      if (needsEventType) {
        seq += ':' + eventType;
      }
    }

    // Add associated text if requested
    if (textCode !== undefined) {
      seq += ';' + textCode;
    }

    seq += 'u';
    result.key = seq;
    result.cancel = true;
  } else {
    // Legacy-compatible encoding for text keys without modifiers
    if (ev.key.length === 1 && !ev.ctrlKey && !ev.altKey && !ev.metaKey) {
      result.key = ev.key;
    }
    // Otherwise no key sequence (will fall through to legacy handling)
  }

  return result;
}

/**
 * Check if a keyboard event should be handled by Kitty protocol.
 * Returns true if Kitty flags are active and the event should use Kitty encoding.
 */
export function shouldUseKittyProtocol(flags: number): boolean {
  return flags > 0;
}
