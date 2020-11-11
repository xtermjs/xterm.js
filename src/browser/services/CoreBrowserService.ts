/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ICoreBrowserService } from './Services';

export class CoreBrowserService implements ICoreBrowserService {
  public serviceBrand: undefined;

  constructor(
    private _textarea: HTMLTextAreaElement
  ) {
  }

  public get isFocused(): boolean {
    const docOrShadowRoot = this._textarea.getRootNode ? this._textarea.getRootNode() as Document | ShadowRoot : document;
    return docOrShadowRoot.activeElement === this._textarea && document.hasFocus();
  }
}
