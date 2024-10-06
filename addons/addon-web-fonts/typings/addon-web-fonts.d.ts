/**
 * Copyright (c) 2024 The xterm.js authors. All rights reserved.
 * @license MIT
 */


import { Terminal, ITerminalAddon } from '@xterm/xterm';

declare module '@xterm/addon-web-fonts' {

  /**
   * Addon to use webfonts in xterm.js
   */
  export class WebFontsAddon implements ITerminalAddon {
    /**
     * @param initialRelayout Force initial relayout, if a webfont was found (default true).
     */
    constructor(initialRelayout?: boolean);
    public activate(terminal: Terminal): void;
    public dispose(): void;

    /**
     * Wait for webfont resources to be loaded.
     *
     * Without any argument, all fonts currently listed in
     * `document.fonts` will be loaded.
     * For a more fine-grained loading strategy you can populate
     * the `fonts` argument with:
     * - font families      :   loads all fontfaces in `document.fonts`
     *                          matching the family names
     * - fontface objects   :   loads given fontfaces and adds them to
     *                          `document.fonts`
     *
     * The returned promise will resolve, when all loading is done.
     */
    public loadFonts(fonts?: (string | FontFace)[]): Promise<FontFace[]>;

    /**
     * Force a terminal relayout by altering `options.FontFamily`.
     *
     * Found webfonts in `fontFamily` are temporarily removed until the webfont
     * resources are fully loaded.
     * 
     * Call this method, if a terminal with webfonts is stuck with broken
     * glyph metrics.
     * 
     * The returned promise will resolve, when font loading and layouting are done.
     */
    public relayout(): Promise<void>;
  }

  /**
   * Wait for webfont resources to be loaded.
   *
   * Without any argument, all fonts currently listed in
   * `document.fonts` will be loaded.
   * For a more fine-grained loading strategy you can populate
   * the `fonts` argument with:
   * - font families      :   loads all fontfaces in `document.fonts`
   *                          matching the family names
   * - fontface objects   :   loads given fontfaces and adds them to
   *                          `document.fonts`
   *
   * The returned promise will resolve, when all loading is done.
   */
  function loadFonts(fonts?: (string | FontFace)[]): Promise<FontFace[]>;
}
