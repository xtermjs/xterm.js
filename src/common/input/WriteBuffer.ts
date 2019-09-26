
/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

declare const setTimeout: (handler: () => void, timeout?: number) => void;

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

export class WriteBuffer {
  private _writeBuffer: (string | Uint8Array)[] = [];
  private _callbacks: ((() => void) | undefined)[] = [];
  private _pendingData = 0;
  private _bufferOffset = 0;

  constructor(private _action: (data: string | Uint8Array) => void) { }

  public writeSync(data: string | Uint8Array): void {
    // force sync processing on pending data chunks to avoid in-band data scrambling
    // does the same as innerWrite but without event loop
    if (this._writeBuffer.length) {
      for (let i = this._bufferOffset; i < this._writeBuffer.length; ++i) {
        const data = this._writeBuffer[i];
        const cb = this._callbacks[i];
        this._action(data);
        if (cb) cb();
      }
      // reset all to avoid reprocessing of chunks with scheduled innerWrite call
      this._writeBuffer = [];
      this._callbacks = [];
      this._pendingData = 0;
      // stop scheduled innerWrite by offset > length condition
      this._bufferOffset = 0x7FFFFFFF;
    }
    // handle current data chunk
    this._action(data);
  }

  public write(data: string | Uint8Array, callback?: () => void): void {
    if (this._pendingData > DISCARD_WATERMARK) {
      throw new Error('write data discarded, use flow control to avoid losing data');
    }

    // schedule chunk processing for next event loop run
    if (!this._writeBuffer.length) {
      this._bufferOffset = 0;
      setTimeout(() => this._innerWrite());
    }

    this._pendingData += data.length;
    this._writeBuffer.push(data);
    this._callbacks.push(callback);
  }

  protected _innerWrite(): void {
    const startTime = Date.now();
    while (this._writeBuffer.length > this._bufferOffset) {
      const data = this._writeBuffer[this._bufferOffset];
      const cb = this._callbacks[this._bufferOffset];
      this._bufferOffset++;

      this._action(data);
      this._pendingData -= data.length;
      if (cb) cb();

      if (Date.now() - startTime >= WRITE_TIMEOUT_MS) {
        break;
      }
    }
    if (this._writeBuffer.length > this._bufferOffset) {
      // Allow renderer to catch up before processing the next batch
      // trim already processed chunks if we are above threshold
      if (this._bufferOffset > WRITE_BUFFER_LENGTH_THRESHOLD) {
        this._writeBuffer = this._writeBuffer.slice(this._bufferOffset);
        this._callbacks = this._callbacks.slice(this._bufferOffset);
        this._bufferOffset = 0;
      }
      setTimeout(() => this._innerWrite(), 0);
    } else {
      this._writeBuffer = [];
      this._callbacks = [];
      this._pendingData = 0;
      this._bufferOffset = 0;
    }
  }
}
