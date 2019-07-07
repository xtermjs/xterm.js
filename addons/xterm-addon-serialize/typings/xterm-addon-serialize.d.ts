/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */


import { Terminal, ITerminalAddon } from 'xterm';

declare module 'xterm-addon-serialize' {
  /**
   * An xterm.js addon that enables web links.
   */
  export class SerializeAddon implements ITerminalAddon {

    constructor();

    /**
     * Activates the addon
     * @param terminal The terminal the addon is being loaded in.
     */
    public activate(terminal: Terminal): void;

    public serialize(rows?: number): string;

    /**
     * Disposes the addon.
     */
    public dispose(): void;
  }
}
