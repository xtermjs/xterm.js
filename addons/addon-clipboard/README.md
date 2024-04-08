## @xterm/addon-clipboard

An addon for [xterm.js](https://github.com/xtermjs/xterm.js) that enables
accessing the system clipboard. This addon requires xterm.js v4+.

### Install

```bash
npm install --save @xterm/addon-clipboard
```

### Usage

```ts
import { Terminal } from 'xterm';
import { ClipboardAddon } from '@xterm/addon-clipboard';

const terminal = new Terminal();
const clipboardAddon = new ClipboardAddon();
terminal.loadAddon(clipboardAddon);
```

To use a custom clipboard provider

```ts
import { Terminal } from '@xterm/xterm';
import { ClipboardAddon, IClipboardProvider, ClipboardSelectionType } from '@xterm/addon-clipboard';

function b64Encode(data: string): string {
  // Base64 encode impl
}

function b64Decode(data: string): string {
  // Base64 decode impl
}

class MyCustomClipboardProvider implements IClipboardProvider {
  private _data: string
  public readText(selection: ClipboardSelectionType): Promise<string> {
    return Promise.resolve(b64Encode(this._data));
  }
  public writeText(selection: ClipboardSelectionType, data: string): Promise<void> {
    this._data = b64Decode(data);
    return Promise.resolve();
  }
}

const terminal = new Terminal();
const clipboardAddon = new ClipboardAddon(new MyCustomClipboardProvider());
terminal.loadAddon(clipboardAddon);
```

See the full [API](https://github.com/xtermjs/xterm.js/blob/master/addons/addon-clipboard/typings/addon-clipboard.d.ts) for more advanced usage.
