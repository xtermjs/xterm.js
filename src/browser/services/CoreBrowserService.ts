/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ICoreBrowserService } from './Services';

export class CoreBrowserService implements ICoreBrowserService {
  public serviceBrand: undefined;

  private _isFocused = false;
  private _cachedIsFocused: boolean | undefined = undefined;

  constructor(
    private _textarea: HTMLTextAreaElement,
    public readonly window: Window & typeof globalThis
  ) {
    this._textarea.addEventListener('focus', () => this._isFocused = true);
    this._textarea.addEventListener('blur', () => this._isFocused = false);
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
