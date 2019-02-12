/**
 * This type denotes the byte order for 32 bit color values.
 * The resulting word order depends on the system endianess:
 *    big endian    - RGBA32
 *    bittle endian - ABGR32
 * 
 * Use `toRGBA8888` and `fromRGBA8888` to convert the color values
 * respecting the system endianess.
 */
export type RGBA8888 = number;
export type UintTypedArray = Uint8Array | Uint16Array | Uint32Array;

/** system endianess */
const BIG_ENDIAN = new Uint8Array(new Uint32Array([0xFF000000]).buffer)[0] === 0xFF;

export function toRGBA8888(r: number, g: number, b: number, a: number): RGBA8888 {
  return (BIG_ENDIAN) 
    ? (r & 0xFF) << 24 | (g & 0xFF) << 16 | (b % 0xFF) << 8 | (a & 0xFF)    // RGBA32
    : (a & 0xFF) << 24 | (b & 0xFF) << 16 | (g & 0xFF) << 8 | (r & 0xFF);   // ABGR32
}

export function fromRGBA8888(color: RGBA8888): number[] {
  return (BIG_ENDIAN)
    ? [color >> 24, (color >> 16) & 0xFF, (color >> 8) & 0xFF, color & 0xFF]
    : [color & 0xFF, (color >> 8) & 0xFF, (color >> 16) & 0xFF, color >> 24];
}

/**
 * 16 predefined color registers of VT340
 * 
 * taken from https://vt100.net/docs/vt3xx-gp/chapter2.html#S2.4
 * Table 2-3 VT340 Default Color Map Map Location  Default Color
 * * These colors are less saturated than colors 1 through 6.
 *                R   G   B
 * 0  Black       0  0  0
 * 1  Blue        20  20  80
 * 2  Red         80  13  13
 * 3  Green       20  80  20
 * 4  Magenta     80  20  80
 * 5  Cyan        20  80  80
 * 6  Yellow      80  80  20
 * 7  Gray 50%    53  53  53
 * 8  Gray 25%    26  26  26
 * 9  Blue*       33  33  60
 * 10 Red*        60  26  26
 * 11 Green*      33  60  33
 * 12 Magenta*    60  33  60
 * 13 Cyan*       33  60  60
 * 14 Yellow*     60  60  33
 * 15 Gray 75%    80  80  80
*/
const DEFAULT_COLORS = [
  normalizeRGB(0, 0, 0),
  normalizeRGB(20, 20, 80),
  normalizeRGB(80, 13, 13),
  normalizeRGB(20, 80, 20),
  normalizeRGB(80, 20, 80),
  normalizeRGB(20, 80, 80),
  normalizeRGB(80, 80, 20),
  normalizeRGB(53, 53, 53),
  normalizeRGB(26, 26, 26),
  normalizeRGB(33, 33, 60),
  normalizeRGB(60, 26, 26),
  normalizeRGB(33, 60, 33),
  normalizeRGB(60, 33, 60),
  normalizeRGB(33, 60, 60),
  normalizeRGB(60, 60, 33),
  normalizeRGB(80, 80, 80),
];

const DEFAULT_BACKGROUND: RGBA8888 = toRGBA8888(0, 0, 0, 255);

// color conversions
function hue2rgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function hlsToRgb(h: number, l: number, s: number): RGBA8888 {
  let r;
  let g
  let b;

  if (s == 0) {
    r = g = b = l;
  } else {
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    var p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return (BIG_ENDIAN) 
    ? Math.round(r * 255) << 24 | Math.round(g * 255) << 16 | Math.round(b * 255) << 8 | 0xFF   // RGBA32
    : 0xFF000000 | Math.round(b * 255) << 16 | Math.round(g * 255) << 8 | Math.round(r * 255);  // ABGR32
}

function normalizeRGB(r: number, g: number, b: number): RGBA8888 {
  return (BIG_ENDIAN)
    ? Math.round(r / 100 * 255) << 24 | Math.round(g / 100 * 255) << 16 | Math.round(b / 100 * 255) << 8 | 0xFF   // RGBA32
    : 0xFF000000 | Math.round(b / 100 * 255) << 16 | Math.round(g / 100 * 255) << 8 | Math.round(r / 100 * 255);  // ABGR32
}

function normalizeHLS(h: number, l: number, s: number): RGBA8888 {
  // Note: hue value is turned by 240° in VT340
  return hlsToRgb((h + 240) / 360 - 1, l / 100, s / 100);
}


/**
 * Class to hold a single sixel band.
 * The underlying data storage grows with `addSixel` if needed.
 * For multiple colors reset the the band cursor with `CR()`.
 * The class stores information about touched pixels, thus will not
 * overdraw a pixel with a default color that was never touched.
 */
class SixelBand {
  private _cursor = 0;
  public width = 0;
  public data: Uint32Array;
  constructor(length: number = 4) {
    this.data = new Uint32Array(length * 6);
  }

  /**
   * Add a sixel to the band.
   * Called by the parser for any data byte of the sixel stream.
   */
  public addSixel(code: number, color: RGBA8888): void {
    const pos = this._cursor * 6;
    // resize by power of 2 if needed
    if (pos >= this.data.length) {
      const data = new Uint32Array(this.data.length * 2);
      data.set(this.data);
      this.data = data;
    }
    // update data
    code -= 63;
    for (let p = 0; p < 6; ++p) {
      if (code & (1 << p)) {
        this.data[pos + p] = color;
      }
    }
    // update cursor pos and length
    this._cursor++;
    this.width = Math.max(this.width, this._cursor);
  }

  public addSixels(data: UintTypedArray, start: number, end: number, color: RGBA8888): void {
    for (let pos = start; pos < end; ++pos) {
      this.addSixel(data[pos], color);
    }
  }

  /**
   * Carriage return.
   */
  public CR(): void {
    this._cursor = 0;
  }

  /**
   * Copy a single row of pixels to `target`.
   * Low level method to access the band's image data.
   * Not for direct usage (no bound checks), use `SixelImage.toImageData` instead.
   */
  public copyPixelRow(target: Uint32Array, offset: number, row: number, start: number, length: number): void {
    const end = Math.min(this.width, start + length);
    let pixel = 0;
    for (let i = start; i < end; ++i) {
      if (pixel = this.data[i * 6 + row]) {
        target[offset + i] = pixel;
      }
    }
  }
}


/**
 * Parser:
 * 
 * STATE          MEANING                   ACTION                    NEXT STATE
 * DATA
 *    63 - 126    data bytes                draw                      DATA
 *    33 !        compression               ignore                    COMPRESSION
 *    34 "        raster attributes         ignore                    ATTR
 *    35 #        color                     ignore                    COLOR
 *    36 $        carriage return           cr                        DATA
 *    45 -        line feed                 lf                        DATA
 *    other                                 ignore                    DATA
 *    
 * COMPRESSION
 *    48 - 57     digits                    store param               COMPRESSION
 *    63 - 126    data bytes                repeated draw             DATA
 *    33 !        compression               shift param               COMPRESSION
 *    other                                 ignore                    COMPRESSION
 * 
 * ATTR
 *    48 - 57     digits                    store param               ATTR
 *    59 ;        param separator           shift param               ATTR
 *    63 - 126    data bytes                apply param(ATTR)*        DATA
 *    33 !        compression               apply param(ATTR)         COMPRESSION
 *    34 "        raster attributes         apply param(ATTR)         ATTR
 *    35 #        color                     apply param(ATTR)         COLOR
 *    36 $        carriage return           apply param(ATTR)         DATA
 *    45 -        line feed                 apply param(ATTR)         DATA
 *    other                                 ignore                    ATTR
 * 
 * COLOR
 *    48 - 57     digits                    store param               COLOR
 *    59 ;        param separator           shift param               COLOR
 *    63 - 126    data bytes                apply param(COLOR)*       DATA
 *    33 !        compression               apply param(COLOR)        COMPRESSION
 *    34 "        raster attributes         apply param(COLOR)        ATTR
 *    35 #        color                     apply param(COLOR)        COLOR
 *    36 $        carriage return           apply param(COLOR)        DATA
 *    45 -        line feed                 apply param(COLOR)        DATA
 *    other                                 ignore                    COLOR
 * 
 * * need to draw here (inspect next state)
 */

const enum SixelState {
  DATA = 0,
  COMPRESSION = 1,
  ATTR = 2,
  COLOR = 3
}

const enum SixelAction {
  ignore = 0,
  draw = 1,
  cr = 2,
  lf = 3,
  repeatedDraw = 4,
  storeParam = 5,
  shiftParam = 6,
  applyParam = 7
}

function r(low: number, high: number): number[] {
  let c = high - low;
  const arr = new Array(c);
  while (c--) {
    arr[c] = --high;
  }
  return arr;
}

export class TransitionTable {
  public table: Uint8Array;
  constructor(length: number) {
    this.table = new Uint8Array(length);
  }
  add(code: number, state: number, action: number, next: number): void {
    this.table[state << 8 | code] = action << 4 | next;
  }
  addMany(codes: number[], state: number, action: number, next: number): void {
    for (let i = 0; i < codes.length; i++) {
      this.table[state << 8 | codes[i]] = action << 4 | next;
    }
  }
}

const SIXEL_TABLE = (() => {
  const table = new TransitionTable(1024); //  4 STATES * 256 codes
  const states: number[] = r(SixelState.DATA, SixelState.COLOR + 1);
  let state: any;

  // default transition for all states
  for (state in states) {
    // Note: ignore never changes state
    table.addMany(r(0x00, 0x80), state, SixelAction.ignore, state);
  }
  // DATA state
  table.addMany(r(63, 127), SixelState.DATA, SixelAction.draw, SixelState.DATA);
  table.add(33, SixelState.DATA, SixelAction.ignore, SixelState.COMPRESSION);
  table.add(34, SixelState.DATA, SixelAction.ignore, SixelState.ATTR);
  table.add(35, SixelState.DATA, SixelAction.ignore, SixelState.COLOR);
  table.add(36, SixelState.DATA, SixelAction.cr, SixelState.DATA);
  table.add(45, SixelState.DATA, SixelAction.lf, SixelState.DATA);
  // COMPRESSION
  table.addMany(r(48, 58), SixelState.COMPRESSION, SixelAction.storeParam, SixelState.COMPRESSION);
  table.addMany(r(63, 127), SixelState.COMPRESSION, SixelAction.repeatedDraw, SixelState.DATA);
  table.add(33, SixelState.COMPRESSION, SixelAction.shiftParam, SixelState.COMPRESSION);
  // ATTR
  table.addMany(r(48, 58), SixelState.ATTR, SixelAction.storeParam, SixelState.ATTR);
  table.add(59, SixelState.ATTR, SixelAction.shiftParam, SixelState.ATTR);
  table.addMany(r(63, 127), SixelState.ATTR, SixelAction.applyParam, SixelState.DATA);
  table.add(33, SixelState.ATTR, SixelAction.applyParam, SixelState.COMPRESSION);
  table.add(34, SixelState.ATTR, SixelAction.applyParam, SixelState.ATTR);
  table.add(35, SixelState.ATTR, SixelAction.applyParam, SixelState.COLOR);
  table.add(36, SixelState.ATTR, SixelAction.applyParam, SixelState.DATA);
  table.add(45, SixelState.ATTR, SixelAction.applyParam, SixelState.DATA);
  // COLOR
  table.addMany(r(48, 58), SixelState.COLOR, SixelAction.storeParam, SixelState.COLOR);
  table.add(59, SixelState.COLOR, SixelAction.shiftParam, SixelState.COLOR);
  table.addMany(r(63, 127), SixelState.COLOR, SixelAction.applyParam, SixelState.DATA);
  table.add(33, SixelState.COLOR, SixelAction.applyParam, SixelState.COMPRESSION);
  table.add(34, SixelState.COLOR, SixelAction.applyParam, SixelState.ATTR);
  table.add(35, SixelState.COLOR, SixelAction.applyParam, SixelState.COLOR);
  table.add(36, SixelState.COLOR, SixelAction.applyParam, SixelState.DATA);
  table.add(45, SixelState.COLOR, SixelAction.applyParam, SixelState.DATA);
  return table;
})();


/**
 * Sixel image class.
 * 
 * The class provides image attributes `width` and `height`.
 * With `toImageData` the pixel data can be copied to an `ImageData`
 * for further processing.
 * `write` and `writeString` decode the data streamlined, therefore it
 * is possible to grab partial images during transmission.
 * Note that the class is meant to run behind an escape sequence parser,
 * thus the data should only be the real data part of the sequence and not
 * contain the introducer and the closing bytes.
 * The constructor takes an optional argument `fillColor`. This color gets
 * applied to non zero pixels later on during `toImageData`.
 */
export class SixelImage {
  private _initialState = SixelState.DATA;
  private _currentState = this._initialState;
  private _bands: SixelBand[] = [];
  private _params: number[] = [0];
  private _colors: RGBA8888[] = Object.assign([], DEFAULT_COLORS);
  private _currentColor = this._colors[0];
  private _currentBand: SixelBand = null;
  private _width = 0;
  private _height = 0;

  constructor(public fillColor: RGBA8888 = DEFAULT_BACKGROUND) {}

  public get height(): number {
    return this._height || this._bands.length * 6;
  }

  public get width(): number {
    return this._width || Math.max.apply(null, this._bands.map(el => el.width)) | 0;
  }

  public writeString(data: string, start: number = 0, end: number = data.length): void {
    const bytes = new Uint8Array(end - start);
    let j = 0;
    for (let i = start; i < end; ++i) {
      bytes[j++] = data.charCodeAt(i);
    }
    this.write(bytes);
  }

  /**
   * Write sixel data to the image.
   * Decodes the sixel data and creates the image.
   */
  public write(data: UintTypedArray, start: number = 0, end: number = data.length): void {
    let currentState = this._currentState;
    let dataStart = -1;
    let band: SixelBand = this._currentBand;
    let color: RGBA8888 = this._currentColor;
    let params = this._params;

    for (let i = start; i < end; ++i) {
      const code = data[i];
      const transition = SIXEL_TABLE.table[currentState << 8 | (code < 0x7F ? code : 0xFF)];
      switch (transition >> 4) {
        case SixelAction.draw:
          dataStart = (~dataStart) ? dataStart : i;
          break;
        case SixelAction.ignore:
          if (currentState === SixelState.DATA && ~dataStart) {
            if (!band) {
              band = new SixelBand(this.width || 4);
              this._bands.push(band);
            }
            band.addSixels(data, dataStart, i, color);
          }
          dataStart = -1;
          break;
        case SixelAction.repeatedDraw:
          if (!band) {
            band = new SixelBand(this.width || 4);
            this._bands.push(band);
          }
          let repeat = 0;
          for (let i = 0; i < params.length; ++i) {
            repeat += params[i];
          }
          for (let i = 0; i < repeat; ++i) {
            band.addSixel(code, color);
          }
          dataStart = -1;
          params = [0];
          break;
        case SixelAction.storeParam:
          params[params.length - 1] = params[params.length - 1] * 10 + code - 48;
          break;
        case SixelAction.shiftParam:
          params.push(0);
          break;
        case SixelAction.cr:
          if (~dataStart) {
            if (!band) {
              band = new SixelBand(this.width || 4);
              this._bands.push(band);
            }
            band.addSixels(data, dataStart, i, color);
            dataStart = -1;
          }
          if (band) {
            band.CR();
          }
          break;
        case SixelAction.lf:
          if (~dataStart) {
            if (!band) {
              band = new SixelBand(this.width || 4);
              this._bands.push(band);
            }
            band.addSixels(data, dataStart, i, color);
            dataStart = -1;
          }
          band = null;
          break;
        case SixelAction.applyParam:
          if (currentState === SixelState.COLOR) {
            if (params.length >= 5) {
              if (params[1] === 1) {
                // HLS color
                this._colors[params[0]] = color = normalizeHLS(params[2], params[3], params[4]);
              } else if (params[1] === 2) {
                // RGB color
                this._colors[params[0]] = color = normalizeRGB(params[2], params[3], params[4]);
              }
            } else if (params.length === 1) {
              color = this._colors[params[0]] || this._colors[0];
            }
          } else if (currentState === SixelState.ATTR) {
            // we only use width and height
            if (params.length === 4) {
              this._width = params[2];
              this._height = params[3];
            }
          }
          params = [0];
          dataStart = -1;
          if ((transition & 15) === SixelState.DATA && code > 62 && code < 127) {
            dataStart = i;
          }
          break;
      }
      currentState = transition & 15;
    }
    if (currentState === SixelState.DATA && ~dataStart) {
      if (!band) {
        band = new SixelBand(this.width || 4);
        this._bands.push(band);
      }
      band.addSixels(data, dataStart, end, color);
    }
    
    // save state and buffers
    this._currentState = currentState;
    this._currentColor = color;
    this._params = params;
    this._currentBand = band;
  }

  /**
   * Write image data into `target`.
   * `target` should be specified with correct `width` and `height`.
   * `dx` and `dy` mark the destination offset.
   * `sx` and `sy` mark the source offset, `swidth` and `sheight` the size to be copied.
   * With `fillColor` the default fill color set in the ctor can be overwritten.
   * Returns the modified `target`.
   */
  public toImageData(
    target: Uint8ClampedArray, width: number, height: number,
    dx: number = 0, dy: number = 0,
    sx: number = 0, sy: number = 0, swidth: number = this.width, sheight: number = this.height,
    fillColor: RGBA8888 = this.fillColor): Uint8ClampedArray
  {
    if (dx < 0 || dy < 0 || sx < 0 || sy < 0 || swidth < 0 || sheight < 0) {
      throw new Error('negative values are invalid');
    }
    if (width * height * 4 !== target.length) {
      throw new Error('wrong geometry of target');
    }
    // border checks
    if (dx >= width || dy >= height) {
      return target;
    }
    if (sx >= this.width || sy >= this.height) {
      return target;
    }
    // determine copy area
    swidth = Math.min(swidth, width - dx, this.width);
    sheight = Math.min(sheight, height - dy, this.height);
    if (swidth <= 0 || sheight <= 0) {
      return target;
    }
    // copy data on 32 bit values
    const target32 = new Uint32Array(target.buffer);
    let p = sy % 6;
    let bandIdx = (sy / 6) | 0;
    let i = 0;
    while (bandIdx < this._bands.length && i < sheight) {
      const offset = (dy + i) * width + dx;
      if (fillColor) {
        const end = offset + swidth;
        for (let k = offset; k < end; ++k) {
          target32[k] = fillColor;
        }
      }
      this._bands[bandIdx].copyPixelRow(target32, offset - sx, p, sx, swidth);
      p++;
      i++;
      if (p === 6) {
        bandIdx++;
        p = 0;
      }
    }
    if (fillColor) {
      while (i < sheight) {
        const offset = (dy + i) * width + dx;
        const end = offset + swidth;
        for (let k = offset; k < end; ++k) {
          target32[k] = fillColor;
        }
        i++;
      }
    }
    return target;
  }
}
