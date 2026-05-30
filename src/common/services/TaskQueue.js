"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DebouncedIdleTask = exports.IdleTaskQueue = exports.PriorityTaskQueue = void 0;
class TaskQueue {
    constructor(logService) {
        this._tasks = [];
        this._i = 0;
        this._logService = logService;
    }
    enqueue(task) {
        this._tasks.push(task);
        this._start();
    }
    flush() {
        while (this._i < this._tasks.length) {
            if (!this._tasks[this._i]()) {
                this._i++;
            }
        }
        this.clear();
    }
    clear() {
        if (this._idleCallback) {
            this._cancelCallback(this._idleCallback);
            this._idleCallback = undefined;
        }
        this._i = 0;
        this._tasks.length = 0;
    }
    _start() {
        if (!this._idleCallback) {
            this._idleCallback = this._requestCallback(this._process.bind(this));
        }
    }
    _process(deadline) {
        this._idleCallback = undefined;
        let taskDuration;
        let longestTask = 0;
        let lastDeadlineRemaining = deadline.timeRemaining();
        let deadlineRemaining;
        while (this._i < this._tasks.length) {
            taskDuration = performance.now();
            if (!this._tasks[this._i]()) {
                this._i++;
            }
            taskDuration = Math.max(1, performance.now() - taskDuration);
            longestTask = Math.max(taskDuration, longestTask);
            deadlineRemaining = deadline.timeRemaining();
            if (longestTask * 1.5 > deadlineRemaining) {
                if (lastDeadlineRemaining - taskDuration < -20) {
                    this._logService.warn(`task queue exceeded allotted deadline by ${Math.abs(Math.round(lastDeadlineRemaining - taskDuration))}ms`);
                }
                this._start();
                return;
            }
            lastDeadlineRemaining = deadlineRemaining;
        }
        this.clear();
    }
}
class PriorityTaskQueue extends TaskQueue {
    _requestCallback(callback) {
        return setTimeout(() => callback(this._createDeadline(16)));
    }
    _cancelCallback(identifier) {
        clearTimeout(identifier);
    }
    _createDeadline(duration) {
        const end = performance.now() + duration;
        return {
            timeRemaining: () => Math.max(0, end - performance.now())
        };
    }
}
exports.PriorityTaskQueue = PriorityTaskQueue;
class IdleTaskQueueInternal extends TaskQueue {
    _requestCallback(callback) {
        return requestIdleCallback(callback);
    }
    _cancelCallback(identifier) {
        cancelIdleCallback(identifier);
    }
}
exports.IdleTaskQueue = ('requestIdleCallback' in globalThis) ? IdleTaskQueueInternal : PriorityTaskQueue;
class DebouncedIdleTask {
    constructor(logService) {
        this._queue = new exports.IdleTaskQueue(logService);
    }
    set(task) {
        this._queue.clear();
        this._queue.enqueue(task);
    }
    flush() {
        this._queue.flush();
    }
    dispose() {
        this._queue.clear();
    }
}
exports.DebouncedIdleTask = DebouncedIdleTask;
//# sourceMappingURL=TaskQueue.js.map