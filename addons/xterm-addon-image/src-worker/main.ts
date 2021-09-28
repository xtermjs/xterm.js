/**
 * Copyright (c) 2020 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IImageWorkerMessage, IPostMessage } from '../src/WorkerTypes';

import { Decoder } from 'sixel/lib/Decoder';
import { PALETTE_VT340_COLOR, PALETTE_VT340_GREY, PALETTE_ANSI_256 } from 'sixel/lib/Colors';


// narrow types for postMessage to our protocol
declare const postMessage: IPostMessage;


let imageBuffer: ArrayBuffer | undefined;
let sizeExceeded = false;
let dec: Decoder;

// setup options loaded from ACK
let pixelLimit = 0;

// always free decoder ressources after decoding if it exceeds this limit
const MEM_PERMA_LIMIT = 16777216; // 2048 pixels * 2048 pixels * 4 channels = 16MB


function messageHandler(event: MessageEvent<IImageWorkerMessage>): void {
  const data = event.data;
  switch (data.type) {
    case 'SIXEL_PUT':
      if (!sizeExceeded) {
        dec.decode(new Uint8Array(data.payload.buffer, 0, data.payload.length));
        if (dec.height * dec.width > pixelLimit) {
          sizeExceeded = true;
          dec.release();
          console.warn('image worker: pixelLimit exceeded, aborting');
          postMessage({ type: 'SIZE_EXCEEDED' });
        }
      }
      postMessage({ type: 'CHUNK_TRANSFER', payload: data.payload.buffer }, [data.payload.buffer]);
      break;
    case 'SIXEL_END':
      const success = data.payload;
      if (success) {
        if (!dec || !dec.width || !dec.height || sizeExceeded) {
          postMessage({ type: 'SIXEL_IMAGE', payload: null });
        } else {
          const width = dec.width;
          const height = dec.height;
          const bytes = width * height * 4;
          if (!imageBuffer || imageBuffer.byteLength < bytes) {
            imageBuffer = new ArrayBuffer(bytes);
          }
          new Uint32Array(imageBuffer, 0, width * height).set(dec.data32);
          postMessage({
            type: 'SIXEL_IMAGE',
            payload: {
              buffer: imageBuffer,
              width,
              height
            }
          }, [imageBuffer]);
          imageBuffer = undefined;
          if (dec.memoryUsage > MEM_PERMA_LIMIT) {
            dec.release();
          }
        }
      }
      sizeExceeded = false;
      break;
    case 'CHUNK_TRANSFER':
      if (!imageBuffer) {
        imageBuffer = data.payload;
      }
      break;
    case 'SIXEL_INIT':
      sizeExceeded = false;
      const { fillColor, paletteName, limit } = data.payload;
      const palette = paletteName === 'VT340-COLOR'
        ? PALETTE_VT340_COLOR
        : paletteName === 'VT340-GREY'
          ? PALETTE_VT340_GREY
          : PALETTE_ANSI_256;
      dec.init(fillColor, palette, limit);
      break;
    case 'ACK':
      pixelLimit = data.options?.pixelLimit || 0;
      dec = new Decoder({ memoryLimit: pixelLimit * 4 });
      postMessage({ type: 'ACK', payload: 'alive', options: null });
      break;
  }
}
self.addEventListener('message', messageHandler, false);
