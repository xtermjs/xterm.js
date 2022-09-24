/**
 * Copyright (c) 2022 The xterm.js authors. All rights reserved.
 * @license MIT
 */

export class IdleTaskQueue {
  private _tasks: Function[] = [];
  private _idleCallback?: number;
  private _maxTaskDuration: number;
  private _i = 0;

  constructor(targetFps: number = 240) {
    this._maxTaskDuration = 1000 / targetFps;
  }

  public enqueue(task: Function): void {
    this._tasks.push(task);
    this._start();
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
    // Clear the queue
    this._i = 0;
    this._tasks.length = 0;
  }
}
