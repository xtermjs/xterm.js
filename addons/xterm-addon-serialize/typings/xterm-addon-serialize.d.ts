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
     * @param scrollback The number of rows in scrollback buffer to serialize, starting from the bottom of the
     * scrollback buffer. This defaults to the all available rows in the scrollback buffer.
     */
    public serialize(scrollback?: number): string;

    /**
     * Disposes the addon.
     */
    public dispose(): void;
  }
}
