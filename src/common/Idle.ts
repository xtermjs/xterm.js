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
  private _i = 0;

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
      this._idleCallback = requestIdleCallback(this._process.bind(this));
    }
  }

  private _process(deadline: IdleDeadline): void {
    this._idleCallback = undefined;
    let taskDuration = 0;
    let longestTask = 0;
    while (this._i < this._tasks.length) {
      taskDuration = performance.now();
      this._tasks[this._i++]();
      taskDuration = performance.now() - taskDuration;
      longestTask = Math.max(taskDuration, longestTask);
      // Guess the following task will take a similar time to task that just finished, allow
      // additional room to try avoid exceeding the deadline
      if (longestTask * 1.5 > deadline.timeRemaining()) {
        this._start();
        return;
      }
    }
    this.clear();
  }
}

/**
 * An object that tracks a single debounced task that will run on the next idle frame. When called
 * multiple times, only the last set task will run.
 */
export class DebouncedIdleTask {
  private _queue: IdleTaskQueue;

  constructor() {
    this._queue = new IdleTaskQueue();
  }

  public set(task: () => void): void {
    this._queue.clear();
    this._queue.enqueue(task);
  }

  public flush(): void {
    this._queue.flush();
  }
}
