/**
 * @license MIT
 */

// TODO: Give CHARSETS a proper type
/**
 * The character sets supported by the terminal. These enable several languages
 * to be represented within the terminal with only 8-bit encoding. See ISO 2022
 * for a discussion on character sets.
 */
export const CHARSETS: any = {};

// DEC Special Character and Line Drawing Set.
// http://vt100.net/docs/vt102-ug/table5-13.html
// A lot of curses apps use this if they see TERM=xterm.
// testing: echo -e '\e(0a\e(B'
// The xterm output sometimes seems to conflict with the
// reference above. xterm seems in line with the reference
// when running vttest however.
// The table below now uses xterm's output from vttest.
CHARSETS.SCLD = { // (0
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

CHARSETS.UK = null; // (A
CHARSETS.US = null; // (B (USASCII)
CHARSETS.Dutch = null; // (4
CHARSETS.Finnish = null; // (C or (5
CHARSETS.French = null; // (R
CHARSETS.FrenchCanadian = null; // (Q
CHARSETS.German = null; // (K
CHARSETS.Italian = null; // (Y
CHARSETS.NorwegianDanish = null; // (E or (6
CHARSETS.Spanish = null; // (Z
CHARSETS.Swedish = null; // (H or (7
CHARSETS.Swiss = null; // (=
CHARSETS.ISOLatin = null; // /A
