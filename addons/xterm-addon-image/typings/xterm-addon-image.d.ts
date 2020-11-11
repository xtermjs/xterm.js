/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal, ITerminalAddon } from 'xterm';

declare module 'xterm-addon-image' {
  export interface IImageAddonOptions {
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
  }

  export class ImageAddon implements ITerminalAddon {
    constructor(options?: IImageAddonOptions);
    public activate(terminal: Terminal): void;
    public dispose(): void;
    public reset(): void;
  }
}
