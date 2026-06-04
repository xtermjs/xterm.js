/**
 * Copyright (c) 2023 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { IDisposable, ITerminalAddon, Terminal } from '@xterm/xterm';
import { type IClipboardProvider, type IBase64 } from '@xterm/addon-clipboard';

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

  private _readText(sel: string, data: string): void {
    const b64 = this._base64.encodeText(data);
    this._terminal?.input(`\x1b]52;${sel};${b64}\x07`, false);
  }

  private _setOrReportClipboard(data: string): boolean | Promise<boolean> {
    const args = data.split(';');
    if (args.length < 2) {
      return true;
    }

    const pc = args[0];
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
  public readText(selection: string): Promise<string> {
    return navigator.clipboard.readText();
  }

  public writeText(selection: string, text: string): Promise<void> {
    return navigator.clipboard.writeText(text);
  }
}

/**
 * TODO: Once the base64 handling on Uint8Arrays is more common,
 * remove the btoa/atob fallbacks below.
 */
interface Uint8ArrayB64 extends Uint8Array {
  toBase64(): string;
}
interface Uint8ArrayB64Ctor extends Uint8ArrayConstructor {
  fromBase64(s: string): Uint8ArrayB64;
}

export class Base64 implements IBase64 {
  public encodeText(data: string): string {
    const bytes = new TextEncoder().encode(data) as Uint8ArrayB64;
    if (bytes.toBase64 !== undefined) {
      return bytes.toBase64();
    }
    let bin = '';
    for (let i = 0; i < bytes.length; i++) {
      bin += String.fromCharCode(bytes[i]);
    }
    return btoa(bin);
  }
  public decodeText(data: string): string {
    if ((Uint8Array as Uint8ArrayB64Ctor).fromBase64 !== undefined) {
      try {
        return new TextDecoder().decode((Uint8Array as Uint8ArrayB64Ctor).fromBase64(data));
      } catch {}
      return '';
    }
    try {
      const bin = atob(data);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; ++i) {
        bytes[i] = bin.charCodeAt(i);
      }
      return new TextDecoder().decode(bytes);
    } catch {}
    return '';
  }
}
