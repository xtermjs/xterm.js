/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Disposable } from 'common/Lifecycle';
import { ICoreBrowserService } from './Services';
import { EventEmitter, forwardEvent } from 'common/EventEmitter';
import { ScreenDprMonitor } from 'browser/ScreenDprMonitor';

export class CoreBrowserService extends Disposable implements ICoreBrowserService {
  public serviceBrand: undefined;

  private _isFocused = false;
  private _cachedIsFocused: boolean | undefined = undefined;
  private _screenDprMonitor = new ScreenDprMonitor(this._window);

  private readonly _onDprChange = this.register(new EventEmitter<number>());
  public readonly onDprChange = this._onDprChange.event;
  private readonly _onWindowChange = this.register(new EventEmitter<Window & typeof globalThis>());
  public readonly onWindowChange = this._onWindowChange.event;

  constructor(
    private _textarea: HTMLTextAreaElement,
    private _window: Window & typeof globalThis,
    public readonly mainDocument: Document
  ) {
    super();

    this.register(this.onWindowChange(w => this._screenDprMonitor.setWindow(w)));
    this.register(forwardEvent(this._screenDprMonitor.onDprChange, this._onDprChange));

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
