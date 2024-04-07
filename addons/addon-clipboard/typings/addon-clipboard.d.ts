/**
 * Copyright (c) 2023 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal, ITerminalAddon } from '@xterm/xterm';

declare module '@xterm/addon-clipboard' {
  /**
   * An xterm.js addon that enables accessing the system clipboard from
   * xterm.js.
   */
  export class ClipboardAddon implements ITerminalAddon {
    /**
     * Creates a new clipboard addon.
     */
    constructor(provider?: IClipboardProvider);

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

  /**
   * The clipboard provider interface that enables xterm.js to access the system clipboard.
   */
  export class ClipboardProvider implements IClipboardProvider{
    /**
     * Creates a new clipboard provider.
     * @param _base64 The base64 encoder/decoder to use.
     */
    constructor(base64?: IBase64, limit?: number);

    /**
     * Reads text from the clipboard.
     * @param selection The selection type to read from.
     * @returns A promise that resolves with the text from the clipboard.
     */
    public readText(selection: ClipboardSelectionType): Promise<string>;

    /**
     * Writes text to the clipboard.
     * @param selection The selection type to write to.
     * @param data The text to write to the clipboard.
     * @returns A promise that resolves when the text has been written to the clipboard.
     */
    public writeText(selection: ClipboardSelectionType, data: string): Promise<void>;
  }


  export interface IBase64 {
    /**
    * Converts a utf-8 string to a base64 string.
    * @param data The utf-8 string to convert to base64 string.
    */
    encodeText(data: string): string;

    /**
    * Converts a base64 string to a utf-8 string.
    * @param data The base64 string to convert to utf-8 string.
    */
    decodeText(data: string): string;
  }

  export interface IClipboardProvider {
    /**
     * Gets the clipboard content.
     * @param selection The clipboard selection to read.
     * @returns A promise that resolves with the base64 encoded data.
     */
    readText(selection: ClipboardSelectionType): Promise<string>;

    /**
     * Sets the clipboard content.
     * @param selection The clipboard selection to set.
     * @param data The base64 encoded data to set. If the data is invalid
     * base64, the clipboard is cleared.
     */
    writeText(selection: ClipboardSelectionType, data: string): Promise<void>;
  }

  /**
   * Clipboard selection type. This is used to specify which selection buffer to
   * read or write to.
   * - SYSTEM `c`: The system clipboard.
   * - PRIMARY `p`: The primary clipboard. This is provided for compatibility
   *  with Linux X11.
   */
  export const enum ClipboardSelectionType {
    SYSTEM = 'c',
    PRIMARY = 'p',
  }
}
