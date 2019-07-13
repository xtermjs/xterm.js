/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

/**
 * Message types for ThinProtocol.
 * Currently we only support 2 messages types.
 * Future versions might extend this by other types
 * that dont fit into DATA (like resize or mouse reports).
 */
export enum MessageType {
  /** Plain data, no further handling. */
  DATA = 0,
  /** ACK, sent for every n-th byte finally processed. */
  ACK
}

/**
 * ThinProtocol
 *
 * Usage:
 * ```typescript
 *  const tp = new ThinProtocol();
 *  // attach incoming data handler
 *  tp.setIncomingHandler(MessageType.DATA, <some handler>);
 *  // attach incoming ACK handler
 *  tp.setIncomingHandler(MessageType.ACK, <some handler>);
 *  ...
 *  // Reading:
 *  // To strip and route raw messages feed the chunk into unwrap,
 *  // which will call the registered incoming handler.
 *  tp.unwrap(<some raw data chunk>);
 *  ...
 *  // Writing:
 *  // Either call wrap with message type and payload,
 *  // or use the convenient functions:
 *  chunk = tp.wrap(type, payload);
 *  chunk = tp.data(payload);   // create a DATA chunk
 *  chunk = tp.ack();           // create an ACK chunk
 * ```
 */
export class ThinProtocol {
  private _handlers: (((data: string) => void) | null)[] = new Array(Object.keys(MessageType).length);

  /** Register a handler for `type`. */
  public setIncomingHandler(type: MessageType, cb: (data: string) => void): void {
    this._handlers[type] = cb;
  }
  /** Remove handler for `type`. */
  public clearIncomingHandler(type: MessageType): void {
    this._handlers[type] = null;
  }

  /** Process incoming message and call associated handler. */
  public unwrap(msg: string): void {
    let handler: ((data: string) => void) | null;
    if (msg && (handler = this._handlers[msg.charCodeAt(0)])) {
      handler(msg.slice(1));
    }
  }

  /** Create new message of `type`. */
  public wrap(type: MessageType, payload?: string): string {
    if (payload) {
      return String.fromCharCode(type) + payload;
    }
    return String.fromCharCode(type);
  }

  /** Create a plain ACK message (no payload). */
  public ack(): string {
    return this.wrap(MessageType.ACK);
  }

  /** Create a DATA message. */
  public data(data: string): string {
    return this.wrap(MessageType.DATA, data);
  }
}
