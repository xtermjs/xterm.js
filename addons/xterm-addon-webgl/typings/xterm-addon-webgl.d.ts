/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal, IDisposable, ITerminalAddon } from 'xterm';

declare module 'xterm-addon-webgl' {
  /**
   * An xterm.js addon that provides search functionality.
   */
  export class WebglAddon implements ITerminalAddon {
    constructor(preserveDrawingBuffer?: boolean);

    /**
     * Activates the addon
     * @param terminal The terminal the addon is being loaded in.
     */
    public activate(terminal: Terminal): void;

    /**
     * Disposes the addon.
     */
    public dispose(): void;
  }
}
