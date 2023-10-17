/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Disposable } from 'common/Lifecycle';
import { ICoreBrowserService } from './Services';
import { EventEmitter } from 'common/EventEmitter';

export class CoreBrowserService extends Disposable implements ICoreBrowserService {
  public serviceBrand: undefined;

  private _isFocused = false;
  private _cachedIsFocused: boolean | undefined = undefined;

  private readonly _onWindowChange = this.register(new EventEmitter<Window & typeof globalThis>());
  public readonly onWindowChange = this._onWindowChange.event;

  constructor(
    private _textarea: HTMLTextAreaElement,
    // TODO: Add getter and setter and event
    private _window: Window & typeof globalThis,
    public readonly mainDocument: Document
  ) {
    super();

    this._textarea.addEventListener('focus', () => this._isFocused = true);
    this._textarea.addEventListener('blur', () => this._isFocused = false);
  }

  public get window(): Window & typeof globalThis {
    return this._window;
  }

  public set window(value: Window & typeof globalThis) {
    if (this._window !== value) {
      this._window = value;
      this._onWindowChange.fire(this._window);
    }
  }

  public get dpr(): number {
    return this.window.devicePixelRatio;
  }

  public get isFocused(): boolean {
    if (this._cachedIsFocused === undefined) {
      this._cachedIsFocused = this._isFocused && this._textarea.ownerDocument.hasFocus();
      queueMicrotask(() => this._cachedIsFocused = undefined);
    }
    return this._cachedIsFocused;
  }
}
