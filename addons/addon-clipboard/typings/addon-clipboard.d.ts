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
     * @param base64 An optional base64 encoder/decoder.
     * @param provider An optional clipboard provider.
     */
    constructor(base64?: IBase64, provider?: IClipboardProvider);

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

  export interface IBase64 {
    /**
    * Converts a utf-8 string to a base64 string.
    * @param data The utf-8 string to convert to base64 string.
    */
    encodeText(data: string): string;

    /**
    * Converts a base64 string to a utf-8 string.
    * @param data The base64 string to convert to utf-8 string.
    * @throws An error if the input is not valid base64.
    */
    decodeText(data: string): string;
  }

  /**
   * A default Base64 encoding and decoding type.
   **/
  export class Base64 implements IBase64 {
    /**
     * Converts a utf-8 string to a base64 string.
     * @param data The utf-8 string to convert to base64 string.
     */
    public encodeText(data: string): string;

    /**
     * Converts a base64 string to a utf-8 string.
     * @param data The base64 string to convert to utf-8 string.
     * @throws An error if the input is not valid base64.
     */
    public decodeText(data: string): string;
  }

  export interface IClipboardProvider {
    /**
     * Gets the clipboard content.
     * @param selection The clipboard selection to read (see OSC 52 spec of xterm).
     * @returns A promise that resolves with clipboard selection data.
     */
    readText(selection: string): string | Promise<string>;

    /**
     * Sets the clipboard content.
     * @param selection The clipboard selection to set (see OSC 52 spec of xterm).
     * @param data The clipboard text to write.
     */
    writeText(selection: string, text: string): void | Promise<void>;
  }

  /**
   * The clipboard provider interface that enables xterm.js to access the browser clipboard.
   *
   * Note this this clipboard provider does not implement own cut buffers as xterm does,
   * but redirect the selection parameter always to navigator.clipboard.
   */
  export class BrowserClipboardProvider implements IClipboardProvider{
    /**
     * Reads text from the clipboard.
     * @param selection The selection type to read from (always refers to navigator.clipboard).
     * @returns A promise that resolves with the text from the clipboard.
     */
    public readText(selection: string): Promise<string>;

    /**
     * Writes text to the clipboard.
     * @param selection The selection type to write to (always refers to navigator.clipboard).
     * @param data The text to write to the clipboard.
     * @returns A promise that resolves when the text has been written to the clipboard.
     */
    public writeText(selection: string, data: string): Promise<void>;
  }
}
