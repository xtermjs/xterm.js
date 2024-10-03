/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */


import { Terminal, ITerminalAddon, IViewportRange } from '@xterm/xterm';

declare module '@xterm/addon-web-fonts' {
  /**
   * An xterm.js addon that enables web links.
   */
  export class WebFontsAddon implements ITerminalAddon {
    constructor();
    public activate(terminal: Terminal): void;
    public dispose(): void;
  }
}
