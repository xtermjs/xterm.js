/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IInputDecoder, IOutputEncoder, IEncoding } from 'common/Types';

/**
 * Polyfill - Convert UTF32 codepoint into JS string.
 * Note: The built-in String.fromCodePoint happens to be much slower
 *       due to additional sanity checks. We can avoid them since
 *       we always operate on legal UTF32 (granted by the input decoders)
 *       and use this faster version instead.
 */
export function stringFromCodePoint(codePoint: number): string {
  if (codePoint > 0xFFFF) {
    codePoint -= 0x10000;
    return String.fromCharCode((codePoint >> 10) + 0xD800) + String.fromCharCode((codePoint % 0x400) + 0xDC00);
  }
  return String.fromCharCode(codePoint);
}

/**
 * Convert UTF32 char codes into JS string.
 * Basically the same as `stringFromCodePoint` but for multiple codepoints
 * in a loop (which is a lot faster).
 */
export function utf32ToString(data: Uint32Array, start: number = 0, end: number = data.length): string {
  let result = '';
  for (let i = start; i < end; ++i) {
    let codepoint = data[i];
    if (codepoint > 0xFFFF) {
      // JS strings are encoded as UTF16, thus a non BMP codepoint gets converted into a surrogate pair
      // conversion rules:
      //  - subtract 0x10000 from code point, leaving a 20 bit number
      //  - add high 10 bits to 0xD800  --> first surrogate
      //  - add low 10 bits to 0xDC00   --> second surrogate
      codepoint -= 0x10000;
      result += String.fromCharCode((codepoint >> 10) + 0xD800) + String.fromCharCode((codepoint % 0x400) + 0xDC00);
    } else {
      result += String.fromCharCode(codepoint);
    }
  }
  return result;
}

/**
 * Input decoders.
 */

/**
 * StringToUtf32 - decodes UTF16 sequences into UTF32 codepoints.
 * To keep the decoder in line with JS strings it handles single surrogates as UCS2.
 */
export class StringToUtf32 {
  private _interim: number = 0;

  /**
   * Clears interim and resets decoder to clean state.
   */
  public clear(): void {
    this._interim = 0;
  }

  /**
   * Decode JS string to UTF32 codepoints.
   * The methods assumes stream input and will store partly transmitted
   * surrogate pairs and decode them with the next data chunk.
   * Note: The method does no bound checks for target, therefore make sure
   * the provided input data does not exceed the size of `target`.
   * Returns the number of written codepoints in `target`.
   */
  decode(input: string, target: Uint32Array): number {
    const length = input.length;

    if (!length) {
      return 0;
    }

    let size = 0;
    let startPos = 0;

    // handle leftover surrogate high
    if (this._interim) {
      const second = input.charCodeAt(startPos++);
      if (0xDC00 <= second && second <= 0xDFFF) {
        target[size++] = (this._interim - 0xD800) * 0x400 + second - 0xDC00 + 0x10000;
      } else {
        // illegal codepoint (USC2 handling)
        target[size++] = this._interim;
        target[size++] = second;
      }
      this._interim = 0;
    }

    for (let i = startPos; i < length; ++i) {
      const code = input.charCodeAt(i);
      // surrogate pair first
      if (0xD800 <= code && code <= 0xDBFF) {
        if (++i >= length) {
          this._interim = code;
          return size;
        }
        const second = input.charCodeAt(i);
        if (0xDC00 <= second && second <= 0xDFFF) {
          target[size++] = (code - 0xD800) * 0x400 + second - 0xDC00 + 0x10000;
        } else {
          // illegal codepoint (USC2 handling)
          target[size++] = code;
          target[size++] = second;
        }
        continue;
      }
      target[size++] = code;
    }
    return size;
  }
}

/**
 * Utf8Decoder - decodes UTF8 byte sequences into UTF32 codepoints.
 */
export class Utf8ToUtf32 implements IInputDecoder {
  public interim: Uint8Array = new Uint8Array(3);

  /**
   * Clears interim bytes and resets decoder to clean state.
   */
  public clear(): void {
    this.interim.fill(0);
  }

  /**
   * Decodes UTF8 byte sequences in `input` to UTF32 codepoints in `target`.
   * The methods assumes stream input and will store partly transmitted bytes
   * and decode them with the next data chunk.
   * Note: The method does no bound checks for target, therefore make sure
   * the provided data chunk does not exceed the size of `target`.
   * Returns the number of written codepoints in `target`.
   */
  decode(input: Uint8Array, target: Uint32Array): number {
    const length = input.length;

    if (!length) {
      return 0;
    }

    let size = 0;
    let byte1: number;
    let byte2: number;
    let byte3: number;
    let byte4: number;
    let codepoint = 0;
    let startPos = 0;

    // handle leftover bytes
    if (this.interim[0]) {
      let discardInterim = false;
      let cp = this.interim[0];
      cp &= ((((cp & 0xE0) === 0xC0)) ? 0x1F : (((cp & 0xF0) === 0xE0)) ? 0x0F : 0x07);
      let pos = 0;
      let tmp: number;
      while ((tmp = this.interim[++pos] & 0x3F) && pos < 4) {
        cp <<= 6;
        cp |= tmp;
      }
      // missing bytes - read ahead from input
      const type = (((this.interim[0] & 0xE0) === 0xC0)) ? 2 : (((this.interim[0] & 0xF0) === 0xE0)) ? 3 : 4;
      const missing = type - pos;
      while (startPos < missing) {
        if (startPos >= length) {
          return 0;
        }
        tmp = input[startPos++];
        if ((tmp & 0xC0) !== 0x80) {
          // wrong continuation, discard interim bytes completely
          startPos--;
          discardInterim = true;
          break;
        } else {
          // need to save so we can continue short inputs in next call
          this.interim[pos++] = tmp;
          cp <<= 6;
          cp |= tmp & 0x3F;
        }
      }
      if (!discardInterim) {
        // final test is type dependent
        if (type === 2) {
          if (cp < 0x80) {
            // wrong starter byte
            startPos--;
          } else {
            target[size++] = cp;
          }
        } else if (type === 3) {
          if (cp < 0x0800 || (cp >= 0xD800 && cp <= 0xDFFF)) {
            // illegal codepoint
          } else {
            target[size++] = cp;
          }
        } else {
          if (codepoint < 0x010000 || codepoint > 0x10FFFF) {
            // illegal codepoint
          } else {
            target[size++] = cp;
          }
        }
      }
      this.interim.fill(0);
    }

    // loop through input
    const fourStop = length - 4;
    let i = startPos;
    while (i < length) {
      /**
       * ASCII shortcut with loop unrolled to 4 consecutive ASCII chars.
       * This is a compromise between speed gain for ASCII
       * and penalty for non ASCII:
       * For best ASCII performance the char should be stored directly into target,
       * but even a single attempt to write to target and compare afterwards
       * penalizes non ASCII really bad (-50%), thus we load the char into byteX first,
       * which reduces ASCII performance by ~15%.
       * This trial for ASCII reduces non ASCII performance by ~10% which seems acceptible
       * compared to the gains.
       * Note that this optimization only takes place for 4 consecutive ASCII chars,
       * for any shorter it bails out. Worst case - all 4 bytes being read but
       * thrown away due to the last being a non ASCII char (-10% performance).
       */
      while (i < fourStop
        && !((byte1 = input[i]) & 0x80)
        && !((byte2 = input[i + 1]) & 0x80)
        && !((byte3 = input[i + 2]) & 0x80)
        && !((byte4 = input[i + 3]) & 0x80))
      {
        target[size++] = byte1;
        target[size++] = byte2;
        target[size++] = byte3;
        target[size++] = byte4;
        i += 4;
      }

      // reread byte1
      byte1 = input[i++];

      // 1 byte
      if (byte1 < 0x80) {
        target[size++] = byte1;

        // 2 bytes
      } else if ((byte1 & 0xE0) === 0xC0) {
        if (i >= length) {
          this.interim[0] = byte1;
          return size;
        }
        byte2 = input[i++];
        if ((byte2 & 0xC0) !== 0x80) {
          // wrong continuation
          i--;
          continue;
        }
        codepoint = (byte1 & 0x1F) << 6 | (byte2 & 0x3F);
        if (codepoint < 0x80) {
          // wrong starter byte
          i--;
          continue;
        }
        target[size++] = codepoint;

        // 3 bytes
      } else if ((byte1 & 0xF0) === 0xE0) {
        if (i >= length) {
          this.interim[0] = byte1;
          return size;
        }
        byte2 = input[i++];
        if ((byte2 & 0xC0) !== 0x80) {
          // wrong continuation
          i--;
          continue;
        }
        if (i >= length) {
          this.interim[0] = byte1;
          this.interim[1] = byte2;
          return size;
        }
        byte3 = input[i++];
        if ((byte3 & 0xC0) !== 0x80) {
          // wrong continuation
          i--;
          continue;
        }
        codepoint = (byte1 & 0x0F) << 12 | (byte2 & 0x3F) << 6 | (byte3 & 0x3F);
        if (codepoint < 0x0800 || (codepoint >= 0xD800 && codepoint <= 0xDFFF)) {
          // illegal codepoint, no i-- here
          continue;
        }
        target[size++] = codepoint;

        // 4 bytes
      } else if ((byte1 & 0xF8) === 0xF0) {
        if (i >= length) {
          this.interim[0] = byte1;
          return size;
        }
        byte2 = input[i++];
        if ((byte2 & 0xC0) !== 0x80) {
          // wrong continuation
          i--;
          continue;
        }
        if (i >= length) {
          this.interim[0] = byte1;
          this.interim[1] = byte2;
          return size;
        }
        byte3 = input[i++];
        if ((byte3 & 0xC0) !== 0x80) {
          // wrong continuation
          i--;
          continue;
        }
        if (i >= length) {
          this.interim[0] = byte1;
          this.interim[1] = byte2;
          this.interim[2] = byte3;
          return size;
        }
        byte4 = input[i++];
        if ((byte4 & 0xC0) !== 0x80) {
          // wrong continuation
          i--;
          continue;
        }
        codepoint = (byte1 & 0x07) << 18 | (byte2 & 0x3F) << 12 | (byte3 & 0x3F) << 6 | (byte4 & 0x3F);
        if (codepoint < 0x010000 || codepoint > 0x10FFFF) {
          // illegal codepoint, no i-- here
          continue;
        }
        target[size++] = codepoint;
      } else {
        // illegal byte, just skip
      }
    }
    return size;
  }
}

/**
 * ASCII decoder - decodes bytes into UTF32 codepoints stripping the high bit.
 */
export class AsciiToUtf32 implements IInputDecoder {
  public decode(data: Uint8Array, target: Uint32Array): number {
    for (let i = 0; i < data.length; ++i) {
      target[i] = data[i] & 0x7F;
    }
    return data.length;
  }
}

/**
 * Binary decoder - decodes bytes into UTF32 codepoints.
 * Also used for ISO-8859-1 / LATIN-1.
 */
export class BinaryToUtf32 implements IInputDecoder {
  public decode(data: Uint8Array, target: Uint32Array): number {
    for (let i = 0; i < data.length; ++i) {
      target[i] = data[i];
    }
    return data.length;
  }
}

/**
 * ISO-8859-15 decoder.
 */
export class ISO15ToUtf32 implements IInputDecoder {
  private _table: Uint32Array;
  constructor() {
    this._table = new Uint32Array(256);
    for (let i = 0; i < 256; ++i) {
      this._table[i] = i;
    }
    // apply deviations from latin1
    this._table[0xA4] = 0x20AC;
    this._table[0xA6] = 0x160;
    this._table[0xA8] = 0x161;
    this._table[0xB4] = 0x17D;
    this._table[0xB8] = 0x17E;
    this._table[0xBC] = 0x152;
    this._table[0xBD] = 0x153;
    this._table[0xBE] = 0x178;
  }
  public decode(data: Uint8Array, target: Uint32Array): number {
    for (let i = 0; i < data.length; ++i) {
      target[i] = this._table[data[i]];
    }
    return data.length;
  }
}

/**
 * Windows 1252 decoder.
 * Note: This encoding is often seen as equivalent to ISO-8859-1 in
 * text editors, which is not true in a terminal environment due to
 * the overloaded C1 meanings.
 */
export class Windows1252ToUtf32 implements IInputDecoder {
  private _table: Uint32Array;
  constructor() {
    this._table = new Uint32Array(256);
    for (let i = 0; i < 256; ++i) {
      this._table[i] = i;
    }
    // apply deviations from latin1
    this._table[0x80] = 0x20AC;
    this._table[0x8A] = 0x160;
    this._table[0x9A] = 0x161;
    this._table[0x8E] = 0x17D;
    this._table[0x9E] = 0x17E;
    this._table[0x8C] = 0x152;
    this._table[0x9C] = 0x153;
    this._table[0x9F] = 0x178;
  }
  public decode(data: Uint8Array, target: Uint32Array): number {
    for (let i = 0; i < data.length; ++i) {
      target[i] = this._table[data[i]];
    }
    return data.length;
  }
}


/**
 * Output encoders.
 */

/**
 * Utf8 encoder.
 * Note: Does not have its own implementation, instead relies
 * on TextEncoder in the browser and Buffer in nodejs.
 */
export class Utf8Encoder implements IOutputEncoder {
  private _encode: (data: string) => Uint8Array;
  constructor() {
    // use system encoders on nodejs and browser
    const GLOBAL_OBJECT = Function('return this')();
    if (GLOBAL_OBJECT.TextEncoder) {
      const te = new GLOBAL_OBJECT.TextEncoder();
      this._encode = te.encode.bind(te);
    } else if (GLOBAL_OBJECT.Buffer) {
      this._encode = GLOBAL_OBJECT.Buffer.from.bind(GLOBAL_OBJECT.Buffer);
    } else {
      throw new Error('missing string to UTF8 converter');
    }
  }
  encode(data: string): Uint8Array {
    return this._encode(data);
  }
}

/**
 * Ascii encoder.
 * Note: Replaces any codepoint > 0x7F with a question mark.
 */
class AsciiEncoder implements IOutputEncoder {
  encode(data: string): Uint8Array {
    const result = new Uint8Array(data.length);
    for (let i = 0; i < result.length; ++i) {
      const code = data.charCodeAt(i);
      result[i] = (code > 0x7F) ? 0x3F : code; // '?' replacement
    }
    return result;
  }
}

/**
 * Ascii encoder.
 * Note: Replaces any codepoint > 0xFF with a question mark.
 */
class BinaryEncoder implements IOutputEncoder {
  encode(data: string): Uint8Array {
    const result = new Uint8Array(data.length);
    for (let i = 0; i < result.length; ++i) {
      const code = data.charCodeAt(i);
      result[i] = (code > 0xFF) ? 0x3F : code; // '?' replacement
    }
    return result;
  }
}

/**
 * ISO-8859-15 encoder.
 * Note: Replaces unkown / non encodable codepoints with a question mark.
 */
class ISO15Encoder implements IOutputEncoder {
  private _table: {[key: number]: number};
  constructor() {
    this._table = Object.create(null);
    for (let i = 0; i < 256; ++i) {
      this._table[i] = i;
    }
    // apply deviations from latin1
    this._table[0x20AC] = 0xA4;
    this._table[0x160] = 0xA6;
    this._table[0x161] = 0xA8;
    this._table[0x17D] = 0xB4;
    this._table[0x17E] = 0xB8;
    this._table[0x152] = 0xBC;
    this._table[0x153] = 0xBD;
    this._table[0x178] = 0xBE;

    // delete wrong entries
    delete this._table[0xA4];
    delete this._table[0xA6];
    delete this._table[0xA8];
    delete this._table[0xB4];
    delete this._table[0xB8];
    delete this._table[0xBC];
    delete this._table[0xBD];
    delete this._table[0xBE];
  }
  encode(data: string): Uint8Array {
    const result = new Uint8Array(data.length);
    for (let i = 0; i < data.length; ++i) {
      result[i] = this._table[data.charCodeAt(i)] || 0x3F; // '?' replacement
    }
    return result;
  }
}

/**
 * Windows-1252 encoder.
 * Note: Replaces unkown / non encodable codepoints with a question mark.
 */
class Windows1252Encoder implements IOutputEncoder {
  private _table: {[key: number]: number};
  constructor() {
    this._table = Object.create(null);
    for (let i = 0; i < 256; ++i) {
      this._table[i] = i;
    }
    // apply deviations from latin1
    this._table[0x20AC] = 0x80;
    this._table[0x160] = 0x8A;
    this._table[0x161] = 0x9A;
    this._table[0x17D] = 0x8E;
    this._table[0x17E] = 0x9E;
    this._table[0x152] = 0x8C;
    this._table[0x153] = 0x9C;
    this._table[0x178] = 0x9F;

    // delete wrong entries
    delete this._table[0x80];
    delete this._table[0x8A];
    delete this._table[0x9A];
    delete this._table[0x8E];
    delete this._table[0x9E];
    delete this._table[0x8C];
    delete this._table[0x9C];
    delete this._table[0x9F];
  }
  encode(data: string): Uint8Array {
    const result = new Uint8Array(data.length);
    for (let i = 0; i < data.length; ++i) {
      result[i] = this._table[data.charCodeAt(i)] || 0x3F; // '?' replacement
    }
    return result;
  }
}

/**
 * Encodings supported by default.
 */
export const DEFAULT_ENCODINGS: IEncoding[] = [
  {
    name: 'ascii',
    aliases: ['7bit', '7-bit'],
    decoder: AsciiToUtf32,
    encoder: AsciiEncoder
  },
  {
    name: 'iso-8859-1',
    aliases: ['latin-1', 'latin1', 'binary', '8bit', '8-bit'],
    decoder: BinaryToUtf32,
    encoder: BinaryEncoder
  },
  {
    name: 'iso-8859-15',
    aliases: [],
    decoder: ISO15ToUtf32,
    encoder: ISO15Encoder
  },
  {
    name: 'windows-1252',
    aliases: ['cp1252', 'cp-1252'],
    decoder: Windows1252ToUtf32,
    encoder: Windows1252Encoder
  },
  {
    name: 'utf-8',
    aliases: ['utf8', 'UTF8', 'UTF-8'],
    decoder: Utf8ToUtf32,
    encoder: Utf8Encoder
  }
];
