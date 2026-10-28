
/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { TimeoutTimer } from '../Async';
import { Disposable, toDisposable } from '../Lifecycle';
import { Emitter } from '../Event';

const enum Constants {
  /**
   * Safety watermark to avoid memory exhaustion and browser engine crash on fast data input.
   * Enable flow control to avoid this limit and make sure that your backend correctly
   * propagates this to the underlying pty. (see docs for further instructions)
   * Since this limit is meant as a safety parachute to prevent browser crashs,
   * it is set to a very high number. Typically xterm.js gets unresponsive with
   * a 100 times lower number (>500 kB).
   */
  DISCARD_WATERMARK = 50000000, // ~50 MB
  /**
   * The max number of ms to spend on writes before allowing the renderer to
   * catch up with a 0ms setTimeout. A value of < 33 to keep us close to
   * 30fps, and a value of < 16 to try to run at 60fps. Of course, the real FPS
   * depends on the time it takes for the renderer to draw the frame.
   */
  WRITE_TIMEOUT_MS = 12,
  /**
   * Threshold of max held chunks in the write buffer, that were already processed.
   * This is a tradeoff between extensive write buffer shifts (bad runtime) and high
   * memory consumption by data thats not used anymore.
   */
  WRITE_BUFFER_LENGTH_THRESHOLD = 50
}

export class WriteBuffer extends Disposable {
  private _writeBuffer: (string | Uint8Array)[] = [];
  private _callbacks: ((() => void) | undefined)[] = [];
  private _pendingData = 0;
  private _bufferOffset = 0;
  private _isSyncWriting = false;
  /** True while `_action` is on the stack for the chunk at `_bufferOffset`. */
  private _inAction = false;
  /** True when the chunk at `_bufferOffset` is paused in a Promise-returning handler. */
  private _awaitingAsync = false;
  /** Set by the async continuation so it can re-enter while `_awaitingAsync` is set. */
  private _resumeAsync = false;
  private _syncCalls = 0;
  private _didUserInput = false;

  private readonly _innerWriteTimer = this._register(new TimeoutTimer());
  private readonly _onWriteParsed = this._register(new Emitter<void>());
  public readonly onWriteParsed = this._onWriteParsed.event;

  constructor(private _action: (data: string | Uint8Array, promiseResult?: boolean) => void | Promise<boolean>) {
    super();
    this._register(toDisposable(() => {
      this._writeBuffer.length = 0;
      this._callbacks.length = 0;
      this._pendingData = 0;
      this._bufferOffset = 0;
    }));
  }

  public handleUserInput(): void {
    this._didUserInput = true;
  }

  /**
   * Flushes all pending writes synchronously. This is useful when you need to
   * ensure all queued data is processed before performing an operation that
   * depends upon everything being parsed like resize.
   *
   * Only chunks that have not been parsed yet are processed (`_bufferOffset`
   * and above). Chunks the async loop already parsed — including the chunk
   * whose callback is running — are left alone, so this can be called
   * re-entrantly from a write callback without replaying input.
   *
   * If a handler returns a promise, parsing stops at that chunk and the async
   * loop resumes it when the promise settles. This does not wait for that
   * promise.
   */
  public flushSync(): void {
    if (this._store.isDisposed) {
      return;
    }
    // writeSync/flushSync is already walking the buffer, the current chunk is
    // still inside _action, or the parser is paused on a promise. Running
    // another pass here would replay chunks or continue an async handler early.
    if (this._isSyncWriting || this._inAction || this._awaitingAsync) {
      return;
    }
    this._isSyncWriting = true;

    let didProcess = false;
    try {
      while (this._writeBuffer.length > this._bufferOffset) {
        const chunk = this._writeBuffer[this._bufferOffset];
        const cb = this._callbacks[this._bufferOffset];
        // Advance before action/callback so a re-entrant flushSync sees this
        // chunk as already taken. Rewind if the handler pauses instead.
        this._bufferOffset++;
        this._pendingData -= chunk.length;
        const result = this._action(chunk);
        if (result) {
          this._bufferOffset--;
          this._pendingData += chunk.length;
          this._awaitingAsync = true;
          // The queued async pass would otherwise parse this chunk again.
          this._innerWriteTimer.cancel();
          this._continueAfterAsync(result, performance.now());
          return;
        }
        didProcess = true;
        if (cb) cb();
      }

      this._writeBuffer.length = 0;
      this._callbacks.length = 0;
      this._pendingData = 0;
      this._bufferOffset = 0;
    } finally {
      this._isSyncWriting = false;
    }
    if (didProcess) {
      this._onWriteParsed.fire();
    }
  }

  /**
   * @deprecated Unreliable, to be removed soon.
   */
  public writeSync(data: string | Uint8Array, maxSubsequentCalls?: number): void {
    if (this._store.isDisposed) {
      return;
    }
    // stop writeSync recursions with maxSubsequentCalls argument
    // This is dangerous to use as it will lose the current data chunk
    // and return immediately.
    if (maxSubsequentCalls !== undefined && this._syncCalls > maxSubsequentCalls) {
      // comment next line if a whole loop block should only contain x `writeSync` calls
      // (total flat vs. deep nested limit)
      this._syncCalls = 0;
      return;
    }
    // append chunk to buffer
    this._pendingData += data.length;
    this._writeBuffer.push(data);
    this._callbacks.push(undefined);

    // increase recursion counter
    this._syncCalls++;
    // exit early if another writeSync loop is active
    if (this._isSyncWriting) {
      return;
    }
    this._isSyncWriting = true;

    // force sync processing on pending data chunks to avoid in-band data scrambling
    // does the same as innerWrite but without event loop
    // we have to do it here as single loop steps to not corrupt loop subject
    // by another writeSync call triggered from _action
    let chunk: string | Uint8Array | undefined;
    while (chunk = this._writeBuffer.shift()) {
      this._action(chunk);
      const cb = this._callbacks.shift();
      if (cb) cb();
    }
    // reset to avoid reprocessing of chunks with scheduled innerWrite call
    // stopping scheduled innerWrite by offset > length condition
    this._pendingData = 0;
    this._bufferOffset = 0x7FFFFFFF;

    // allow another writeSync to loop
    this._isSyncWriting = false;
    this._syncCalls = 0;
  }

  public write(data: string | Uint8Array, callback?: () => void): void {
    if (this._store.isDisposed) {
      return;
    }
    if (this._pendingData > Constants.DISCARD_WATERMARK) {
      throw new Error('write data discarded, use flow control to avoid losing data');
    }

    // schedule chunk processing for next event loop run
    if (!this._writeBuffer.length) {
      this._bufferOffset = 0;

      // If this is the first write call after the user has done some input,
      // parse it immediately to minimize input latency,
      // otherwise schedule for the next event
      if (this._didUserInput) {
        this._didUserInput = false;
        this._pendingData += data.length;
        this._writeBuffer.push(data);
        this._callbacks.push(callback);
        this._innerWrite();
        return;
      }

      this._scheduleInnerWrite();
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
   *     if (performance.now() - (lastTime | 0) < Constants.WRITE_TIMEOUT_MS):
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
  private _scheduleInnerWrite(lastTime: number = 0, promiseResult: boolean = true, resumeAsync: boolean = false): void {
    if (this._store.isDisposed) {
      return;
    }
    this._innerWriteTimer.cancelAndSet(() => {
      if (resumeAsync) {
        this._resumeAsync = true;
      }
      this._innerWrite(lastTime, promiseResult);
    }, 0);
  }

  /**
   * Resume the chunk paused in `result` once it settles. `startTime` is the
   * beginning of the current write batch so the timeout keeps batching work
   * the same way `_innerWrite` does.
   */
  private _continueAfterAsync(result: Promise<boolean>, startTime: number): void {
    /**
     * If a promise takes long to resolve, schedule continuation behind setTimeout
     * so the renderer can catch up. The handler itself must slice hard work;
     * this only schedules a screen update once we gain control again.
     *
     * This favors FPS over throughput by checking `startTime` on resolve. A slow
     * handler that already sliced its work can still schedule extra updates.
     * FIXME: track FPS at the renderer entry instead. Checking `startTime` up
     * front would pull one more chunk into this microtask and favor throughput.
     */
    const continuation = (resolved: boolean): void => {
      if (this._store.isDisposed) {
        return;
      }
      if (performance.now() - startTime >= Constants.WRITE_TIMEOUT_MS) {
        this._scheduleInnerWrite(0, resolved, true);
      } else {
        this._resumeAsync = true;
        this._innerWrite(startTime, resolved);
      }
    };

    // Handle exceptions synchronously to the current band position:
    // 1. spawn a single microtask which we allow to throw hard
    // 2. spawn a promise immediately resolving to `false`
    // (executed on the same queue, thus properly aligned before continuation)
    result.catch(err => {
      queueMicrotask(() => { throw err; });
      return Promise.resolve(false);
    }).then(continuation);
  }

  protected _innerWrite(lastTime: number = 0, promiseResult: boolean = true): void {
    if (this._store.isDisposed) {
      return;
    }
    // A stale timer must not parse the chunk a promise is still paused on.
    // The continuation sets `_resumeAsync` and is the only caller allowed in.
    if (this._awaitingAsync && !this._resumeAsync) {
      return;
    }
    this._resumeAsync = false;
    this._awaitingAsync = false;

    const startTime = lastTime || performance.now();
    while (this._writeBuffer.length > this._bufferOffset) {
      // flushSync from the previous callback paused on this chunk.
      if (this._awaitingAsync) {
        return;
      }
      const data = this._writeBuffer[this._bufferOffset];
      const cb = this._callbacks[this._bufferOffset];
      this._inAction = true;
      let result: void | Promise<boolean>;
      try {
        result = this._action(data, promiseResult);
      } finally {
        this._inAction = false;
      }
      if (result) {
        /**
         * A promise blocks input at this chunk. The parser stack holds the
         * position within the chunk; resume by calling `_action` again with
         * the resolved value until it returns void. The callback stays pending
         * so it cannot observe partially parsed input.
         *
         * Exceptions on async handlers are logged async and do not interrupt
         * input processing (continues with the next handler at this position).
         */
        this._awaitingAsync = true;
        this._continueAfterAsync(result, startTime);
        return;
      }

      // The chunk is fully parsed. Advance before the callback so flushSync
      // (resize from the callback) cannot parse this chunk again, and so this
      // loop observes any chunks that flushSync consumes.
      this._bufferOffset++;
      this._pendingData -= data.length;
      if (cb) cb();

      if (performance.now() - startTime >= Constants.WRITE_TIMEOUT_MS) {
        break;
      }
    }
    if (this._writeBuffer.length > this._bufferOffset) {
      // Allow renderer to catch up before processing the next batch
      // trim already processed chunks if we are above threshold
      if (this._bufferOffset > Constants.WRITE_BUFFER_LENGTH_THRESHOLD) {
        this._writeBuffer = this._writeBuffer.slice(this._bufferOffset);
        this._callbacks = this._callbacks.slice(this._bufferOffset);
        this._bufferOffset = 0;
      }
      this._scheduleInnerWrite();
    } else {
      this._writeBuffer.length = 0;
      this._callbacks.length = 0;
      this._pendingData = 0;
      this._bufferOffset = 0;
    }
    this._onWriteParsed.fire();
  }
}
