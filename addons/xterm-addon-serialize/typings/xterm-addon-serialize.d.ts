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

    /**
     * Serializes terminal rows into a string that can be written back to the terminal
     * to restore the state. The cursor will also be positioned to the correct cell.
     * When restoring a terminal it is best to do before `Terminal.open` is called
     * to avoid wasting CPU cycles rendering incomplete frames.
     * @param rows The number of rows to serialize, starting from the top of the
     * terminal. This defaults to the number of rows in the viewport.
     */
    public serialize(rows?: number): string;

    /**
     * Disposes the addon.
     */
    public dispose(): void;
  }
}
