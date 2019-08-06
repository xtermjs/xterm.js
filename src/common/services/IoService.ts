/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { StringToUtf32, DEFAULT_ENCODINGS } from 'common/input/Encodings';
import { EventEmitter, IEvent } from 'common/EventEmitter';
import { IEncoding, IInputDecoder, IOutputEncoder } from 'common/Types';

// TODO: fix SetTimeout dep, remove console
declare let setTimeout: (handler: () => void, timeout?: number) => number;
declare let console: any;

/**
 * Safety watermark to avoid memory exhaustion and browser engine crash on fast data input.
 * Enable flow control to avoid this limit and make sure that your backend correctly
 * propagates this to the underlying pty. (see docs for further instructions)
 * Since this limit is meant as a safety parachute to prevent browser crashs,
 * it is set to a very high number. Typically xterm.js gets unresponsive with
 * a 100 times lower number (>500 kB).
 */
const DISCARD_WATERMARK = 50000000; // ~50 MB

/**
 * The max number of ms to spend on writes before allowing the renderer to
 * catch up with a 0ms setTimeout. A value of < 33 to keep us close to
 * 30fps, and a value of < 16 to try to run at 60fps. Of course, the real FPS
 * depends on the time it takes for the renderer to draw the frame.
 */
const WRITE_TIMEOUT_MS = 12;

/**
 * Threshold of max held chunks in the write buffer, that were already processed.
 * This is a tradeoff between extensive write buffer shifts (bad runtime) and high
 * memory consumption by data thats not used anymore.
 */
const WRITE_BUFFER_LENGTH_THRESHOLD = 50;

/**
 * IoService of xterm.js.
 * This service provides encoding handling and input buffering (async write).
 * Data can be written to the terminal with `write` as raw bytes applying the
 * given encoding or as strings.
 * Outgoing data can be grabbed by listening to these events:
 *  - onStringData: string data sent from the terminal as string
 *  - onRawData: byte data sent from the terminal as bytestring
 *  - onData: all data sent from the terminal as raw bytes (encoded)
 *
 * The encoding should reflect the pty application's expectations, change it with
 * `setEncoding`. Beside the supported encodings (ascii, binary/iso-8859-15, utf-8,
 * iso-8859-15 and Windows-1252) further encodings can be added by `addEncoding`.
 * The encoding is set to utf-8 by default as most platforms use UTF-8 nowadays.
 */
export class IoService {
  private _writeBuffer: (Uint8Array | string)[] = [];
  private _pendingSize: number = 0;
  private _callbacks: ((() => void) | undefined)[] = [];
  private _writeInProgress = false;
  private _stringDecoder = new StringToUtf32();
  private _decoder: IInputDecoder;
  private _encoder: IOutputEncoder;
  private _inputBuffer = new Uint32Array(4096);
  private _encodings: {[key: string]: IEncoding} = {};

  // event emitters
  private _onStringData = new EventEmitter<string>();
  public get onStringData(): IEvent<string> { return this._onStringData.event; }
  private _onRawData = new EventEmitter<string>();
  public get onRawData(): IEvent<string> { return this._onRawData.event; }
  private _onData = new EventEmitter<Uint8Array>();
  public get onData(): IEvent<Uint8Array> { return this._onData.event; }

  constructor(encoding: string = 'utf-8') {
    for (const entry in DEFAULT_ENCODINGS) {
      for (const name of DEFAULT_ENCODINGS[entry].names) {
        this._encodings[name] = {
          names: DEFAULT_ENCODINGS[entry].names,
          decoder: DEFAULT_ENCODINGS[entry].decoder,
          encoder: DEFAULT_ENCODINGS[entry].encoder
        };
      }
    }
    if (!this._encodings[encoding]) {
      throw new Error(`unsupported encoding "${encoding}"`);
    }
    this._decoder = new this._encodings[encoding].decoder();
    this._encoder = new this._encodings[encoding].encoder();
  }

  /**
   * Write data to the terminal.
   * `data` can either be raw bytes from the pty or a string.
   * Raw bytes will be decoded with the set encoding (default UTF-8),
   * string data will always be decoded as UTF-16.
   * `callback` is an optional callback that gets called once the data
   * chunk was processed by the parser. Use this to implement
   * a flow control mechanism so the terminal can keep up with incoming
   * data. If the terminal falls to much behind data will be lost (>50MB).
   */
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
      setTimeout(() => {
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
      // TODO: limit max. parseBuffer size (chunkify very big chunks)
      const len = (typeof data === 'string')
        ? this._stringDecoder.decode(data, this._inputBuffer)
        : this._decoder.decode(data, this._inputBuffer);
      // TODO: call inputhandler here
      // this._inputHandler.parseUtf32(this._parseBuffer, len);
      console.log('terminal sees:', this._inputBuffer.subarray(0, len));

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
      setTimeout(() => this._innerWrite(bufferOffset), 0);
    } else {
      this._writeInProgress = false;
      this._writeBuffer = [];
      this._callbacks = [];
    }
  }

  /**
   * Set the input and output encoding of the terminal.
   * This setting should be in line with the expected application encoding.
   * Set to 'utf-8' by default, which covers most modern platform needs.
   */
  public setEncoding(encoding: string): void {
    if (!this._encodings[encoding]) {
      throw new Error(`unsupported encoding "${encoding}"`);
    }
    this._encoder = new this._encodings[encoding].encoder();
    this._writeBuffer.push('');
    this._callbacks.push(() => { this._decoder = new this._encodings[encoding].decoder(); });
  }

  /**
   * Add a custom encoding.
   */
  public addEncoding(encoding: IEncoding): void {
    for (const name of encoding.names) {
      this._encodings[name] = {
        names: encoding.names,
        decoder: encoding.decoder,
        encoder: encoding.encoder
      };
    }
  }

  /**
   * Send string data from within the terminal. Anything that resembles
   * string content should be sent with this method.
   * The data will be output encoded as given in `setEncoding`.
   * Grab the data with the `onStringData` event.
   */
  public triggerStringDataEvent(data: string): void {
    // allow string data to be caught separately
    this._onStringData.fire(data);
    this.triggerDataEvent(this._encoder.encode(data));
  }

  /**
   * Send raw byte data as string type from within the terminal.
   * `data` should be a string of codepoints in byte range (0-255),
   * higher bits will be stripped ('binary' encoding).
   * Output encoding as given in `setEncoding` is not applied.
   * Grab the data with the `onRawData` event.
   */
  public triggerRawDataEvent(data: string): void {
    // allow raw data to be caught separately (as byte string)
    this._onRawData.fire(data);
    const result = new Uint8Array(data.length);
    for (let i = 0; i < result.length; ++i) {
      result[i] = data.charCodeAt(i) & 0xFF;
    }
    this.triggerDataEvent(result);
  }

  /**
   * Send raw bytes from within the terminal. No further encoding
   * is applied.
   * Grab the data with the `onData` event.
   * Note: This is also called by `triggerStringDataEvent` and
   * `triggerRawDataEvent`, thus the `onData` event will contain
   * all data sent from the terminal in a byte fashion.
   */
  public triggerDataEvent(data: Uint8Array): void {
    this._onData.fire(data);
  }
}


/**
 * example usage
 */

const ios = new IoService();

// connect data handlers
ios.onData(data => console.log('byte data:', data));
ios.onStringData(data => console.log('string data:', data));
ios.onRawData(data => console.log('raw data:', data));

// test different encodings with €
// string input is still possible
ios.write('€');                                   // --> 8364

// default: UTF8
ios.write(new Uint8Array([0xe2, 0x82, 0xac]));    // --> 8364
ios.triggerStringDataEvent('€');                      // --> 0xe2, 0x82, 0xac
ios.triggerRawDataEvent('€');                        // --> 172 (strips high bits)

ios.setEncoding('iso-8859-15');
ios.write(new Uint8Array([0xa4]));                // --> 8364
ios.triggerStringDataEvent('€');                      // --> 164
ios.triggerRawDataEvent('€');                        // --> 172 (strips high bits)

ios.setEncoding('windows-1252');
ios.write(new Uint8Array([0x80]));                // --> 8364
ios.triggerStringDataEvent('€');                      // --> 128
ios.triggerRawDataEvent('€');                        // --> 172 (strips high bits)

// ascii: ignores high bit
ios.setEncoding('ascii');
ios.write(new Uint8Array([0x80, 0x81]));          // --> 0, 1
ios.triggerStringDataEvent('€');                      // --> 63 (? replacement)
ios.triggerRawDataEvent('€');                        // --> 172 (strips high bits)

// binary: direct 8bit --> unicode mapping
ios.setEncoding('binary');
ios.write(new Uint8Array([0x80, 0x81]));          // --> 128, 129
ios.triggerStringDataEvent('€');                      // --> 63 (? replacement)
ios.triggerRawDataEvent('€');                        // --> 172 (strips high bits)
