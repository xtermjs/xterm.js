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

/**
 * Worker message protocol types (used on both ends).
 */
export interface IAckMessage {
  type: MessageType.ACK;
  payload: 'ping' | 'alive';
  options: ISetupOptions | null;
}
// outgoing
export interface ISixelInitMessage {
  type: MessageType.SIXEL_INIT;
  payload: {
    fillColor: number;
    paletteName: 'VT340-COLOR' | 'VT340-GREY' | 'ANSI-256' | 'private';
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
