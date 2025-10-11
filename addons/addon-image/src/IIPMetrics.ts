/**
 * Copyright (c) 2023 The xterm.js authors. All rights reserved.
 * @license MIT
 */


export type ImageType = 'image/png' | 'image/jpeg' | 'image/gif' | 'unsupported' | '';

export interface IMetrics {
  mime: ImageType;
  width: number;
  height: number;
}

export const UNSUPPORTED_TYPE: IMetrics = {
  mime: 'unsupported',
  width: 0,
  height: 0
};

export function imageType(d: Uint8Array): IMetrics {
  if (d.length < 24) {
    return UNSUPPORTED_TYPE;
  }
  const d32 = new Uint32Array(d.buffer, d.byteOffset, 6);
  // PNG: 89 50 4E 47 0D 0A 1A 0A (8 first bytes == magic number for PNG)
  // + first chunk must be IHDR
  if (d32[0] === 0x474E5089 && d32[1] === 0x0A1A0A0D && d32[3] === 0x52444849) {
    return {
      mime: 'image/png',
      width: d[16] << 24 | d[17] << 16 | d[18] << 8 | d[19],
      height: d[20] << 24 | d[21] << 16 | d[22] << 8 | d[23]
    };
  }
  // JPEG: FF D8 FF
  if (d[0] === 0xFF && d[1] === 0xD8 && d[2] === 0xFF) {
    const [width, height] = jpgSize(d);
    return { mime: 'image/jpeg', width, height };
  }
  // GIF: GIF87a or GIF89a
  if (d32[0] === 0x38464947 && (d[4] === 0x37 || d[4] === 0x39) && d[5] === 0x61) {
    return {
      mime: 'image/gif',
      width: d[7] << 8 | d[6],
      height: d[9] << 8 | d[8]
    };
  }
  return UNSUPPORTED_TYPE;
}

function jpgSize(d: Uint8Array): [number, number] {
  const len = d.length;
  let i = 4;
  let blockLength = d[i] << 8 | d[i + 1];
  while (true) {
    i += blockLength;
    if (i >= len) {
      // exhausted without size info
      return [0, 0];
    }
    if (d[i] !== 0xFF) {
      return [0, 0];
    }
    if (d[i + 1] === 0xC0 || d[i + 1] === 0xC2) {
      if (i + 8 < len) {
        return [
          d[i + 7] << 8 | d[i + 8],
          d[i + 5] << 8 | d[i + 6]
        ];
      }
      return [0, 0];
    }
    i += 2;
    blockLength = d[i] << 8 | d[i + 1];
  }
}
