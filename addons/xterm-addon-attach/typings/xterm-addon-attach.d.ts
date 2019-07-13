/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal, ILinkMatcherOptions, ITerminalAddon } from 'xterm';

declare module 'xterm-addon-attach' {
  export interface IAttachOptions {
    /**
     * Whether input should be written to the backend. Defaults to `true`.
     */
    bidirectional?: boolean;

    /**
     * Whether to use UTF8 binary transport for incoming messages. Defaults to `false`.
     * Note: This must be in line with the server side of the websocket.
     *       Always send string messages from the backend if this options is false,
     *       otherwise always binary UTF8 data.
     */
    inputUtf8?: boolean;

    /**
     * Whether to use flow control.
     * Set this to a positive number to send an ACK reply every n-th processed byte.
     * Default is 0 (flow control disabled).
     */
    flowControl?: number;
  }

  export class AttachAddon implements ITerminalAddon {
    constructor(socket: WebSocket, options?: IAttachOptions);
    public activate(terminal: Terminal): void;
    public dispose(): void;
  }
}
