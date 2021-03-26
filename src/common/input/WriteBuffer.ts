
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

// queueMicrotask polyfill for nodejs < v11
const qmt: (cb: () => void) => void = (typeof queueMicrotask === 'undefined')
  ? (cb: () => void) => { Promise.resolve().then(cb); }
  : queueMicrotask;


export class WriteBuffer {
  private _writeBuffer: (string | Uint8Array)[] = [];
  private _callbacks: ((() => void) | undefined)[] = [];
  private _pendingData = 0;
  private _bufferOffset = 0;
  private _isWriting = false;

  constructor(private _action: (data: string | Uint8Array, promiseResult?: boolean) => void | Promise<boolean>) { }

  /**
   * @deprecated Unreliable, to be removed soon.
   */
  public writeSync(data: string | Uint8Array): void {
    // Ensure a write is not already in progress
    if (this._isWriting) {
      return;
    }
    this._isWriting = true;

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

    // Allow another write to be triggered
    this._isWriting = false;
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

  /**
   * Inner write call, that enters the sliced chunk processing by timing.
   *
   * `lastTime` indicates, when the last _innerWrite call had started.
   * It is used to aggregate async handler execution under a timeout constraint
   * effectively lowering the redrawing needs, schematically:
   *
   *   macroTask _innerWrite:
   *     if (Date.now() - (lastTime | 0) < WRITE_TIMEOUT_MS):
   *        schedule microTask _innerWrite(lastTime)
   *     else:
   *        schedule macroTask _innerWrite(0)
   *
   *   overall execution order on task queues:
   *
   *   macrotasks:  [...]  -->  _innerWrite(0)  -->  [...]  -->  screenUpdate  -->  [...]
   *         m  t:                    |
   *         i  a:                  [...]
   *         c  s:                    |
   *         r  k:              while < timeout:
   *         o  s:                _innerWrite(timeout)
   *
   * `promiseResult` depicts the promise resolve value of an async handler.
   * This value gets carried forward through all saved stack states of the
   * paused parser for proper continuation.
   *
   * Note, for pure sync code `lastTime` and `promiseResult` have no meaning.
   */
  protected _innerWrite(lastTime: number = 0, promiseResult: boolean = true): void {
    // Ensure a write is not already in progress
    if (this._isWriting) {
      return;
    }
    this._isWriting = true;

    const startTime = lastTime || Date.now();
    while (this._writeBuffer.length > this._bufferOffset) {
      const data = this._writeBuffer[this._bufferOffset];
      const result = this._action(data, promiseResult);
      if (result) {
        /**
         * If we get a promise as return value, we re-schedule the continuation
         * as thenable on the promise and exit right away.
         *
         * The exit here means, that we block input processing at the current active chunk,
         * the exact execution position within the chunk is preserved by the saved
         * stack content in InputHandler and EscapeSequenceParser.
         *
         * Resuming happens automatically from that saved stack state.
         * Also the resolved promise value is passed along the callstack to
         * `EscapeSequenceParser.parse` to correctly resume the stopped handler loop.
         *
         * Exceptions on async handlers will be logged to console async, but do not interrupt
         * the input processing (continues with next handler at the current input position).
         */

        /**
         * If a promise takes long to resolve, we should schedule continuation behind setTimeout.
         * This might already be too late, if our .then enters really late (executor + prev thens took very long).
         * This cannot be solved here for the handler itself (it is the handlers responsibility to slice hard work),
         * but we can at least schedule a screen update as we gain control.
         */
        const continuation: (r: boolean) => void = (r: boolean) => Date.now() - startTime >= WRITE_TIMEOUT_MS
          ? setTimeout(() => this._innerWrite(0, r))
          : this._innerWrite(startTime, r);

        /**
         * Optimization considerations:
         * The continuation above favors FPS over throughput by eval'ing `startTime` on resolve.
         * This might schedule too many screen updates with bad throughput drops (in case a slow
         * resolving handler sliced its work properly behind setTimeout calls). We cannot spot
         * this condition here, also the renderer has no way to spot nonsense updates either.
         * FIXME: A proper fix for this would track the FPS at the renderer entry level separately.
         *
         * If favoring of FPS shows bad throughtput impact, use the following instead. It favors
         * throughput by eval'ing `startTime` upfront pulling at least one more chunk into the
         * current microtask queue (executed before setTimeout).
         */
        // const continuation: (r: boolean) => void = Date.now() - startTime >= WRITE_TIMEOUT_MS
        //   ? r => setTimeout(() => this._innerWrite(0, r))
        //   : r => this._innerWrite(startTime, r);

        // Handle exceptions synchronously to current band position, idea:
        // 1. spawn a single microtask which we allow to throw hard
        // 2. spawn a promise immediately resolving to `true`
        // (executed on the same queue, thus properly aligned before continuation happens)
        result.catch(err => {
          qmt(() => {throw err;});
          return Promise.resolve(false);
        }).then(continuation);
        return;
      }

      const cb = this._callbacks[this._bufferOffset];
      if (cb) cb();
      this._bufferOffset++;
      this._pendingData -= data.length;

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
      setTimeout(() => this._innerWrite());
    } else {
      this._writeBuffer = [];
      this._callbacks = [];
      this._pendingData = 0;
      this._bufferOffset = 0;
    }

    // Allow another write to be triggered
    this._isWriting = false;
  }
}
