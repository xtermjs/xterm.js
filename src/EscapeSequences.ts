/**
 * C0 control codes
 * See: https://en.wikipedia.org/wiki/C0_and_C1_control_codes
 */
export const C0 = {
  /** Null (Caret: ^@, C: \0) */
  NUL: '\x00',
  /** Start of Heading (Caret: ^A) */
  SOH: '\x01',
  /** Start of Text (Caret: ^B) */
  STX: '\x02',
  /** End of Text (Caret: ^C) */
  ETX: '\x03',
  /** End of Transmission (Caret: ^D) */
  EOT: '\x04',
  /** Enquiry (Caret: ^E) */
  ENQ: '\x05',
  /** Acknowledge (Caret: ^F) */
  ACK: '\x06',
  /** Bell (Caret: ^G, C: \a) */
  BEL: '\x07',
  /** Backspace (Caret: ^H, C: \b) */
  BS:  '\x08',
  /** Character Tabulation, Horizontal Tabulation (Caret: ^I, C: \t) */
  HT:  '\x09',
  /** Line Feed (Caret: ^J, C: \n) */
  LF:  '\x0a',
  /** Line Tabulation, Vertical Tabulation (Caret: ^K, C: \v) */
  VT:  '\x0b',
  /** Form Feed (Caret: ^L, C: \f) */
  FF:  '\x0c',
  /** Carriage Return (Caret: ^M, C: \r) */
  CR:  '\x0d',
  /** Shift Out (Caret: ^N) */
  SO:  '\x0e',
  /** Shift In (Caret: ^O) */
  SI:  '\x0f',
  /** Data Link Escape (Caret: ^P) */
  DLE: '\x10',
  /** Device Control One (XON) (Caret: ^Q) */
  DC1: '\x11',
  /** Device Control Two (Caret: ^R) */
  DC2: '\x12',
  /** Device Control Three (XOFF) (Caret: ^S) */
  DC3: '\x13',
  /** Device Control Four (Caret: ^T) */
  DC4: '\x14',
  /** Negative Acknowledge (Caret: ^U) */
  NAK: '\x15',
  /** Synchronous Idle (Caret: ^V) */
  SYN: '\x16',
  /** End of Transmission Block (Caret: ^W) */
  ETB: '\x17',
  /** Cancel (Caret: ^X) */
  CAN: '\x18',
  /** End of Medium (Caret: ^Y) */
  EM:  '\x19',
  /** Substitute (Caret: ^Z) */
  SUB: '\x1a',
  /** Escape (Caret: ^[, C: \e) */
  ESC: '\x1b',
  /** File Separator (Caret: ^\) */
  FS:  '\x1c',
  /** Group Separator (Caret: ^]) */
  GS:  '\x1d',
  /** Record Separator (Caret: ^^) */
  RS:  '\x1e',
  /** Unit Separator (Caret: ^_) */
  US:  '\x1f',
  /** Space */
  SP:  '\x20',
  /** Delete (Caret: ^?) */
  DEL: '\x7f'
};
