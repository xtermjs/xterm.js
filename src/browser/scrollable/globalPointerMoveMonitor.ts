/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from './dom';
import { DisposableStore, IDisposable, toDisposable } from './lifecycle';

export interface IPointerMoveCallback {
  (event: PointerEvent): void;
}

export interface IOnStopCallback {
  (browserEvent?: PointerEvent | KeyboardEvent): void;
}

export class GlobalPointerMoveMonitor implements IDisposable {

  private readonly _hooks = new DisposableStore();
  private _pointerMoveCallback: IPointerMoveCallback | null = null;
  private _onStopCallback: IOnStopCallback | null = null;

  public dispose(): void {
    this.stopMonitoring(false);
    this._hooks.dispose();
  }

  public stopMonitoring(invokeStopCallback: boolean, browserEvent?: PointerEvent | KeyboardEvent): void {
    if (!this.isMonitoring()) {
      return;
    }

    this._hooks.clear();
    this._pointerMoveCallback = null;
    const onStopCallback = this._onStopCallback;
    this._onStopCallback = null;

    if (invokeStopCallback && onStopCallback) {
      onStopCallback(browserEvent);
    }
  }

  public isMonitoring(): boolean {
    return !!this._pointerMoveCallback;
  }

  public startMonitoring(
    initialElement: Element,
    pointerId: number,
    initialButtons: number,
    pointerMoveCallback: IPointerMoveCallback,
    onStopCallback: IOnStopCallback
  ): void {
    if (this.isMonitoring()) {
      this.stopMonitoring(false);
    }
    this._pointerMoveCallback = pointerMoveCallback;
    this._onStopCallback = onStopCallback;

    let eventSource: Element | Window = initialElement;

    try {
      initialElement.setPointerCapture(pointerId);
      this._hooks.add(toDisposable(() => {
        try {
          initialElement.releasePointerCapture(pointerId);
        } catch (err) {
          // ignore
        }
      }));
    } catch (err) {
      eventSource = dom.getWindow(initialElement);
    }

    this._hooks.add(dom.addDisposableListener(
      eventSource,
      dom.EventType.POINTER_MOVE,
      (e) => {
        if (e.buttons !== initialButtons) {
          this.stopMonitoring(true);
          return;
        }

        e.preventDefault();
        this._pointerMoveCallback!(e);
      }
    ));

    this._hooks.add(dom.addDisposableListener(
      eventSource,
      dom.EventType.POINTER_UP,
      (e: PointerEvent) => this.stopMonitoring(true)
    ));
  }
}
