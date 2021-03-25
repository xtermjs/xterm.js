/**
 * Copyright (c) 2020 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { SixelDecoder } from 'sixel/lib/SixelDecoder';
import { PALETTE_VT340_COLOR, PALETTE_VT340_GREY, PALETTE_ANSI_256 } from 'sixel/lib/Colors';
import { IImageWorkerMessage } from '../src/WorkerTypes';


// narrow types for postMessage to our protocol
declare const postMessage: {
  <T extends IImageWorkerMessage>(message: T, transfer: Transferable[]): void;
  <T extends IImageWorkerMessage>(message: T, options?: PostMessageOptions | undefined): void;
};


let decoder: SixelDecoder | undefined;


function messageHandler(event: MessageEvent<IImageWorkerMessage>): void {
  const data = event.data;
  switch (data.type) {
    case 'SIXEL_PUT':
      decoder?.decode(new Uint8Array(data.payload.buffer, 0, data.payload.length));
      postMessage({type: 'CHUNK_TRANSFER', payload: data.payload.buffer}, [data.payload.buffer]);
      break;
    case 'SIXEL_END':
      const success = data.payload;
      if (success) {
        if (!decoder || !decoder.width || !decoder.height) {
          postMessage({type: 'SIXEL_IMAGE', payload: null});
        } else {
          const width = decoder.width;
          const height = decoder.height;
          const result = new Uint8ClampedArray(width * height * 4);
          decoder.toPixelData(result, width, height);
          postMessage({
            type: 'SIXEL_IMAGE',
            payload: {
              buffer: result.buffer,
              width,
              height
            }
          }, [result.buffer]);
        }
      }
      decoder = undefined;
      break;
    case 'SIXEL_INIT':
      const { fillColor, paletteName, limit } = data.payload;
      const palette = paletteName === 'VT340-COLOR'
        ? PALETTE_VT340_COLOR
        : paletteName === 'VT340-GREY'
          ? PALETTE_VT340_GREY
          : PALETTE_ANSI_256;
      // FIXME: non private palette? (not really supported)
      decoder = new SixelDecoder(fillColor, Object.assign([], palette), limit);
      break;
    case 'ACK':
      postMessage({type: 'ACK', payload: 'alive'});
      break;
  }
}

self.addEventListener('message', messageHandler, false);
