/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { StringToUtf32, Utf8ToUtf32 } from 'common/input/TextDecoder';

// hack to get around tsconfig limitations
const GLOBAL_OBJECT = Function('return this')();


/**
 * UTF32 decoders.
 */
interface IUtf32Decoder {
  decode(data: Uint8Array, target: Uint32Array): number;
}
interface IUtf32DecoderCtor {
  new(): IUtf32Decoder;
}

class AsciiToUtf32 implements IUtf32Decoder {
  public decode(data: Uint8Array, target: Uint32Array): number {
    for (let i = 0; i < data.length; ++i) {
      target[i] = data[i] & 0x7F;
    }
    return data.length;
  }
}

class BinaryToUtf32 implements IUtf32Decoder {
  public decode(data: Uint8Array, target: Uint32Array): number {
    for (let i = 0; i < data.length; ++i) {
      target[i] = data[i];
    }
    return data.length;
  }
}

class ISO15ToUtf32 implements IUtf32Decoder {
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

class Windows1252ToUtf32 implements IUtf32Decoder {
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
 * Encoders. Encodes intern format to target encoding.
 * TODO: unified ignore/replace rules and interface
 */
interface IOutputEncoder {
  encode(data: string): Uint8Array;
}

interface IOutputEncoderCtor {
  new(): IOutputEncoder;
}

class Utf8Encoder implements IOutputEncoder {
  private _encode: (data: string) => Uint8Array;
  constructor() {
    // use system encoders on nodejs and browser
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

class AsciiEncoder implements IOutputEncoder {
  encode(data: string): Uint8Array {
    const result = new Uint8Array(data.length);
    for (let i = 0; i < result.length; ++i) {
      const code = data.charCodeAt(i);
      result[i] = (code < 0x80) ? code : 0x3F; // '?' replacement
    }
    return result;
  }
}

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

// encoding mapping
const ENCODING_MAP: {[key: string]: {alt: string[]; decoder: IUtf32DecoderCtor, encoder: IOutputEncoderCtor}} = {
  'ascii': {
    alt: ['7bit', '7-bit'],
    decoder: AsciiToUtf32,
    encoder: AsciiEncoder
  },
  'binary': {
    alt: ['8bit', '8-bit', 'latin1', 'latin-1', 'iso-8859-1'],
    decoder: BinaryToUtf32,
    encoder: BinaryEncoder
  },
  'iso-8859-15': {
    alt: [],
    decoder: ISO15ToUtf32,
    encoder: ISO15Encoder
  },
  'windows-1252': {
    alt: ['cp1252', 'cp-1252'],
    decoder: Windows1252ToUtf32,
    encoder: Windows1252Encoder
  },
  'utf-8': {
    alt: ['utf8', 'UTF8', 'UTF-8'],
    decoder: Utf8ToUtf32,
    encoder: Utf8Encoder
  }
}
const ENCODINGS: {[key: string]: {decoder: any, encoder: any}} = (function() {
  const encodings: {[key: string]: {decoder: any, encoder: any}} = {};
  for (const entry in ENCODING_MAP) {
    encodings[entry] = {decoder: ENCODING_MAP[entry].decoder, encoder: ENCODING_MAP[entry].encoder};
    for (const alt of ENCODING_MAP[entry].alt) {
      encodings[alt] = {decoder: ENCODING_MAP[entry].decoder, encoder: ENCODING_MAP[entry].encoder};
    }
  }
  return encodings;
})();
GLOBAL_OBJECT.console.log(ENCODINGS);


/**
 * IoService
 */

// some buffering constants
const DISCARD_WATERMARK = 50000000; // ~50 MB
const WRITE_TIMEOUT_MS = 12;
const WRITE_BUFFER_LENGTH_THRESHOLD = 50;

export class IoService {
  private _writeBuffer: (Uint8Array | string)[] = [];
  private _pendingSize: number = 0;
  private _callbacks: ((() => void) | undefined)[] = [];
  private _writeInProgress: boolean = false;
  private _stringDecoder: StringToUtf32 = new StringToUtf32();
  private _decoder: IUtf32Decoder = new Utf8ToUtf32();
  private _encoder: IOutputEncoder = new Utf8Encoder();
  private _inputBuffer: Uint32Array = new Uint32Array(4096);

  public write(data: Uint8Array | string, callback?: () => void): void {
    if (!data.length) {
      return;
    }
    if (this._pendingSize > DISCARD_WATERMARK) {
      throw new Error('write data discarded, use flow control to avoid losing data');
    }

    this._pendingSize += data.length;
    this._writeBuffer.push(data);
    this._callbacks.push(callback);

    if (!this._writeInProgress) {
      this._writeInProgress = true;
      GLOBAL_OBJECT.setTimeout(() => {
        this._innerWrite();
      });
    }
  }

  private _innerWrite(bufferOffset: number = 0): void {
    const startTime = Date.now();
    while (this._writeBuffer.length > bufferOffset) {
      const data = this._writeBuffer[bufferOffset];
      const cb = this._callbacks[bufferOffset];
      bufferOffset++;

      if (this._inputBuffer.length < data.length) {
        this._inputBuffer = new Uint32Array(data.length);
      }
      // TODO: reset multibyte streamline decoders on switch
      const len = (typeof data === 'string')
        ? this._stringDecoder.decode(data, this._inputBuffer)
        : this._decoder.decode(data, this._inputBuffer);
      // TODO: call inputhandler here
      // this._inputHandler.parseUtf32(this._parseBuffer, len);
      GLOBAL_OBJECT.console.log('terminal sees:', this._inputBuffer.subarray(0, len));

      this._pendingSize -= data.length;
      if (cb) cb();
      // this.refresh(this._dirtyRowService.start, this._dirtyRowService.end);
      if (Date.now() - startTime >= WRITE_TIMEOUT_MS) {
        break;
      }
    }
    if (this._writeBuffer.length > bufferOffset) {
      // Allow renderer to catch up before processing the next batch
      // trim already processed chunks if we are above threshold
      if (bufferOffset > WRITE_BUFFER_LENGTH_THRESHOLD) {
        this._writeBuffer = this._writeBuffer.slice(bufferOffset);
        this._callbacks = this._callbacks.slice(bufferOffset);
        bufferOffset = 0;
      }
      GLOBAL_OBJECT.setTimeout(() => this._innerWrite(bufferOffset), 0);
    } else {
      this._writeInProgress = false;
      this._writeBuffer = [];
      this._callbacks = [];
    }
  }

  public setEncoding(encoding: string): void {
    if (!ENCODINGS[encoding]) {
      throw new Error(`unsupported encoding "${encoding}"`);
    }
    this._encoder = new ENCODINGS[encoding].encoder();
    this._writeBuffer.push('');
    this._callbacks.push(() => { this._decoder = new ENCODINGS[encoding].decoder(); });
  }

  public triggerStringEvent(data: string): void {
    GLOBAL_OBJECT.console.log('string data:', this._encoder.encode(data));
  }
  public triggerByteEvent(data: string): void {
    const result = new Uint8Array(data.length);
    for (let i = 0; i < result.length; ++i) {
      result[i] = data.charCodeAt(i) & 0xFF;
    }
    GLOBAL_OBJECT.console.log('byte data:', result);
  }
}


/**
 * example usage
 */

const ios = new IoService();
// test different encodings with €
// string input is still possible
ios.write('€');                                   // --> 8364

// default: UTF8
ios.write(new Uint8Array([0xe2, 0x82, 0xac]));    // --> 8364
ios.triggerStringEvent('€');                      // --> 0xe2, 0x82, 0xac
ios.triggerByteEvent('€');                        // --> 172 (strips high bits)

ios.setEncoding('iso-8859-15');
ios.write(new Uint8Array([0xa4]));                // --> 8364
ios.triggerStringEvent('€');                      // --> 164
ios.triggerByteEvent('€');                        // --> 172 (strips high bits)

ios.setEncoding('windows-1252');
ios.write(new Uint8Array([0x80]));                // --> 8364
ios.triggerStringEvent('€');                      // --> 128
ios.triggerByteEvent('€');                        // --> 172 (strips high bits)

// ascii: ignores high bit
ios.setEncoding('ascii');
ios.write(new Uint8Array([0x80, 0x81]));          // --> 0, 1
ios.triggerStringEvent('€');                      // --> 63 (? replacement)
ios.triggerByteEvent('€');                        // --> 172 (strips high bits)

// binary: direct 8bit --> unicode mapping
ios.setEncoding('binary');
ios.write(new Uint8Array([0x80, 0x81]));          // --> 128, 129
ios.triggerStringEvent('€');                      // --> 63 (? replacement)
ios.triggerByteEvent('€');                        // --> 172 (strips high bits)
