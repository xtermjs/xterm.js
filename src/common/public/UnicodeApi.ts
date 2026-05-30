/**
 * Copyright (c) 2021 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { ICoreTerminal } from 'common/terminal/CoreTerminalTypes';
import { IUnicodeHandling, IUnicodeVersionProvider } from '@xterm/xterm';

export class UnicodeApi implements IUnicodeHandling {
  constructor(private _core: ICoreTerminal) { }

  public register(provider: IUnicodeVersionProvider): void {
    this._core.unicodeService.register(provider);
  }

  public get versions(): string[] {
    return this._core.unicodeService.versions;
  }

  public get activeVersion(): string {
    return this._core.unicodeService.activeVersion;
  }

  public set activeVersion(version: string) {
    this._core.unicodeService.activeVersion = version;
  }
}
