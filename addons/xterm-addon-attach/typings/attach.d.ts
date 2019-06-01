/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */


import { Terminal, ILinkMatcherOptions } from 'xterm';

// TODO: This is temporary, link to xterm when the new version is published
export interface ITerminalAddon {
  activate(terminal: Terminal): void;
  dispose(): void;
}

export interface IAttachOptions {
  /**
   * Whether input should be written to the backend. Defaults to `true`.
   */
  bidirectional?: boolean,
  
  /**
   * Whether to use UTF8 binary transport for incoming messages. Defaults to `false`.
   * Note: This must be in line with the server side of the websocket.
   *       Always send string messages from the backend if this options is false,
   *       otherwise always binary UTF8 data.
   */
  inputUtf8?: boolean
}

export class AttachAddon implements ITerminalAddon {
  constructor(socket: WebSocket, options?: IAttachOptions);
  public activate(terminal: Terminal): void;
  public dispose(): void;
}
