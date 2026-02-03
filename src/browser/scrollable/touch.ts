/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DomUtils from '../Dom';
import { Disposable, IDisposable, toDisposable } from 'common/Lifecycle';

const mainWindow = (typeof window === 'object' ? window : globalThis) as Window & typeof globalThis;

function tail<T>(array: ArrayLike<T>, n: number = 0): T | undefined {
  return array[array.length - (1 + n)];
}

function memoize(_target: any, key: string, descriptor: PropertyDescriptor): void {
  let fnKey: string | null = null;
  let fn: Function | null = null;

  if (typeof descriptor.value === 'function') {
    fnKey = 'value';
    fn = descriptor.value;

    if (fn!.length !== 0) {
      console.warn('Memoize should only be used in functions with zero parameters');
    }
  } else if (typeof descriptor.get === 'function') {
    fnKey = 'get';
    fn = descriptor.get;
  }

  if (!fn || !fnKey) {
    throw new Error('not supported');
  }

  const memoizeKey = `$memoize$${key}`;
  const descriptorAny = descriptor as { [key: string]: any };
  descriptorAny[fnKey] = function (...args: any[]) {
    if (!this.hasOwnProperty(memoizeKey)) {
      Object.defineProperty(this, memoizeKey, {
        configurable: false,
        enumerable: false,
        writable: false,
        value: fn.apply(this, args)
      });
    }

    return (this as { [key: string]: any })[memoizeKey];
  };
}

class LinkedListNode<E> {

  public static readonly Undefined = new LinkedListNode<any>(undefined);

  public element: E;
  public next: LinkedListNode<E>;
  public prev: LinkedListNode<E>;

  public constructor(element: E) {
    this.element = element;
    this.next = LinkedListNode.Undefined;
    this.prev = LinkedListNode.Undefined;
  }
}

class LinkedList<E> {

  private _first: LinkedListNode<E> = LinkedListNode.Undefined;
  private _last: LinkedListNode<E> = LinkedListNode.Undefined;

  public push(element: E): () => void {
    return this._insert(element, true);
  }

  private _insert(element: E, atTheEnd: boolean): () => void {
    const newNode = new LinkedListNode(element);
    if (this._first === LinkedListNode.Undefined) {
      this._first = newNode;
      this._last = newNode;

    } else if (atTheEnd) {
      const oldLast = this._last;
      this._last = newNode;
      newNode.prev = oldLast;
      oldLast.next = newNode;

    } else {
      const oldFirst = this._first;
      this._first = newNode;
      newNode.next = oldFirst;
      oldFirst.prev = newNode;
    }
    let didRemove = false;
    return () => {
      if (!didRemove) {
        didRemove = true;
        this._remove(newNode);
      }
    };
  }

  private _remove(node: LinkedListNode<E>): void {
    if (node.prev !== LinkedListNode.Undefined && node.next !== LinkedListNode.Undefined) {
      const anchor = node.prev;
      anchor.next = node.next;
      node.next.prev = anchor;

    } else if (node.prev === LinkedListNode.Undefined && node.next === LinkedListNode.Undefined) {
      this._first = LinkedListNode.Undefined;
      this._last = LinkedListNode.Undefined;

    } else if (node.next === LinkedListNode.Undefined) {
      this._last = this._last.prev!;
      this._last.next = LinkedListNode.Undefined;

    } else if (node.prev === LinkedListNode.Undefined) {
      this._first = this._first.next!;
      this._first.prev = LinkedListNode.Undefined;
    }
  }

  public *[Symbol.iterator](): Iterator<E> {
    let node = this._first;
    while (node !== LinkedListNode.Undefined) {
      yield node.element;
      node = node.next;
    }
  }
}

export namespace EventType {
  export const TAP = '-xterm-gesturetap';
  export const CHANGE = '-xterm-gesturechange';
  export const START = '-xterm-gesturestart';
  export const END = '-xterm-gesturesend';
  export const CONTEXT_MENU = '-xterm-gesturecontextmenu';
}

interface ITouchData {
  id: number;
  initialTarget: EventTarget;
  initialTimeStamp: number;
  initialPageX: number;
  initialPageY: number;
  rollingTimestamps: number[];
  rollingPageX: number[];
  rollingPageY: number[];
}

export interface IGestureEvent extends MouseEvent {
  initialTarget: EventTarget | undefined;
  translationX: number;
  translationY: number;
  pageX: number;
  pageY: number;
  tapCount: number;
}

interface ITouch {
  identifier: number;
  screenX: number;
  screenY: number;
  clientX: number;
  clientY: number;
  pageX: number;
  pageY: number;
  radiusX: number;
  radiusY: number;
  rotationAngle: number;
  force: number;
  target: Element;
}

interface ITouchList {
  [i: number]: ITouch;
  length: number;
  item(index: number): ITouch;
  identifiedTouch(id: number): ITouch;
}

interface ITouchEvent extends Event {
  touches: ITouchList;
  targetTouches: ITouchList;
  changedTouches: ITouchList;
}

export class Gesture extends Disposable {

  private static readonly _scrollFriction = -0.005;
  private static _instance: Gesture;
  private static readonly _holdDelay = 700;

  private _dispatched = false;
  private readonly _targets = new LinkedList<HTMLElement>();
  private readonly _ignoreTargets = new LinkedList<HTMLElement>();
  private _handle: IDisposable | null;

  private readonly _activeTouches: { [id: number]: ITouchData };

  private _lastSetTapCountTime: number;

  private static readonly _clearTapCountTime = 400; // ms


  private constructor() {
    super();

    this._activeTouches = {};
    this._handle = null;
    this._lastSetTapCountTime = 0;

    const targetWindow = mainWindow;
    this._register(DomUtils.addDisposableListener(targetWindow.document, 'touchstart', (e: ITouchEvent) => this._handleTouchStart(e), { passive: false }));
    this._register(DomUtils.addDisposableListener(targetWindow.document, 'touchend', (e: ITouchEvent) => this._handleTouchEnd(targetWindow, e)));
    this._register(DomUtils.addDisposableListener(targetWindow.document, 'touchmove', (e: ITouchEvent) => this._handleTouchMove(e), { passive: false }));
  }

  public static addTarget(element: HTMLElement): IDisposable {
    if (!Gesture.isTouchDevice()) {
      return Disposable.None;
    }
    if (!Gesture._instance) {
      Gesture._instance = new Gesture();
    }

    const remove = Gesture._instance._targets.push(element);
    return toDisposable(remove);
  }

  public static ignoreTarget(element: HTMLElement): IDisposable {
    if (!Gesture.isTouchDevice()) {
      return Disposable.None;
    }
    if (!Gesture._instance) {
      Gesture._instance = new Gesture();
    }

    const remove = Gesture._instance._ignoreTargets.push(element);
    return toDisposable(remove);
  }

  @memoize
  public static isTouchDevice(): boolean {
    return 'ontouchstart' in mainWindow || navigator.maxTouchPoints > 0;
  }

  public override dispose(): void {
    if (this._handle) {
      this._handle.dispose();
      this._handle = null;
    }

    super.dispose();
  }

  private _handleTouchStart(e: ITouchEvent): void {
    const timestamp = Date.now();

    if (this._handle) {
      this._handle.dispose();
      this._handle = null;
    }

    for (let i = 0, len = e.targetTouches.length; i < len; i++) {
      const touch = e.targetTouches.item(i);

      this._activeTouches[touch.identifier] = {
        id: touch.identifier,
        initialTarget: touch.target,
        initialTimeStamp: timestamp,
        initialPageX: touch.pageX,
        initialPageY: touch.pageY,
        rollingTimestamps: [timestamp],
        rollingPageX: [touch.pageX],
        rollingPageY: [touch.pageY]
      };

      const evt = this._newGestureEvent(EventType.START, touch.target);
      evt.pageX = touch.pageX;
      evt.pageY = touch.pageY;
      this._dispatchEvent(evt);
    }

    if (this._dispatched) {
      e.preventDefault();
      e.stopPropagation();
      this._dispatched = false;
    }
  }

  private _handleTouchEnd(targetWindow: Window, e: ITouchEvent): void {
    const timestamp = Date.now();

    const activeTouchCount = Object.keys(this._activeTouches).length;

    for (let i = 0, len = e.changedTouches.length; i < len; i++) {

      const touch = e.changedTouches.item(i);

      if (!this._activeTouches.hasOwnProperty(String(touch.identifier))) {
        console.warn('move of an UNKNOWN touch', touch);
        continue;
      }

      const data = this._activeTouches[touch.identifier];
      const holdTime = Date.now() - data.initialTimeStamp;

      if (holdTime < Gesture._holdDelay
        && Math.abs(data.initialPageX - tail(data.rollingPageX)!) < 30
        && Math.abs(data.initialPageY - tail(data.rollingPageY)!) < 30) {

        const evt = this._newGestureEvent(EventType.TAP, data.initialTarget);
        evt.pageX = tail(data.rollingPageX)!;
        evt.pageY = tail(data.rollingPageY)!;
        this._dispatchEvent(evt);

      } else if (holdTime >= Gesture._holdDelay
				&& Math.abs(data.initialPageX - tail(data.rollingPageX)!) < 30
				&& Math.abs(data.initialPageY - tail(data.rollingPageY)!) < 30) {

        const evt = this._newGestureEvent(EventType.CONTEXT_MENU, data.initialTarget);
        evt.pageX = tail(data.rollingPageX)!;
        evt.pageY = tail(data.rollingPageY)!;
        this._dispatchEvent(evt);

      } else if (activeTouchCount === 1) {
        const finalX = tail(data.rollingPageX)!;
        const finalY = tail(data.rollingPageY)!;

        const deltaT = tail(data.rollingTimestamps)! - data.rollingTimestamps[0];
        const deltaX = finalX - data.rollingPageX[0];
        const deltaY = finalY - data.rollingPageY[0];

        const dispatchTo = [...this._targets].filter(t => data.initialTarget instanceof Node && t.contains(data.initialTarget));
        this._inertia(targetWindow, dispatchTo, timestamp,
          Math.abs(deltaX) / deltaT,
          deltaX > 0 ? 1 : -1,
          finalX,
          Math.abs(deltaY) / deltaT,
          deltaY > 0 ? 1 : -1,
          finalY
        );
      }


      this._dispatchEvent(this._newGestureEvent(EventType.END, data.initialTarget));
      delete this._activeTouches[touch.identifier];
    }

    if (this._dispatched) {
      e.preventDefault();
      e.stopPropagation();
      this._dispatched = false;
    }
  }

  private _newGestureEvent(type: string, initialTarget?: EventTarget): IGestureEvent {
    const event = document.createEvent('CustomEvent') as unknown as IGestureEvent;
    event.initEvent(type, false, true);
    event.initialTarget = initialTarget;
    event.tapCount = 0;
    return event;
  }

  private _dispatchEvent(event: IGestureEvent): void {
    if (event.type === EventType.TAP) {
      const currentTime = (new Date()).getTime();
      let setTapCount = 0;
      if (currentTime - this._lastSetTapCountTime > Gesture._clearTapCountTime) {
        setTapCount = 1;
      } else {
        setTapCount = 2;
      }

      this._lastSetTapCountTime = currentTime;
      event.tapCount = setTapCount;
    } else if (event.type === EventType.CHANGE || event.type === EventType.CONTEXT_MENU) {
      this._lastSetTapCountTime = 0;
    }

    if (event.initialTarget instanceof Node) {
      for (const ignoreTarget of this._ignoreTargets) {
        if (ignoreTarget.contains(event.initialTarget)) {
          return;
        }
      }

      const targets: [number, HTMLElement][] = [];
      for (const target of this._targets) {
        if (target.contains(event.initialTarget)) {
          let depth = 0;
          let now: Node | null = event.initialTarget;
          while (now && now !== target) {
            depth++;
            now = now.parentElement;
          }
          targets.push([depth, target]);
        }
      }

      targets.sort((a, b) => a[0] - b[0]);

      for (const [, target] of targets) {
        target.dispatchEvent(event);
        this._dispatched = true;
      }
    }
  }

  private _inertia(targetWindow: Window, dispatchTo: ReadonlyArray<EventTarget>, t1: number, vX: number, dirX: number, x: number, vY: number, dirY: number, y: number): void {
    this._handle = DomUtils.scheduleAtNextAnimationFrame(targetWindow, () => {
      const now = Date.now();

      const deltaT = now - t1;
      let deltaPosX = 0;
      let deltaPosY = 0;
      let stopped = true;

      vX += Gesture._scrollFriction * deltaT;
      vY += Gesture._scrollFriction * deltaT;

      if (vX > 0) {
        stopped = false;
        deltaPosX = dirX * vX * deltaT;
      }

      if (vY > 0) {
        stopped = false;
        deltaPosY = dirY * vY * deltaT;
      }

      const evt = this._newGestureEvent(EventType.CHANGE);
      evt.translationX = deltaPosX;
      evt.translationY = deltaPosY;
      dispatchTo.forEach(d => d.dispatchEvent(evt));

      if (!stopped) {
        this._inertia(targetWindow, dispatchTo, now, vX, dirX, x + deltaPosX, vY, dirY, y + deltaPosY);
      }
    });
  }

  private _handleTouchMove(e: ITouchEvent): void {
    const timestamp = Date.now();

    for (let i = 0, len = e.changedTouches.length; i < len; i++) {

      const touch = e.changedTouches.item(i);

      if (!this._activeTouches.hasOwnProperty(String(touch.identifier))) {
        console.warn('end of an UNKNOWN touch', touch);
        continue;
      }

      const data = this._activeTouches[touch.identifier];

      const evt = this._newGestureEvent(EventType.CHANGE, data.initialTarget);
      evt.translationX = touch.pageX - tail(data.rollingPageX)!;
      evt.translationY = touch.pageY - tail(data.rollingPageY)!;
      evt.pageX = touch.pageX;
      evt.pageY = touch.pageY;
      this._dispatchEvent(evt);

      if (data.rollingPageX.length > 3) {
        data.rollingPageX.shift();
        data.rollingPageY.shift();
        data.rollingTimestamps.shift();
      }

      data.rollingPageX.push(touch.pageX);
      data.rollingPageY.push(touch.pageY);
      data.rollingTimestamps.push(timestamp);
    }

    if (this._dispatched) {
      e.preventDefault();
      e.stopPropagation();
      this._dispatched = false;
    }
  }
}
