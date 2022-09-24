/**
 * Copyright (c) 2022 The xterm.js authors. All rights reserved.
 * @license MIT
 */

/**
 * A queue of that runs tasks over several idle callbacks, trying to maintain the specified
 * frame rate. The tasks will run in the order they are enqueued, but they will run some time later,
 * and care should be taken to ensure they're non-urgent and will not introduce race conditions.
 */
export class IdleTaskQueue {
  private _tasks: (() => void)[] = [];
  private _idleCallback?: number;
  private _maxTaskDuration: number;
  private _i = 0;

  /**
   * @param targetFps The target frame rate.
   */
  constructor(targetFps: number = 240) {
    this._maxTaskDuration = 1000 / targetFps;
  }

  /**
   * Adds a task to the queue which will run in a future idle callback.
   */
  public enqueue(task: () => void): void {
    this._tasks.push(task);
    this._start();
  }

  /**
   * Flushes the queue, running all remaining tasks synchronously.
   */
  public flush(): void {
    while (this._i < this._tasks.length) {
      this._tasks[this._i++]();
    }
    this.clear();
  }

  /**
   * Clears any remaining tasks from the queue, these will not be run.
   */
  public clear(): void {
    if (this._idleCallback) {
      cancelIdleCallback(this._idleCallback);
      this._idleCallback = undefined;
    }
    this._i = 0;
    this._tasks.length = 0;
  }

  private _start(): void {
    if (!this._idleCallback) {
      this._idleCallback = requestIdleCallback(() => this._process());
    }
  }

  private _process(): void {
    const start = performance.now();
    this._idleCallback = undefined;
    while (this._i < this._tasks.length) {
      this._tasks[this._i++]();
      if (performance.now() - start > this._maxTaskDuration) {
        this._start();
        return;
      }
    }
    this.clear();
  }
}

export class DebouncedIdleTask {
  private _queue: IdleTaskQueue;

  /**
   * @param targetFps The target frame rate.
   */
  constructor(targetFps: number = 240) {
    this._queue = new IdleTaskQueue(targetFps);
  }

  public set(task: () => void): void {
    this._queue.clear();
    this._queue.enqueue(task);
  }

  public flush(): void {
    this._queue.flush();
  }
}
