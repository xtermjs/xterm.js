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

  /**
   * Message types for ThinProtocol.
   */
  export enum MessageType {
    /** Plain data, no further handling. */
    DATA = 0,
    /** ACK, sent for every n-th byte finally processed. */
    ACK
  }

  /**
   * ThinProtocol
   * Thin protocol to send different message types in-band.
   */
  export class ThinProtocol {
    /** Register a handler for `type`. */
    public setIncomingHandler(type: MessageType, cb: (data:string) => void): void;

    /** Remove handler for `type`. */
    public clearIncomingHandler(type: MessageType): void;
  
    /** Process incoming message and call associated handler. */
    public unwrap(msg: string): void;
  
    /** Create new message of `type`. */
    public wrap(type: MessageType, payload?: string): string;
  
    /** Convenient method to create a plain ACK message (no payload). */
    public ack(): string;
  
    /** Convenient method to create a DATA message. */
    public data(data: string): string;
  }
}
