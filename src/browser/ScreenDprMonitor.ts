/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ICoreBrowserService } from 'browser/services/Services';
import { EventEmitter } from 'common/EventEmitter';
import { Disposable, toDisposable } from 'common/Lifecycle';

/**
 * The screen device pixel ratio monitor allows listening for when the
 * window.devicePixelRatio value changes. This is done not with polling but with
 * the use of window.matchMedia to watch media queries. When the event fires,
 * the listener will be reattached using a different media query to ensure that
 * any further changes will register.
 *
 * The listener should fire on both window zoom changes and switching to a
 * monitor with a different DPI.
 */
export class ScreenDprMonitor extends Disposable {
  private _currentDevicePixelRatio: number;
  private _outerListener: ((this: MediaQueryList, ev: MediaQueryListEvent) => any) | undefined;
  private _resolutionMediaMatchList: MediaQueryList | undefined;
  private _parentWindow: Window;

  private readonly _onDprChange = this.register(new EventEmitter<number>());
  public readonly onDprChange = this._onDprChange.event;

  constructor(@ICoreBrowserService coreBrowserService: ICoreBrowserService) {
    super();

    this._parentWindow = coreBrowserService.window;

    // Initialize listener and dpr value
    this._outerListener = () => {
      if (this._parentWindow.devicePixelRatio !== this._currentDevicePixelRatio) {
        this._onDprChange.fire(this._parentWindow.devicePixelRatio);
      }
      this._updateDpr();
    };
    this._currentDevicePixelRatio = this._parentWindow.devicePixelRatio;
    this._updateDpr();

    // Listen for window changes
    this.register(coreBrowserService.onWindowChange(w => {
      this._parentWindow = w;
      if (this._parentWindow.devicePixelRatio !== this._currentDevicePixelRatio) {
        this._onDprChange.fire(this._parentWindow.devicePixelRatio);
      }
      this._updateDpr();
    }));

    // Setup additional disposables
    this.register(toDisposable(() => this.clearListener()));
  }

  public setListener(): void {
  }

  private _updateDpr(): void {
    if (!this._outerListener) {
      return;
    }

    // Clear listeners for old DPR
    this._resolutionMediaMatchList?.removeListener(this._outerListener);

    // Add listeners for new DPR
    this._currentDevicePixelRatio = this._parentWindow.devicePixelRatio;
    this._resolutionMediaMatchList = this._parentWindow.matchMedia(`screen and (resolution: ${this._parentWindow.devicePixelRatio}dppx)`);
    this._resolutionMediaMatchList.addListener(this._outerListener);
  }

  public clearListener(): void {
    if (!this._resolutionMediaMatchList || !this._outerListener) {
      return;
    }
    this._resolutionMediaMatchList.removeListener(this._outerListener);
    this._resolutionMediaMatchList = undefined;
    this._outerListener = undefined;
  }
}
