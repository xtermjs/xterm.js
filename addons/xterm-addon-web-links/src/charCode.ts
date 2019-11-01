// Names from https://blog.codinghorror.com/ascii-pronunciation-rules-for-programmers/

/**
 * An inlined enum containing useful character codes (to be used with String.charCodeAt).
 * Please leave the const keyword such that it gets inlined when compiled to JavaScript!
 */
export const enum CharCode {
  NULL = 0,
  /**
	 * The `\b` character.
	 */
  BACKSPACE = 8,
  /**
	 * The `\t` character.
	 */
  TAB = 9,
  /**
	 * The `\n` character.
	 */
  LINE_FEED = 10,
  /**
	 * The `\r` character.
	 */
  CARRIAGE_RETURN = 13,
  SPACE = 32,
  /**
	 * The `!` character.
	 */
  EXCLAMATION_MARK = 33,
  /**
	 * The `"` character.
	 */
  DOUBLE_QUOTE = 34,
  /**
	 * The `#` character.
	 */
  HASH = 35,
  /**
	 * The `$` character.
	 */
  DOLLAR_SIGN = 36,
  /**
	 * The `%` character.
	 */
  PERCENT_SIGN = 37,
  /**
	 * The `&` character.
	 */
  AMPERSAND = 38,
  /**
	 * The `'` character.
	 */
  SINGLE_QUOTE = 39,
  /**
	 * The `(` character.
	 */
  OPEN_PAREN = 40,
  /**
	 * The `)` character.
	 */
  CLOSE_PAREN = 41,
  /**
	 * The `*` character.
	 */
  ASTERISK = 42,
  /**
	 * The `+` character.
	 */
  PLUS = 43,
  /**
	 * The `,` character.
	 */
  COMMA = 44,
  /**
	 * The `-` character.
	 */
  DASH = 45,
  /**
	 * The `.` character.
	 */
  PERIOD = 46,
  /**
	 * The `/` character.
	 */
  SLASH = 47,

  DIGIT_0 = 48,
  DIGIT_1 = 49,
  DIGIT_2 = 50,
  DIGIT_3 = 51,
  DIGIT_4 = 52,
  DIGIT_5 = 53,
  DIGIT_6 = 54,
  DIGIT_7 = 55,
  DIGIT_8 = 56,
  DIGIT_9 = 57,

  /**
	 * The `:` character.
	 */
  COLON = 58,
  /**
	 * The `;` character.
	 */
  SEMICOLON = 59,
  /**
	 * The `<` character.
	 */
  LESS_THAN = 60,
  /**
	 * The `=` character.
	 */
  EQUALS = 61,
  /**
	 * The `>` character.
	 */
  GREATER_THAN = 62,
  /**
	 * The `?` character.
	 */
  QUESTION_MARK = 63,
  /**
	 * The `@` character.
	 */
  AT_SIGN = 64,

  A = 65,
  B = 66,
  C = 67,
  D = 68,
  E = 69,
  F = 70,
  G = 71,
  H = 72,
  I = 73,
  J = 74,
  K = 75,
  L = 76,
  M = 77,
  N = 78,
  O = 79,
  P = 80,
  Q = 81,
  R = 82,
  S = 83,
  T = 84,
  U = 85,
  V = 86,
  W = 87,
  X = 88,
  Y = 89,
  Z = 90,

  /**
	 * The `[` character.
	 */
  OPEN_SQUARE_BRACKET = 91,
  /**
	 * The `\` character.
	 */
  BACK_SLASH = 92,
  /**
	 * The `]` character.
	 */
  CLOSE_SQUARE_BRACKET = 93,
  /**
	 * The `^` character.
	 */
  CARET = 94,
  /**
	 * The `_` character.
	 */
  UNDERLINE = 95,
  /**
	 * The ``(`)`` character.
	 */
  BACK_TICK = 96,

  a = 97,
  b = 98,
  c = 99,
  d = 100,
  e = 101,
  f = 102,
  g = 103,
  h = 104,
  i = 105,
  j = 106,
  k = 107,
  l = 108,
  m = 109,
  n = 110,
  o = 111,
  p = 112,
  q = 113,
  r = 114,
  s = 115,
  t = 116,
  u = 117,
  v = 118,
  w = 119,
  x = 120,
  y = 121,
  z = 122,

  /**
	 * The `{` character.
	 */
  OPEN_CURLY_BRACE = 123,
  /**
	 * The `|` character.
	 */
  PIPE = 124,
  /**
	 * The `}` character.
	 */
  CLOSE_CURLY_BRACE = 125,
  /**
	 * The `~` character.
	 */
  TILDE = 126,

  /**
	 * Unicode Character 'LINE SEPARATOR' (U+2028)
	 * http://www.fileformat.info/info/unicode/char/2028/index.htm
	 */
  LINE_SEPARATOR_2028 = 8232,

  U_OVERLINE = 0x203E, // Unicode Character 'OVERLINE'

  /**
	 * UTF-8 BOM
	 * Unicode Character 'ZERO WIDTH NO-BREAK SPACE' (U+FEFF)
	 * http://www.fileformat.info/info/unicode/char/feff/index.htm
	 */
  UTF8_BOM = 65279
}
