/**
 * Copyright (c) 2020 The xterm.js authors. All rights reserved.
 * @license MIT
 */

/**
 * Worker message protocol types (used on both ends).
 */
export interface IAckMsg {
  type: 'ACK';
  payload: 'ping' | 'alive';
}
// outgoing
export interface ISixelInitMsg {
  type: 'SIXEL_INIT';
  payload: {
    fillColor: number;
    paletteName: 'VT340-COLOR' | 'VT340-GREY' | 'ANSI-256' | 'private';
    limit: number;
  };
}
export interface ISixelPutMsg {
  type: 'SIXEL_PUT';
  payload: {
    buffer: ArrayBuffer;
    length: number;
  };
}
export interface ISixelEndMsg {
  type: 'SIXEL_END';
  payload: boolean;
}
// incoming
export interface ISixelImage {
  buffer: ArrayBuffer;
  width: number;
  height: number;
}
export interface ISixelImageMsg {
  type: 'SIXEL_IMAGE';
  payload: ISixelImage;
}
export interface IChunkTransferMsg {
  type: 'CHUNK_TRANSFER';
  payload: ArrayBuffer;
}

export type IImageWorkerProtocol = IAckMsg | ISixelInitMsg | ISixelPutMsg | ISixelEndMsg | ISixelImageMsg | IChunkTransferMsg;
