/**
 * Copyright (c) 2023 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * UnicodeVersionProvider for V15 with grapeme cluster handleing.
 */

import { Terminal, ITerminalAddon, IUnicodeHandling } from 'xterm';
import { UnicodeGraphemeProvider } from './UnicodeGraphemeProvider';


export class UnicodeGraphemesAddon implements ITerminalAddon {
  private _provider?: UnicodeGraphemeProvider;
  private _unicode?: IUnicodeHandling;
  private _oldVersion: string = '';

  public activate(terminal: Terminal): void {
    if (! this._provider) {
      this._provider = new UnicodeGraphemeProvider();
    }
    const unicode = terminal.unicode;
    this._unicode = unicode;
    unicode.register(this._provider);
    this._oldVersion = unicode.activeVersion;
    unicode.activeVersion = '15-graphemes';
  }

  public dispose(): void {
    if (this._unicode) {
      this._unicode.activeVersion = this._oldVersion;
    }
  }
}
