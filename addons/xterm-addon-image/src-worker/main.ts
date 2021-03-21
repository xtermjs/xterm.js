/**
 * Copyright (c) 2020 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { SixelDecoder } from 'sixel/lib/SixelDecoder';
import { PALETTE_VT340_COLOR, PALETTE_VT340_GREY, PALETTE_ANSI_256 } from 'sixel/lib/Colors';
import { IImageWorkerProtocol, IAckMsg, ISixelInitMsg, ISixelPutMsg, ISixelEndMsg, ISixelImageMsg, IChunkTransferMsg } from '../src/WorkerTypes';


let sixelDecoder: SixelDecoder | undefined;

function messageHandler(event: MessageEvent): void {
  const data = event.data as IImageWorkerProtocol;
  switch (data.type) {
    case 'SIXEL_PUT':
      if (sixelDecoder) {
        sixelDecoder.decode(
          new Uint8Array(
            (data as ISixelPutMsg).payload.buffer,
            0,
            (data as ISixelPutMsg).payload.length
          ));
      }
      self.postMessage({
        type: 'CHUNK_TRANSFER',
        payload: (data as ISixelPutMsg).payload.buffer
      } as IChunkTransferMsg, [(data as ISixelPutMsg).payload.buffer]);
      break;
    case 'SIXEL_END':
      if (!sixelDecoder || !sixelDecoder.width || !sixelDecoder.height) break;
      const success = (data as ISixelEndMsg).payload;
      if (success) {
        const width = sixelDecoder.width;
        const height = sixelDecoder.height;
        const result = new Uint8ClampedArray(width * height * 4);
        sixelDecoder.toPixelData(result, width, height);
        self.postMessage({
          type: 'SIXEL_IMAGE',
          payload: {
            buffer: result.buffer,
            width,
            height
          }
        } as ISixelImageMsg, [result.buffer]);
      }
      sixelDecoder = undefined;
      break;
    case 'SIXEL_INIT':
      const { fillColor, paletteName, limit } = (data as ISixelInitMsg).payload;
      const palette = paletteName === 'VT340-COLOR'
        ? PALETTE_VT340_COLOR
        : paletteName === 'VT340-GREY'
          ? PALETTE_VT340_GREY
          : PALETTE_ANSI_256;
      // FIXME: non private palette? (not really supported)
      sixelDecoder = new SixelDecoder(fillColor, Object.assign([], palette), limit);
      break;
    case 'ACK':
      self.postMessage({
        type: 'ACK',
        payload: 'alive'
      } as IAckMsg);
      break;
  }
}

self.addEventListener('message', messageHandler);
