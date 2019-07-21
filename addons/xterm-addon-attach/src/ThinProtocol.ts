/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

/**
 * Message types for ThinProtocol.
 */
export enum MessageType {
  /** Plain data, no further handling. */
  DATA = 0,
  /** ACK, sent for every n-th byte finally processed. */
  ACK,
  /**
   * Binary message type.
   * By default, DATA will be treated as UTF8 data, To be able to send
   * raw non UTF-8 conform data, use the BINARY type.
   * With the string protocol the data gets base64 encoded,
   * with the binary protocol this message type gets no special
   * treatment.
   */
  BINARY
}


/**
 * Get base64 encoder / decoder for binary messages.
 */
const globalObject = Function('return this')();

const base64Encode = (globalObject.btoa !== undefined)
  ? btoa : (globalObject.Buffer !== undefined)
    ? (data: string) => Buffer.from(data, 'binary').toString('base64') : null;

const base64Decode = (globalObject.atob !== undefined)
  ? atob : (globalObject.Buffer !== undefined)
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
export class ThinProtocolString {
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
    const type: MessageType = msg.charCodeAt(0);
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
  public ack(data?: string): string {
    return this.wrap(MessageType.ACK, data);
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

export class ThinProtocolBinary {
  private _handlers: (((data: Uint8Array) => void) | null)[] = new Array(Object.keys(MessageType).length);

  /** Register a handler for `type`. */
  public setIncomingHandler(type: MessageType, cb: (data: Uint8Array) => void): void {
    this._handlers[type] = cb;
  }
  /** Remove handler for `type`. */
  public clearIncomingHandler(type: MessageType): void {
    this._handlers[type] = null;
  }

  /** Process incoming message and call associated handler. */
  public unwrap(msg: Uint8Array): void {
    let handler: ((data: Uint8Array) => void) | null;
    const type: MessageType = msg[0];
    if (msg && (handler = this._handlers[type])) {
      handler(msg.subarray(1));
    }
  }

  /** Create new message of `type`. */
  public wrap(type: MessageType, payload?: Uint8Array): Uint8Array {
    const msg = new Uint8Array(payload ? payload.length + 1 : 1);
    msg[0] = type;
    if (payload) {
      msg.set(payload, 1);
    }
    return msg;
  }

  /** Create a plain ACK message (no payload). */
  public ack(data?: Uint8Array): Uint8Array {
    return this.wrap(MessageType.ACK, data);
  }

  /** Create a DATA message. */
  public data(data: Uint8Array): Uint8Array {
    return this.wrap(MessageType.DATA, data);
  }

  /** Create a BINARY message. */
  public binary(data: Uint8Array): Uint8Array {
    return this.wrap(MessageType.BINARY, data);
  }
}
