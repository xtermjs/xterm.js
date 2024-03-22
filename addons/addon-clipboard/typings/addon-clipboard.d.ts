/**
 * Copyright (c) 2023 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal, ITerminalAddon, IClipboardProvider, ClipboardSelection as ClipboardSelectionType } from 'xterm';

declare module '@xterm/addon-clipboard' {
  export class ClipboardProvider implements IClipboardProvider{
    public readText(selection: ClipboardSelectionType): Promise<string>;
    public writeText(selection: ClipboardSelectionType, data: string): Promise<void>;
  }

  /**
   * An xterm.js addon that enables accessing the system clipboard from
   * xterm.js.
   */
  export class ClipboardAddon implements ITerminalAddon {
    /**
     * Creates a new clipboard addon.
     */
    constructor(_provider: IClipboardProvider);

    /**
     * Activates the addon
     * @param terminal The terminal the addon is being loaded in.
     */
    public activate(terminal: Terminal): void;

    /**
     * Disposes the addon.
     */
    public dispose(): void
  }
}
