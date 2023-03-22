/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal, ITerminalAddon } from 'xterm';

declare module 'xterm-addon-attach-edge' {
  export interface IAttachOptions {
    /**
     * Whether input should be written to the backend. Defaults to `true`.
     */
    bidirectional?: boolean;
  }

  export class AttachAddonEdge implements ITerminalAddon {
    constructor(socket: WebSocket, options?: IAttachOptions);
    public activate(terminal: Terminal): void;
    public dispose(): void;
  }
}
