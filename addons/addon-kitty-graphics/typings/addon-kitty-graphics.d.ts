/**
 * Copyright (c) 2025 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal, ITerminalAddon, IDisposable } from '@xterm/xterm';

declare module '@xterm/addon-kitty-graphics' {
  /**
   * An xterm.js addon that provides support for the Kitty graphics protocol.
   * This allows applications to display images in the terminal using APC
   * escape sequences.
   */
  export class KittyGraphicsAddon implements ITerminalAddon, IDisposable {
    /**
     * Creates a new Kitty graphics addon.
     * @param options Optional configuration for the addon.
     */
    constructor(options?: IKittyGraphicsOptions);

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
     * Gets the current images stored in the addon.
     * Returns a map of image IDs to their image data.
     */
    public readonly images: ReadonlyMap<number, IKittyImage>;
  }

  /**
   * Options for the Kitty graphics addon.
   */
  export interface IKittyGraphicsOptions {
    /**
     * Enable debug logging of received graphics commands.
     * Default: false
     */
    debug?: boolean;
  }

  /**
   * Represents a stored Kitty graphics image.
   */
  export interface IKittyImage {
    /**
     * The image ID assigned by the terminal or the application.
     */
    id: number;

    /**
     * The image data as a base64 string or ImageData object.
     */
    data: string | ImageData;

    /**
     * Width of the image in pixels.
     */
    width: number;

    /**
     * Height of the image in pixels.
     */
    height: number;

    /**
     * Format of the image data.
     * - 24: RGB (3 bytes per pixel)
     * - 32: RGBA (4 bytes per pixel)
     * - 100: PNG
     */
    format: 24 | 32 | 100;
  }
}
