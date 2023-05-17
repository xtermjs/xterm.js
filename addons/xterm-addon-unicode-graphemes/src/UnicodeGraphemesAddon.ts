/**
 * Copyright (c) 2023 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * UnicodeVersionProvider for V15 with grapeme cluster handleing.
 */

import { Terminal, ITerminalAddon } from 'xterm';
import { UnicodeGraphemeProvider } from './UnicodeGraphemeProvider';


export class UnicodeGraphemesAddon implements ITerminalAddon {
  public activate(terminal: Terminal): void {
    terminal.unicode.register(new UnicodeGraphemeProvider());
  }
  public dispose(): void { }
}
