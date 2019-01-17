/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 */

import { Terminal } from 'xterm';

export function registerRtlCharacterJoiners(terminal: Terminal): void {
  // Hebrew
  terminal.registerCharacterJoiner(createUnicodeRangeJoiner(0x0590, 0x05FF));
  // Arabic (Kurdish, Persian, Urdu)
  terminal.registerCharacterJoiner(createUnicodeRangeJoiner(0x0600, 0x06FF));
  // Arabic Supplement
  terminal.registerCharacterJoiner(createUnicodeRangeJoiner(0x0750, 0x077F));
  // Thanana (Dhivehi, Maldavian)
  terminal.registerCharacterJoiner(createUnicodeRangeJoiner(0x0780, 0x07BF));
  // Arabic Extended-A
  terminal.registerCharacterJoiner(createUnicodeRangeJoiner(0x08A0, 0x08FF));
  // Arabic Presentation Forms-A
  terminal.registerCharacterJoiner(createUnicodeRangeJoiner(0xFB50, 0xFDFF));
  // Arabic Presentation Forms-B
  terminal.registerCharacterJoiner(createUnicodeRangeJoiner(0xFE70, 0xFEFF));
  // Rumi Numeral Symbols
  terminal.registerCharacterJoiner(createUnicodeRangeJoiner(0x10E60, 0x10E60));
  // Arabic Mathematical Alphabetic Symbols
  terminal.registerCharacterJoiner(createUnicodeRangeJoiner(0x1EE00, 0x1EEFF));
}

function createUnicodeRangeJoiner(rangeStart: number, rangeEnd: number): (text: string) => [number, number][] {
  return (text: string) => {
    let start = -1;
    let length = 0;
    const result: [number, number][] = [];
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code >= rangeStart && code <= rangeEnd) {
        if (start === -1) {
          start = i;
        }
        length++;
      } else if (length > 1) {
        result.push([start, start + length + 1]);
        start = -1;
        length = 0;
      }
    }
    if (length > 0) {
      result.push([start, start + length + 1]);
    }
    return result;
  };
}
