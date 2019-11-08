/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ICoreBrowserService } from './Services';

export class CoreBrowserService implements ICoreBrowserService {
  serviceBrand: any;

  constructor(
    private _textarea: HTMLTextAreaElement
  ) {
  }

  public get isFocused(): boolean {
    return document.activeElement === this._textarea && document.hasFocus();
  }
}
