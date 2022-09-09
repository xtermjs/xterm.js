/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ICoreBrowserService } from './Services';

export class CoreBrowserService implements ICoreBrowserService {
  public serviceBrand: undefined;

  constructor(
    private _textarea: HTMLTextAreaElement,
    public readonly window: Window & typeof globalThis
  ) {
  }

  public get dpr(): number {
    return this.window.devicePixelRatio;
  }

  public get isFocused(): boolean {
    const docOrShadowRoot = this._textarea.getRootNode ? this._textarea.getRootNode() as Document | ShadowRoot : this._textarea.ownerDocument;
    return docOrShadowRoot.activeElement === this._textarea && this._textarea.ownerDocument.hasFocus();
  }
}
