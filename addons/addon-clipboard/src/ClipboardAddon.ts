/**
 * Copyright (c) 2023 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { IDisposable, ITerminalAddon, Terminal } from '@xterm/xterm';
import { type IClipboardProvider, ClipboardSelectionType } from '@xterm/addon-clipboard';
import { Base64 as JSBase64 } from 'js-base64';

export class ClipboardAddon implements ITerminalAddon {
  private _terminal?: Terminal;
  private _disposable?: IDisposable;

  constructor(private _provider: IClipboardProvider = new ClipboardProvider()) {
    this._provider = _provider;
  }

  public activate(terminal: Terminal): void {
    this._disposable = terminal.parser.registerOscHandler(52, this._setOrReportClipboard);
    this._terminal = terminal;
  }

  public dispose(): void {
    return this._disposable?.dispose();
  }

  private _setOrReportClipboard(data: string): boolean | Promise<boolean> {
    const args = data.split(';');
    if (args.length < 2) {
      return true;
    }

    const pc = args[0];
    const pd = args[1];
    if (pd.length === 0) {
      return true;
    }

    switch (pc) {
      case ClipboardSelectionType.SYSTEM:
      case ClipboardSelectionType.PRIMARY:
        try {
          if (pd === '?') {
            // Report clipboard
            return this._provider.readText(pc).then(data => {
              this._terminal?.input(`\x1b]52;${pc};${data}\x07`, false);
              return true;
            });
          }
          return this._provider.writeText(pc, pd).then(() => true);
        } catch (e) {
          console.error(e);
        }
    }

    return true;
  }
}

export class ClipboardProvider implements IClipboardProvider {
  private _base64: IBase64;
  public limit: number;

  constructor(
    /**
     * The base64 encoder/decoder to use.
     */
    base64: IBase64 = new Base64(),

    /**
     * The maximum amount of data that can be copied to the clipboard.
     * Zero means no limit.
     */
    limit: number = 0 // unlimited
  ){
    this._base64 = base64;
    this.limit = limit;
  }

  public readText(selection: ClipboardSelectionType): Promise<string> {
    if (selection !== 'c') {
      return Promise.resolve('');
    }
    return navigator.clipboard.readText().then(this._base64.encodeText);
  }

  public writeText(selection: ClipboardSelectionType, data: string): Promise<void> {
    if (selection !== 'c' || (this.limit > 0 && data.length > this.limit)) {
      return Promise.resolve();
    }
    try {
      const text = this._base64.decodeText(data);
      return navigator.clipboard.writeText(text);
    } catch {
      // clear the clipboard if the data is not valid base64
      return navigator.clipboard.writeText('');
    }
  }
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

export class Base64 implements IBase64 {
  public encodeText(data: string): string {
    return JSBase64.encode(data);
  }
  public decodeText(data: string): string {
    const text = JSBase64.decode(data);
    if (!JSBase64.isValid(data) || JSBase64.encode(text) !== data) {
      return '';
    }
    return text;
  }
}
