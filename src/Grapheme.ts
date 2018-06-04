/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { FIRST, SECOND, THIRD, FOURTH } from './GraphemeData';
import { wcwidth } from './CharWidth';

export const enum GraphemeTypes {
  OTHER = 0,
  L = 1,
  V = 2,
  T = 3,
  LV = 4,
  LVT = 5,
  CR = 6,
  LF = 7,
  ZWJ = 8,
  PREPEND = 9,
  CONTROL = 10,
  EXTEND = 11,
  SPACINGMARK = 12,
  E_BASE = 13,
  GLUE_AFTER_ZWJ = 14,
  E_MODIFIER = 15,
  E_BASE_GAZ = 16,
  REGIONAL_INDICATOR = 17,
  ILLEGAL = 31
}

function loadFromPackedBMP(data: string, start: number, end: number): number[] | Uint8Array {
  // decode base64 and split into lengths and types strings
  const raw = (typeof atob === 'undefined')
    // nodejs
    ? new Buffer(data, 'base64').toString('binary')
    // browser - FIXME: how to test this?
    : atob(data);
  // first occurence of 0x0 marks end of lengths (null terminated)
  const lengths = raw.substring(0, raw.indexOf('\x00'));
  const types = raw.substring(raw.indexOf('\x00') + 1);

  // lookup table with 2 type entries per index position
  const table = (typeof Uint8Array === 'undefined')
    ? new Array(((end - start) >> 1) + 1)
    : new Uint8Array(((end - start) >> 1) + 1);

  // load data into lookup table
  let codepointOffset = 0;
  for (let chunkIdx = 0; chunkIdx < lengths.length; ++chunkIdx) {
    const currentLength = lengths.charCodeAt(chunkIdx);
    for (let chunkPos = 0; chunkPos < currentLength; ++chunkPos) {
      const tcode = types.charCodeAt(chunkIdx >> 1);
      const type = (chunkIdx & 1) ? tcode & 15 : tcode >> 4;
      table[(codepointOffset + chunkPos) >> 1] |= ((codepointOffset + chunkPos) & 1) ? type << 4 : type;
    }
      codepointOffset += currentLength;
  }
  return table;
}

function loadFromPackedHIGH(lookupObj: any, data: string, plane: number): void {
  const raw = (typeof atob === 'undefined')
    ? new Buffer(data, 'base64').toString('binary')
    : atob(data);

  // data bytes: [codepoint_high, codepoint_low, length, type]
  for (let i = 0; i < raw.length; i += 4) {
    let codepoint = (raw.charCodeAt(i) << 8) + raw.charCodeAt(i + 1) + 65536 * plane;
    let end = raw.charCodeAt(i + 2) + codepoint;
    let type = raw.charCodeAt(i + 3);
    for (let cp = codepoint; cp < end; ++cp) lookupObj[cp] = type;
  }
}

export const graphemeType = (function(): (codepoint: number) => GraphemeTypes {
  let BMP_LOW = null;
  let BMP_HIGH = null;
  let HIGH = null;
  return (codepoint: number): GraphemeTypes => {
    // ASCII printable shortcut
    if (31 < codepoint && codepoint < 127) return GraphemeTypes.OTHER;

    // BMP_LOW: 0 <= codepoint < 12443
    if (codepoint < 12443) {
      const table = BMP_LOW || ((): number[] | Uint8Array => {
        BMP_LOW = loadFromPackedBMP(FIRST, 0, 12443);
        return BMP_LOW;
      })();
      return (codepoint & 1) ? table[codepoint >> 1] >> 4 : table[codepoint >> 1] & 15;
    }

    // always Other: 12443 <= codepoint < 42606
    if (codepoint < 42606) return GraphemeTypes.OTHER;

    // BMP_HIGH (CJK): 42606 <= codepoint < 65536
    if (codepoint < 65536) {
      const table = BMP_HIGH || ((): number[] | Uint8Array => {
        BMP_HIGH = loadFromPackedBMP(SECOND, 42606, 65536);
        return BMP_HIGH;
      })();
      codepoint -= 42606;
      return (codepoint & 1) ? table[codepoint >> 1] >> 4 : table[codepoint >> 1] & 15;
    }

    // codepoint > 65536
    // 129502 highest in SMP (Plane 1)
    // 917504 lowest in SSP (Plane 14)
    // 921599 highest in SSP
    if (codepoint < 129503 || (917504 <= codepoint && codepoint < 921600)) {
      const lookupObj = HIGH || ((): any => {
        HIGH = Object.create(null);
        loadFromPackedHIGH(HIGH, THIRD, 1);
        loadFromPackedHIGH(HIGH, FOURTH, 14);
        return HIGH;
      })();
      return lookupObj[codepoint] || GraphemeTypes.OTHER;
    }

    // all other codepoints default to Other
    return GraphemeTypes.OTHER;
  };
})();

export const enum BreakState {
  FALSE = 32,
  TRUE = 33,
  EMOJI_EXTEND = 34, // does not break
  REGIONAL_SECOND = 35, // does not break
  SURROGATE = 36 // does not break
}

export function canBreak(current: GraphemeTypes | BreakState, previous: GraphemeTypes | BreakState): BreakState {
  if (previous === GraphemeTypes.OTHER && current === GraphemeTypes.OTHER) {
    return BreakState.TRUE;
  }
  // GB 1     sot 	÷ 	Any
  // if (previous === -1) --> handled at caller level
  //   return true;
  // GB 2     Any 	÷ 	eot
  // if (current === -1) --> handled at caller level
  //   return true;

  // GB 3     CR 	× 	LF
  if (previous === GraphemeTypes.CR && current === GraphemeTypes.LF) {
    return BreakState.FALSE;
  }

  // GB 4     (Control | CR | LF) 	÷
  if (previous === GraphemeTypes.CONTROL || previous === GraphemeTypes.CR || previous === GraphemeTypes.LF) {
    return BreakState.TRUE;
  }

  // GB 5     ÷ 	(Control | CR | LF)
  if (current === GraphemeTypes.CONTROL || current === GraphemeTypes.CR || current === GraphemeTypes.LF) {
    return BreakState.TRUE;
  }

  // GB 6     L 	× 	(L | V | LV | LVT)
  if (previous === GraphemeTypes.L && (current === GraphemeTypes.L || current === GraphemeTypes.V || current === GraphemeTypes.LV || current === GraphemeTypes.LVT)) {
    return BreakState.FALSE;
  }

  // GB 7     (LV | V) 	× 	(V | T)
  if ((previous === GraphemeTypes.LV || previous === GraphemeTypes.V) && (current === GraphemeTypes.V || current === GraphemeTypes.T)) {
    return BreakState.FALSE;
  }

  // GB 8     (LVT | T) 	× 	T
  if ((previous === GraphemeTypes.LVT || previous === GraphemeTypes.T) && current === GraphemeTypes.T) {
    return BreakState.FALSE;
  }

  // GB 9     × 	(Extend | ZWJ)
  if (current === GraphemeTypes.EXTEND || current === GraphemeTypes.ZWJ) {
    if (previous === GraphemeTypes.E_BASE || previous === GraphemeTypes.E_BASE_GAZ) {
      return BreakState.EMOJI_EXTEND;
    }
    return BreakState.FALSE;
  }

  // GB 9a    × 	SpacingMark
  if (current === GraphemeTypes.SPACINGMARK) {
    return BreakState.FALSE;
  }

  // GB 9b    Prepend 	×
  if (previous === GraphemeTypes.PREPEND) {
    return BreakState.FALSE;
  }

  // GB 10    (E_Base | EBG) Extend* 	× 	E_Modifier
  if ((previous === GraphemeTypes.E_BASE || previous === GraphemeTypes.E_BASE_GAZ) && current === GraphemeTypes.E_MODIFIER) {
    return BreakState.FALSE;
  }

  if (previous === BreakState.EMOJI_EXTEND && current === GraphemeTypes.E_MODIFIER) {
    return BreakState.FALSE;
  }

  // GB 11    ZWJ 	× 	(Glue_After_Zwj | EBG)
  if (previous === GraphemeTypes.ZWJ && (current === GraphemeTypes.GLUE_AFTER_ZWJ || current === GraphemeTypes.E_BASE_GAZ)) {
    return BreakState.FALSE;
  }

  // GB 12    sot (RI RI)* RI 	× 	RI
  // GB 13    [^RI] (RI RI)* RI 	× 	RI
  if (previous === GraphemeTypes.REGIONAL_INDICATOR && current === GraphemeTypes.REGIONAL_INDICATOR) {
    // return BreakState.False;
    return BreakState.REGIONAL_SECOND;
  }

  if (previous === BreakState.REGIONAL_SECOND && current === GraphemeTypes.REGIONAL_INDICATOR) {
    return BreakState.TRUE;
  }

  // GB 999
  return BreakState.TRUE;
}

export class GraphemeClusterIterator {
  public wcwidth: number = 0;
  private _wcwidth: number = 0;
  public breakPosition: number = -1;
  constructor(
    public data: string,
    public current: number,
    public end: number,
    public lastType: GraphemeTypes | BreakState = GraphemeTypes.CONTROL
  ) {}
  public next(): void {
    this.wcwidth = this._wcwidth;
    this._wcwidth = 0;
    for (let i = this.current; i < this.end; ++i) {
      let code = this.data.charCodeAt(i) | 0;
      if (0xD800 <= code && code <= 0xDBFF) {
        i++;
        let low = this.data.charCodeAt(i);
        if (isNaN(low)) {
          this.lastType = BreakState.SURROGATE;
          this.breakPosition = -1;
          this.current = this.end;
          i = this.end;
          return;
        }
        code = ((code - 0xD800) * 0x400) + (low - 0xDC00) + 0x10000;
      }
      this._wcwidth += wcwidth(code);
      let currentType: GraphemeTypes | BreakState = graphemeType(code);
      let breakState = canBreak(currentType, this.lastType);
      if (breakState === BreakState.TRUE) {
        this.breakPosition = (code > 65535) ? i - 1 : i;
        this.current = i + 1;
        this.lastType = currentType;
        return;
      }
      if (breakState === BreakState.REGIONAL_SECOND) {
        this.lastType = BreakState.REGIONAL_SECOND;
      } else if (breakState === BreakState.EMOJI_EXTEND) {
        this.lastType = BreakState.EMOJI_EXTEND;
      }
    }
    this.wcwidth = this._wcwidth;
    this.current = this.end + 1;
    this.breakPosition = this.end;
  }
}