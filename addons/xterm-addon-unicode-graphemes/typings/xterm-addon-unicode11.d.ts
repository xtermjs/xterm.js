/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal, ITerminalAddon } from 'xterm';

declare module 'xterm-addon-unicode11' {
  export class Unicode11Addon implements ITerminalAddon {
    constructor();
    public activate(terminal: Terminal): void;
    public dispose(): void;
  }
}
