/**
 * Copyright (c) 2023 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { IDisposable, ITerminalAddon, Terminal } from '@xterm/xterm';
import { type IClipboardProvider, ClipboardSelectionType, type IBase64 } from '@xterm/addon-clipboard';
import { Base64 as JSBase64 } from 'js-base64';

export class ClipboardAddon implements ITerminalAddon {
  private _terminal?: Terminal;
  private _disposable?: IDisposable;

  constructor(
    private _base64: IBase64 = new Base64(),
    private _provider: IClipboardProvider = new BrowserClipboardProvider()
  ) {}

  public activate(terminal: Terminal): void {
    this._terminal = terminal;
    this._disposable = terminal.parser.registerOscHandler(52, data => this._setOrReportClipboard(data));
  }

  public dispose(): void {
    return this._disposable?.dispose();
  }

  private _readText(sel: ClipboardSelectionType, data: string): void {
    const b64 = this._base64.encodeText(data);
    this._terminal?.input(`\x1b]52;${sel};${b64}\x07`, false);
  }

  private _setOrReportClipboard(data: string): boolean | Promise<boolean> {
    const args = data.split(';');
    if (args.length < 2) {
      return true;
    }

    const pc = args[0] as ClipboardSelectionType;
    const pd = args[1];
    if (pd === '?') {
      const text = this._provider.readText(pc);

      // Report clipboard
      if (text instanceof Promise) {
        return text.then((data) => {
          this._readText(pc, data);
          return true;
        });
      }

      this._readText(pc, text);
      return true;
    }

    // Clear clipboard if text is not a base64 encoded string.
    let text = '';
    try {
      text = this._base64.decodeText(pd);
    } catch {}


    const result = this._provider.writeText(pc, text);
    if (result instanceof Promise) {
      return result.then(() => true);
    }

    return true;
  }
}

export class BrowserClipboardProvider implements IClipboardProvider {
  public async readText(selection: ClipboardSelectionType): Promise<string> {
    if (selection !== 'c') {
      return Promise.resolve('');
    }
    return navigator.clipboard.readText();
  }

  public async writeText(selection: ClipboardSelectionType, text: string): Promise<void> {
    if (selection !== 'c') {
      return Promise.resolve();
    }
    return navigator.clipboard.writeText(text);
  }
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
