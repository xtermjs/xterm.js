/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal, ITerminalAddon } from 'xterm';

declare module 'xterm-addon-serialize' {
  /**
   * An xterm.js addon that enables serialization of terminal contents.
   */
  export class SerializeAddon implements ITerminalAddon {

    constructor();

    /**
     * Activates the addon.
     * @param terminal The terminal the addon is being loaded in.
     */
    public activate(terminal: Terminal): void;

    /**
     * Serializes terminal rows into a string that can be written back to the terminal to restore
     * the state. The cursor will also be positioned to the correct cell. When restoring a terminal
     * it is best to do before `Terminal.open` is called to avoid wasting CPU cycles rendering
     * incomplete frames.
     * 
     * It's recommended that you write the serialized data into a terminal of the same size in which
     * it originated from and then resize it after if needed.
     * 
     * @param options Custom options to allow control over what gets serialized.
     */
    public serialize(options?: ISerializeOptions): string;

    /**
     * Disposes the addon.
     */
    public dispose(): void;
  }

  export interface ISerializeOptions {
    /**
     * The number of rows in the scrollback buffer to serialize, starting from the bottom of the
     * scrollback buffer. When not specified, all available rows in the scrollback buffer will be
     * serialized.
     */
    scrollback?: number;

    /**
     * Whether to exclude the terminal modes from the serialization. False by default.
     */
    excludeModes?: boolean;

    /**
     * Whether to exclude the alt buffer from the serialization. False by default.
     */
    excludeAltBuffer?: boolean;
  }
}
