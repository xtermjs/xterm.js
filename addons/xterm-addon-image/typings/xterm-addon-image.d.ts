/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal, ITerminalAddon } from 'xterm';

declare module 'xterm-addon-image' {
  export interface IImageAddonOptions {}

  export class ImageAddon implements ITerminalAddon {
    constructor(socket: WebSocket, options?: IImageAddonOptions);
    public activate(terminal: Terminal): void;
    public dispose(): void;
  }
}
