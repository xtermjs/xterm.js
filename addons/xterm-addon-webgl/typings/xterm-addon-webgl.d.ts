/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal, ITerminalAddon, IEvent } from 'xterm';

declare module 'xterm-addon-webgl' {
  /**
   * An xterm.js addon that provides search functionality.
   */
  export class WebglAddon implements ITerminalAddon {
    public textureAtlas?: HTMLCanvasElement;

    /**
     * An event that is fired when the renderer loses its canvas context.
     */
     public get onContextLoss(): IEvent<void>;

    /**
     * An event that is fired when the texture atlas of the renderer changes.
     */
    public get onChangeTextureAtlas(): IEvent<HTMLCanvasElement>;

    constructor(preserveDrawingBuffer?: boolean);

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
