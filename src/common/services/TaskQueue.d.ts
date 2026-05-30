import type { ILogService } from 'common/services/Services';
interface ITaskQueue {
    enqueue(task: () => boolean | void): void;
    flush(): void;
    clear(): void;
}
interface ITaskDeadline {
    timeRemaining(): number;
}
type CallbackWithDeadline = (deadline: ITaskDeadline) => void;
declare abstract class TaskQueue implements ITaskQueue {
    private _tasks;
    private _idleCallback?;
    private _i;
    protected readonly _logService: ILogService;
    constructor(logService: ILogService);
    protected abstract _requestCallback(callback: CallbackWithDeadline): number;
    protected abstract _cancelCallback(identifier: number): void;
    enqueue(task: () => boolean | void): void;
    flush(): void;
    clear(): void;
    private _start;
    private _process;
}
export declare class PriorityTaskQueue extends TaskQueue {
    protected _requestCallback(callback: CallbackWithDeadline): number;
    protected _cancelCallback(identifier: number): void;
    private _createDeadline;
}
declare class IdleTaskQueueInternal extends TaskQueue {
    protected _requestCallback(callback: IdleRequestCallback): number;
    protected _cancelCallback(identifier: number): void;
}
export declare const IdleTaskQueue: typeof PriorityTaskQueue | typeof IdleTaskQueueInternal;
export declare class DebouncedIdleTask {
    private _queue;
    constructor(logService: ILogService);
    set(task: () => boolean | void): void;
    flush(): void;
    dispose(): void;
}
export {};
//# sourceMappingURL=TaskQueue.d.ts.map