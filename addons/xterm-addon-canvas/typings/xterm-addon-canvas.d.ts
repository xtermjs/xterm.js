/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal, ITerminalAddon, IEvent } from 'xterm';

declare module 'xterm-addon-canvas' {
  /**
   * An xterm.js addon that provides search functionality.
   */
  export class CanvasAddon implements ITerminalAddon {
    public textureAtlas?: HTMLCanvasElement;

    constructor();

    /**
     * Activates the addon.
     * @param terminal The terminal the addon is being loaded in.
     */
    public activate(terminal: Terminal): void;

    /**
     * Disposes the addon.
     */
    public dispose(): void;

    /**
     * Clears the terminal's texture atlas and triggers a redraw.
     */
    public clearTextureAtlas(): void;
  }
}
