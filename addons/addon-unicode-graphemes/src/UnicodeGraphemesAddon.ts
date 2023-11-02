/**
 * Copyright (c) 2023 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * UnicodeVersionProvider for V15 with grapeme cluster handleing.
 */

import type { Terminal, ITerminalAddon, IUnicodeHandling } from '@xterm/xterm';
import type { UnicodeGraphemesAddon as IUnicodeGraphemesApi } from '@xterm/addon-unicode-graphemes';
import { UnicodeGraphemeProvider } from './UnicodeGraphemeProvider';

export class UnicodeGraphemesAddon implements ITerminalAddon , IUnicodeGraphemesApi {
  private _provider15Graphemes?: UnicodeGraphemeProvider;
  private _provider15?: UnicodeGraphemeProvider;
  private _unicode?: IUnicodeHandling;
  private _oldVersion: string = '';

  public activate(terminal: Terminal): void {
    if (! this._provider15) {
      this._provider15 = new UnicodeGraphemeProvider(false);
    }
    if (! this._provider15Graphemes) {
      this._provider15Graphemes = new UnicodeGraphemeProvider(true);
    }
    const unicode = terminal.unicode;
    this._unicode = unicode;
    unicode.register(this._provider15);
    unicode.register(this._provider15Graphemes);
    this._oldVersion = unicode.activeVersion;
    unicode.activeVersion = '15-graphemes';
  }

  public dispose(): void {
    if (this._unicode) {
      this._unicode.activeVersion = this._oldVersion;
    }
  }
}
