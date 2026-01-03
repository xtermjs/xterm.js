/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal, ITerminalAddon, IEvent } from '@xterm/xterm';

declare module '@xterm/addon-webgl' {
  /**
   * An xterm.js addon that provides hardware-accelerated rendering functionality via WebGL.
   */
  export class WebglAddon implements ITerminalAddon {
    public textureAtlas?: HTMLCanvasElement;

    /**
     * An event that is fired when the renderer loses its canvas context.
     */
    public readonly onContextLoss: IEvent<void>;

    /**
     * An event that is fired when the texture atlas of the renderer changes.
     */
    public readonly onChangeTextureAtlas: IEvent<HTMLCanvasElement>;

    /**
     * An event that is fired when the a new page is added to the texture atlas.
     */
    public readonly onAddTextureAtlasCanvas: IEvent<HTMLCanvasElement>;

    /**
     * An event that is fired when the a page is removed from the texture atlas.
     */
    public readonly onRemoveTextureAtlasCanvas: IEvent<HTMLCanvasElement>;

    constructor(options?: IWebglAddonOptions);

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

  export interface IWebglAddonOptions {
    /**
     * Whether to draw custom glyphs instead of using the font for the following
     * unicode ranges:
     *
     * - Box Drawing (U+2500-U+257F)
     * - Block Elements (U+2580-U+259F)
     * - Braille Patterns (U+2800-U+28FF)
     * - Powerline Symbols (U+E0A0-U+E0D4, Private Use Area with widespread
     *   adoption)
     * - Progress Indicators (U+EE00-U+EE0B, Private Use Area initially added in
     *   [Fira Code](https://github.com/tonsky/FiraCode) and later
     *   [Nerd Fonts](https://github.com/ryanoasis/nerd-fonts/pull/1733)).
     * - Git Branch Symbols (U+F5D0-U+F60D, Private Use Area initially adopted
     *   in [Kitty in 2024](https://github.com/kovidgoyal/kitty/pull/7681) by
     *   author of [vim-flog](https://github.com/rbong/vim-flog))
     * - Symbols for Legacy Computing (U+1FB00-U+1FBFF)
     *
     * This will typically result in better rendering with continuous lines,
     * even when line height and letter spacing is used. The default is true.
     */
    customGlyphs?: boolean;

    /**
     * Whether to enable the preserveDrawingBuffer flag when creating the WebGL
     * context. This may be useful in tests. This default is false.
     */
    preserveDrawingBuffer?: boolean
  }
}
