/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal, ITerminalAddon } from 'xterm';

declare module 'xterm-addon-image' {
  export interface IImageAddonOptions {
    /**
     * Path to the worker file.
     * Must be the path to the worker JS file directly loadable
     * in the integration as with `new Worker(path)`.
     *
     * You most likely want to customize this,
     * the hardcoded default '/workers/xterm-addon-image-worker.js'
     * is derived from demo integration of the xterm.js repo.
     */
    workerPath?: string;
    /**
     * Enable size reports in windowOptions:
     * - getWinSizePixels (CSI 14 t)
     * - getCellSizePixels (CSI 16 t)
     * - getWinSizeChars (CSI 18 t)
     *
     * If `true` (default), the reports will be activated during addon loading.
     * If `false`, no settings will be touched. Use this, if you have high
     * security constraints and/or deal with windowOptions by other means.
     * On addon disposal, the settings will not change.
     */
    enableSizeReports?: boolean;
    /**
     * Leave cursor to right of image.
     * This has no effect, if an image covers all cells to the right.
     * Same as DECSET 8452, default is false.
     */
    cursorRight?: boolean;
    /**
     * Leave cursor below the first row of an image, scrolling if needed.
     * If disabled, the cursor is left at the beginning of the next line.
     * This settings is partially overwritten by `cursorRight`, if an image
     * does not cover all cells to the right.
     * Same as DECSET 7730, default is false.
     */
    cursorBelow?: boolean;

    /**
     * SIXEL settings
     */
    // Whether SIXEL is enabled (default is true).
    sixelSupport?: boolean;
    // Whether SIXEL scrolling is enabled (default is true). Same as DECSET 80.
    sixelScrolling?: boolean;
    // Palette color limit (default 256).
    sixelPaletteLimit?: number;
    // SIXEL image size limit in bytes (default 25000000).
    sixelSizeLimit?: number;
    // Whether to use private palettes for SIXEL sequences (default is true). Same as DECSET 1070.
    sixelPrivatePalette?: boolean;
    // Default start palette (default 'ANSI256').
    sixelDefaultPalette?: 'VT340-COLOR' | 'VT340-GREY' | 'ANSI256';

    /**
     * TODO: iTerm image protocol support
     */

    /**
     * TODO: storage settings
     */
    // storage limit in MBs (default 100 MB)
    storageLimit: number;
    // whether to show a placeholder for evicted images
    showPlaceholder?: boolean;
  }

  export class ImageAddon implements ITerminalAddon {
    constructor(options?: IImageAddonOptions);
    public activate(terminal: Terminal): void;
    public dispose(): void;

    /**
     * Reset the image addon.
     *
     * This resets all runtime options to default values (as given to the ctor)
     * and resets the image storage.
     */
    public reset(): void;

    /**
     * Getter/Setter for the storageLimit in MB.
     * Synchronously deletes images if the stored data exceeds the new value.
     */
    public storageLimit: number;

    /**
     * Current memory usage of the stored images in MB.
     */
    public readonly storageUsage: number;

    /**
     * Getter/Setter whether the placeholder should be shown.
     */
    public showPlaceholder: boolean;
  }
}
