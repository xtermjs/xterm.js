/**
 * Copyright (c) 2023 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Base64 } from 'js-base64';
import { ClipboardSelection, IClipboardProvider } from 'xterm';

export class ClipboardProvider implements IClipboardProvider {
  constructor(
    /**
     * The maximum amount of data that can be copied to the clipboard.
     * Zero means no limit.
     */
    public limit = 1000000 // 1MB
  ){}
  public readText(selection: ClipboardSelection): Promise<string> {
    if (selection !== 'c') {
      return Promise.resolve('');
    }
    return navigator.clipboard.readText().then((text) =>
      Base64.encode(text));
  }
  public writeText(selection: ClipboardSelection, data: string): Promise<void> {
    if (selection !== 'c' || (this.limit > 0 && data.length > this.limit)) {
      return Promise.resolve();
    }
    const text = Base64.decode(data);
    // clear the clipboard if the data is not valid base64
    if (!Base64.isValid(data) || Base64.encode(text) !== data) {
      return navigator.clipboard.writeText('');
    }
    return navigator.clipboard.writeText(text);
  }
}
