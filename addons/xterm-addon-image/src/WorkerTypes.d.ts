/**
 * Copyright (c) 2020 The xterm.js authors. All rights reserved.
 * @license MIT
 */

// pixel data from worker
export interface IImagePixel {
  buffer: ArrayBuffer;
  width: number;
  height: number;
}

/**
 * Worker message protocol types (used on both ends).
 */
export interface IAckMessage {
  type: 'ACK';
  payload: 'ping' | 'alive';
}
// outgoing
export interface ISixelInitMessage {
  type: 'SIXEL_INIT';
  payload: {
    fillColor: number;
    paletteName: 'VT340-COLOR' | 'VT340-GREY' | 'ANSI-256' | 'private';
    limit: number;
  };
}
export interface ISixelPutMessage {
  type: 'SIXEL_PUT';
  payload: {
    buffer: ArrayBuffer;
    length: number;
  };
}
export interface ISixelEndMessage {
  type: 'SIXEL_END';
  payload: boolean;
}
// incoming
export interface ISixelImageMessage {
  type: 'SIXEL_IMAGE';
  payload: IImagePixel | null;
}
export interface IChunkTransferMessage {
  type: 'CHUNK_TRANSFER';
  payload: ArrayBuffer;
}

export type IImageWorkerMessage = IAckMessage | ISixelInitMessage | ISixelPutMessage | ISixelEndMessage | ISixelImageMessage | IChunkTransferMessage;
