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
  ACK,
  /**
   * By default, DATA will be treated as UTF8 data, To be able to send
   * raw non UTF-8 conform byte data, use the BINARY type.
   * Currently only the string version of the protocol is implemented
   * which uses BASE64 transport encoding for binary data.
   * A later binary version of the protocol might skip the base64 step.
   */
  BINARY
}


/**
 * Get base64 encoder / decoder for binary messages.
 */
const _global = Function('return this')();

const base64Encode = (_global.btoa !== undefined)
  ? btoa : (_global.Buffer !== undefined)
    ? (data: string) => Buffer.from(data, 'binary').toString('base64') : null;

const base64Decode = (_global.atob !== undefined)
  ? atob : (_global.Buffer !== undefined)
    ? (data: string) => Buffer.from(data, 'base64').toString('binary') : null;


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
    let type: MessageType = msg.charCodeAt(0);
    if (msg && (handler = this._handlers[type])) {
      if (type === MessageType.BINARY) {
        if (!base64Encode || !base64Decode) {
          throw new Error('binary messages not working - missing base64 support');
        }
        handler(base64Decode(msg.slice(1)));
      } else {
        handler(msg.slice(1));
      }
    }
  }

  /** Create new message of `type`. */
  public wrap(type: MessageType, payload?: string): string {
    if (payload) {
      if (type === MessageType.BINARY) {
        if (!base64Encode || !base64Decode) {
          throw new Error('binary messages not working - missing base64 support');
        }
        payload = base64Encode(payload);
      }
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

  /** Create a BINARY message. */
  public binary(data: string): string {
    return this.wrap(MessageType.BINARY, data);
  }
}
