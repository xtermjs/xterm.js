/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * This contains the type declarations for the xterm-addon-ligatures library.
 * Note that some interfaces may differ between this file and the actual
 * implementation in src/, that's because this file declares the *public* API
 * which is intended to be stable and consumed by external programs.
 */

import { Terminal, ITerminalAddon } from 'xterm';

declare module 'xterm-addon-ligatures' {
  /**
   * An xterm.js addon that enables web links.
   */
  export class LigaturesAddon implements ITerminalAddon {
    /**
     * Creates a new ligatures addon.
     */
    constructor();

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
