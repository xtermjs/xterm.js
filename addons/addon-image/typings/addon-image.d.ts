/**
 * Copyright (c) 2022 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal, ITerminalAddon } from '@xterm/xterm';

declare module '@xterm/addon-image' {
  export interface IImageAddonOptions {
    /**
     * Enable size reports in windowOptions:
     * - getWinSizePixels (CSI 14 t)
     * - getCellSizePixels (CSI 16 t)
     * - getWinSizeChars (CSI 18 t)
     *
     * If `true` (default), the reports will be activated during addon loading.
     * If `false`, no settings will be touched. Use `false`, if you have high
     * security constraints and/or deal with windowOptions by other means.
     * On addon disposal, the settings will not change.
     */
    enableSizeReports?: boolean;

    /**
     * Maximum pixels a single image may hold. Images exceeding this number will
     * be discarded during processing with no changes to the terminal buffer
     * (no cursor advance, no placeholder).
     * This setting is mainly used to restrict images sizes during initial decoding
     * including the final canvas creation.
     *
     * Note: The image worker decoder may hold additional memory up to
     * `pixelLimit` * 4 bytes permanently, plus the same amount on top temporarily
     * for pixel transfers, which should be taken into account under memory pressure conditions.
     *
     * Note: Browsers restrict allowed canvas dimensions further. We dont reflect those
     * limits here, thus the construction of an oddly shaped image having most pixels
     * in one dimension still can fail.
     *
     * Note: `storageLimit` bytes are calculated from images by multiplying the pixels with 4
     * (4 channels with one byte, images are stored as RGBA8888).
     *
     * Default is 2^16 (4096 x 4096 pixels).
     */
    pixelLimit?: number;

    /**
     * Storage limit in MB.
     * The storage implements a FIFO cache removing old images, when the limit gets hit.
     * Also exposed as addon property for runtime adjustments.
     * Default is 128 MB.
     */
    storageLimit?: number;

    /**
     * Whether to show a placeholder for images removed from cache, default is true.
     */
    showPlaceholder?: boolean;

    /**
     * SIXEL settings
     */

    /** Whether SIXEL is enabled (default is true). */
    sixelSupport?: boolean;
    /** Whether SIXEL scrolling is enabled (default is true). Same as DECSET 80. */
    sixelScrolling?: boolean;
    /** Palette color limit (default 256). */
    sixelPaletteLimit?: number;
    /** SIXEL image size limit in bytes (default 25000000 bytes). */
    sixelSizeLimit?: number;

    /**
     * IIP settings (iTerm image protocol)
     */

    /** Whether iTerm image protocol style is enabled (default is true). */
    iipSupport?: boolean;
    /** IIP sequence size limit (default 20000000 bytes). */
    iipSizeLimit?: number;
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

    /**
     * Get original image canvas at buffer position.
     */
    public getImageAtBufferCell(x: number, y: number): HTMLCanvasElement | undefined;

    /**
     * Extract single tile canvas at buffer position.
     */
    public extractTileAtBufferCell(x: number, y: number): HTMLCanvasElement | undefined;
  }
}
