/**
 * Copyright (c) 2020 The xterm.js authors. All rights reserved.
 * @license MIT
 */

// setup options
export interface ISetupOptions {
  pixelLimit: number;
}

// pixel data from worker
export interface IImagePixel {
  buffer: ArrayBuffer;
  width: number;
  height: number;
}

// message types
export const enum MessageType {
  ACK = 1,
  SIXEL_INIT = 2,
  SIXEL_PUT = 3,
  SIXEL_END = 4,
  SIXEL_IMAGE = 5,
  CHUNK_TRANSFER = 6,
  SIZE_EXCEEDED = 7
}

// palette types
export const enum PaletteType {
  SHARED = 0,
  VT340_COLOR = 1,
  VT340_GREY = 2,
  ANSI_256 = 3
}

// ACK payload
export const enum AckPayload {
  PING = 0,
  ALIVE = 1
}

/**
 * Worker message protocol types (used on both ends).
 */
export interface IAckMessage {
  type: MessageType.ACK;
  payload: AckPayload;
  options: ISetupOptions | null;
}
// outgoing
export interface ISixelInitMessage {
  type: MessageType.SIXEL_INIT;
  payload: {
    fillColor: number;
    paletteType: PaletteType;
    limit: number;
  };
}
export interface ISixelPutMessage {
  type: MessageType.SIXEL_PUT;
  payload: {
    buffer: ArrayBuffer;
    length: number;
  };
}
export interface ISixelEndMessage {
  type: MessageType.SIXEL_END;
  payload: boolean;
}
// incoming
export interface ISixelImageMessage {
  type: MessageType.SIXEL_IMAGE;
  payload: IImagePixel | null;
}
export interface IChunkTransferMessage {
  type: MessageType.CHUNK_TRANSFER;
  payload: ArrayBuffer;
}
export interface ISizeExceededMessage {
  type: MessageType.SIZE_EXCEEDED;
}

export type IImageWorkerMessage = (
  IAckMessage | ISixelInitMessage | ISixelPutMessage | ISixelEndMessage |
  ISixelImageMessage | IChunkTransferMessage | ISizeExceededMessage
);

export interface IPostMessage {
  <T extends IImageWorkerMessage>(message: T, transfer: Transferable[]): void;
  <T extends IImageWorkerMessage>(message: T, options?: PostMessageOptions): void;
}

export interface IImageWorker extends Worker {
  postMessage: IPostMessage;
}
