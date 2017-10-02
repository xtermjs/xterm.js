/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

/**
 * C0 control codes
 * See = https://en.wikipedia.org/wiki/C0_and_C1_control_codes
 */
export namespace C0 {
  /** Null (Caret = ^@, C = \0) */
  export const NUL = '\x00';
  /** Start of Heading (Caret = ^A) */
  export const SOH = '\x01';
  /** Start of Text (Caret = ^B) */
  export const STX = '\x02';
  /** End of Text (Caret = ^C) */
  export const ETX = '\x03';
  /** End of Transmission (Caret = ^D) */
  export const EOT = '\x04';
  /** Enquiry (Caret = ^E) */
  export const ENQ = '\x05';
  /** Acknowledge (Caret = ^F) */
  export const ACK = '\x06';
  /** Bell (Caret = ^G, C = \a) */
  export const BEL = '\x07';
  /** Backspace (Caret = ^H, C = \b) */
  export const BS  = '\x08';
  /** Character Tabulation, Horizontal Tabulation (Caret = ^I, C = \t) */
  export const HT  = '\x09';
  /** Line Feed (Caret = ^J, C = \n) */
  export const LF  = '\x0a';
  /** Line Tabulation, Vertical Tabulation (Caret = ^K, C = \v) */
  export const VT  = '\x0b';
  /** Form Feed (Caret = ^L, C = \f) */
  export const FF  = '\x0c';
  /** Carriage Return (Caret = ^M, C = \r) */
  export const CR  = '\x0d';
  /** Shift Out (Caret = ^N) */
  export const SO  = '\x0e';
  /** Shift In (Caret = ^O) */
  export const SI  = '\x0f';
  /** Data Link Escape (Caret = ^P) */
  export const DLE = '\x10';
  /** Device Control One (XON) (Caret = ^Q) */
  export const DC1 = '\x11';
  /** Device Control Two (Caret = ^R) */
  export const DC2 = '\x12';
  /** Device Control Three (XOFF) (Caret = ^S) */
  export const DC3 = '\x13';
  /** Device Control Four (Caret = ^T) */
  export const DC4 = '\x14';
  /** Negative Acknowledge (Caret = ^U) */
  export const NAK = '\x15';
  /** Synchronous Idle (Caret = ^V) */
  export const SYN = '\x16';
  /** End of Transmission Block (Caret = ^W) */
  export const ETB = '\x17';
  /** Cancel (Caret = ^X) */
  export const CAN = '\x18';
  /** End of Medium (Caret = ^Y) */
  export const EM  = '\x19';
  /** Substitute (Caret = ^Z) */
  export const SUB = '\x1a';
  /** Escape (Caret = ^[, C = \e) */
  export const ESC = '\x1b';
  /** File Separator (Caret = ^\) */
  export const FS  = '\x1c';
  /** Group Separator (Caret = ^]) */
  export const GS  = '\x1d';
  /** Record Separator (Caret = ^^) */
  export const RS  = '\x1e';
  /** Unit Separator (Caret = ^_) */
  export const US  = '\x1f';
  /** Space */
  export const SP  = '\x20';
  /** Delete (Caret = ^?) */
  export const DEL = '\x7f';
};
