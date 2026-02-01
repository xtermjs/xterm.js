/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IntervalTimer } from './async';
import { Emitter, Event } from './event';
import { DisposableStore, IDisposable } from './lifecycle';

export interface IRegisteredWindow {
  readonly window: Window;
  readonly disposables: DisposableStore;
}

const _onDidRegisterWindow = new Emitter<IRegisteredWindow>();
export const onDidRegisterWindow: Event<IRegisteredWindow> = _onDidRegisterWindow.event;

export function registerWindow(window: Window): IDisposable {
  const disposables = new DisposableStore();
  _onDidRegisterWindow.fire({ window, disposables });
  return disposables;
}

export function getWindow(e: Node | UIEvent | undefined | null): Window {
  const candidateNode = e as Node | undefined | null;
  if (candidateNode?.ownerDocument?.defaultView) {
    return candidateNode.ownerDocument.defaultView;
  }

  const candidateEvent = e as UIEvent | undefined | null;
  if (candidateEvent?.view) {
    return candidateEvent.view;
  }

  return window;
}

class DomListener implements IDisposable {
  private _handler: ((e: any) => void) | null;
  private _node: EventTarget | null;
  private readonly _type: string;
  private readonly _options: boolean | AddEventListenerOptions | undefined;

  constructor(node: EventTarget, type: string, handler: (e: any) => void, options?: boolean | AddEventListenerOptions) {
    this._node = node;
    this._type = type;
    this._handler = handler;
    this._options = options;
    node.addEventListener(type, handler, options);
  }

  public dispose(): void {
    if (!this._node || !this._handler) {
      return;
    }
    this._node.removeEventListener(this._type, this._handler, this._options);
    this._node = null;
    this._handler = null;
  }
}

export function addDisposableListener<K extends keyof GlobalEventHandlersEventMap>(node: EventTarget, type: K, handler: (event: GlobalEventHandlersEventMap[K]) => void, useCapture?: boolean): IDisposable;
export function addDisposableListener(node: EventTarget, type: string, handler: (event: any) => void, useCapture?: boolean): IDisposable;
export function addDisposableListener(node: EventTarget, type: string, handler: (event: any) => void, options: AddEventListenerOptions): IDisposable;
export function addDisposableListener(node: EventTarget, type: string, handler: (event: any) => void, useCaptureOrOptions?: boolean | AddEventListenerOptions): IDisposable {
  return new DomListener(node, type, handler, useCaptureOrOptions);
}

export function addStandardDisposableListener(node: HTMLElement, type: string, handler: (event: any) => void, useCapture?: boolean): IDisposable {
  return addDisposableListener(node, type, handler, useCapture);
}

export const EventType = {
  CLICK: 'click',
  MOUSE_DOWN: 'mousedown',
  MOUSE_OVER: 'mouseover',
  MOUSE_LEAVE: 'mouseleave',
  KEY_DOWN: 'keydown',
  KEY_UP: 'keyup',
  INPUT: 'input',
  BLUR: 'blur',
  FOCUS: 'focus',
  CHANGE: 'change',
  POINTER_DOWN: 'pointerdown',
  POINTER_MOVE: 'pointermove',
  POINTER_UP: 'pointerup',
  MOUSE_WHEEL: 'wheel',
  WHEEL: 'wheel'
} as const;

export interface IDomNodePagePosition {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function getDomNodePagePosition(domNode: HTMLElement): IDomNodePagePosition {
  const bb = domNode.getBoundingClientRect();
  const win = getWindow(domNode);
  return {
    left: bb.left + win.scrollX,
    top: bb.top + win.scrollY,
    width: bb.width,
    height: bb.height
  };
}

class AnimationFrameQueueItem implements IDisposable {
  private _canceled = false;

  constructor(private readonly _runner: () => void, public priority: number) {
  }

  public dispose(): void {
    this._canceled = true;
  }

  public execute(): void {
    if (this._canceled) {
      return;
    }
    try {
      this._runner();
    } catch (e) {
      console.error(e);
    }
  }

  public static sort(a: AnimationFrameQueueItem, b: AnimationFrameQueueItem): number {
    return b.priority - a.priority;
  }
}

interface IWindowAnimationFrameState {
  next: AnimationFrameQueueItem[];
  current: AnimationFrameQueueItem[];
  animFrameRequested: boolean;
  inAnimationFrameRunner: boolean;
}

const animationFrameState = new Map<Window, IWindowAnimationFrameState>();

function getAnimationFrameState(targetWindow: Window): IWindowAnimationFrameState {
  let state = animationFrameState.get(targetWindow);
  if (!state) {
    state = {
      next: [],
      current: [],
      animFrameRequested: false,
      inAnimationFrameRunner: false
    };
    animationFrameState.set(targetWindow, state);
  }
  return state;
}

function animationFrameRunner(targetWindow: Window): void {
  const state = getAnimationFrameState(targetWindow);
  state.animFrameRequested = false;

  state.current = state.next;
  state.next = [];

  state.inAnimationFrameRunner = true;
  while (state.current.length > 0) {
    state.current.sort(AnimationFrameQueueItem.sort);
    const top = state.current.shift()!;
    top.execute();
  }
  state.inAnimationFrameRunner = false;
}

export function scheduleAtNextAnimationFrame(targetWindow: Window, runner: () => void, priority: number = 0): IDisposable {
  const state = getAnimationFrameState(targetWindow);
  const item = new AnimationFrameQueueItem(runner, priority);
  state.next.push(item);

  if (!state.animFrameRequested) {
    state.animFrameRequested = true;
    targetWindow.requestAnimationFrame(() => animationFrameRunner(targetWindow));
  }

  return item;
}

export class WindowIntervalTimer extends IntervalTimer {
  private readonly _defaultTarget?: Window;

  constructor(node?: Node) {
    super();
    this._defaultTarget = node ? getWindow(node) : undefined;
  }

  public cancelAndSet(runner: () => void, interval: number, targetWindow?: Window): void {
    super.cancelAndSet(runner, interval, targetWindow ?? this._defaultTarget ?? window);
  }
}
