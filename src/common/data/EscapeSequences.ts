/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

/**
 * C0 control codes
 * See = https://en.wikipedia.org/wiki/C0_and_C1_control_codes
 */
export const enum C0 {
  /** Null (Caret = ^@, C = \0) */
  NUL = '\x00',
  /** Start of Heading (Caret = ^A) */
  SOH = '\x01',
  /** Start of Text (Caret = ^B) */
  STX = '\x02',
  /** End of Text (Caret = ^C) */
  ETX = '\x03',
  /** End of Transmission (Caret = ^D) */
  EOT = '\x04',
  /** Enquiry (Caret = ^E) */
  ENQ = '\x05',
  /** Acknowledge (Caret = ^F) */
  ACK = '\x06',
  /** Bell (Caret = ^G, C = \a) */
  BEL = '\x07',
  /** Backspace (Caret = ^H, C = \b) */
  BS = '\x08',
  /** Character Tabulation, Horizontal Tabulation (Caret = ^I, C = \t) */
  HT = '\x09',
  /** Line Feed (Caret = ^J, C = \n) */
  LF = '\x0a',
  /** Line Tabulation, Vertical Tabulation (Caret = ^K, C = \v) */
  VT = '\x0b',
  /** Form Feed (Caret = ^L, C = \f) */
  FF = '\x0c',
  /** Carriage Return (Caret = ^M, C = \r) */
  CR = '\x0d',
  /** Shift Out (Caret = ^N) */
  SO = '\x0e',
  /** Shift In (Caret = ^O) */
  SI = '\x0f',
  /** Data Link Escape (Caret = ^P) */
  DLE = '\x10',
  /** Device Control One (XON) (Caret = ^Q) */
  DC1 = '\x11',
  /** Device Control Two (Caret = ^R) */
  DC2 = '\x12',
  /** Device Control Three (XOFF) (Caret = ^S) */
  DC3 = '\x13',
  /** Device Control Four (Caret = ^T) */
  DC4 = '\x14',
  /** Negative Acknowledge (Caret = ^U) */
  NAK = '\x15',
  /** Synchronous Idle (Caret = ^V) */
  SYN = '\x16',
  /** End of Transmission Block (Caret = ^W) */
  ETB = '\x17',
  /** Cancel (Caret = ^X) */
  CAN = '\x18',
  /** End of Medium (Caret = ^Y) */
  EM = '\x19',
  /** Substitute (Caret = ^Z) */
  SUB = '\x1a',
  /** Escape (Caret = ^[, C = \e) */
  ESC = '\x1b',
  /** File Separator (Caret = ^\) */
  FS = '\x1c',
  /** Group Separator (Caret = ^]) */
  GS = '\x1d',
  /** Record Separator (Caret = ^^) */
  RS = '\x1e',
  /** Unit Separator (Caret = ^_) */
  US = '\x1f',
  /** Space */
  SP = '\x20',
  /** Delete (Caret = ^?) */
  DEL = '\x7f'
}

/**
 * C1 control codes
 * See = https://en.wikipedia.org/wiki/C0_and_C1_control_codes
 */
export const enum C1 {
  /** padding character */
  PAD = '\x80',
  /** High Octet Preset */
  HOP = '\x81',
  /** Break Permitted Here */
  BPH = '\x82',
  /** No Break Here */
  NBH = '\x83',
  /** Index */
  IND = '\x84',
  /** Next Line */
  NEL = '\x85',
  /** Start of Selected Area */
  SSA = '\x86',
  /** End of Selected Area */
  ESA = '\x87',
  /** Horizontal Tabulation Set */
  HTS = '\x88',
  /** Horizontal Tabulation With Justification */
  HTJ = '\x89',
  /** Vertical Tabulation Set */
  VTS = '\x8a',
  /** Partial Line Down */
  PLD = '\x8b',
  /** Partial Line Up */
  PLU = '\x8c',
  /** Reverse Index */
  RI = '\x8d',
  /** Single-Shift 2 */
  SS2 = '\x8e',
  /** Single-Shift 3 */
  SS3 = '\x8f',
  /** Device Control String */
  DCS = '\x90',
  /** Private Use 1 */
  PU1 = '\x91',
  /** Private Use 2 */
  PU2 = '\x92',
  /** Set Transmit State */
  STS = '\x93',
  /** Destructive backspace, intended to eliminate ambiguity about meaning of BS. */
  CCH = '\x94',
  /** Message Waiting */
  MW = '\x95',
  /** Start of Protected Area */
  SPA = '\x96',
  /** End of Protected Area */
  EPA = '\x97',
  /** Start of String */
  SOS = '\x98',
  /** Single Graphic Character Introducer */
  SGCI = '\x99',
  /** Single Character Introducer */
  SCI = '\x9a',
  /** Control Sequence Introducer */
  CSI = '\x9b',
  /** String Terminator */
  ST = '\x9c',
  /** Operating System Command */
  OSC = '\x9d',
  /** Privacy Message */
  PM = '\x9e',
  /** Application Program Command */
  APC = '\x9f'
}

export const enum C1ESCAPED {
  ST = '\x1b\\'
}
