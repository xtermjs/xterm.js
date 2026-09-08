/**
 * Copyright (c) 2023 The xterm.js authors. All rights reserved.
 * @license MIT
 */


export type ImageType = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/qoi' | 'image/webp' | 'image/avif' | 'unsupported' | '';

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
  if (d.length < 32) {
    return UNSUPPORTED_TYPE;
  }
  const d32 = new Uint32Array(d.buffer, d.byteOffset, 8);
  // PNG: 89 50 4E 47 0D 0A 1A 0A (8 first bytes == magic number for PNG)
  // + first chunk must be IHDR
  if (d32[0] === 0x474E5089 && d32[1] === 0x0A1A0A0D && d32[3] === 0x52444849) {
    return {
      mime: 'image/png',
      width:  d[16] << 24 | d[17] << 16 | d[18] << 8 | d[19],
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
      width:  d[7] << 8 | d[6],
      height: d[9] << 8 | d[8]
    };
  }
  // QOI: qoif
  if (d32[0] === 0x66696F71) {
    return {
      mime: 'image/qoi',
      width:  d[4] << 24 | d[5] << 16 | d[6] << 8 | d[7],
      height: d[8] << 24 | d[9] << 16 | d[10] << 8 | d[11]
    };
  }
  // WEBP: RIFF | xxxx | WEBP | VP8x
  if (d32[0] === 0x46464952 && d32[2] === 0x50424557 && (d32[3] & 0xFFFFFF) === 0x385056) {
    switch (d[15]) {
      case 0x58:  // Extended WebP VP8X --> "X"
        return {
          mime: 'image/webp',
          width:  (d[24] | d[25] << 8 | d[26] << 16) + 1,
          height: (d[27] | d[28] << 8 | d[29] << 16) + 1
        };
      case 0x4C:  // Lossless WebP VP8L --> "L"
        if (d[20] !== 0x2f) return UNSUPPORTED_TYPE;
        const dim = d[21] | d[22] << 8 | d[23] << 16 | d[24] << 24;
        return {
          mime: 'image/webp',
          width:  (dim        & 0x3FFF) + 1,
          height: (dim >>> 14 & 0x3FFF) + 1
        };
      case 0x20:  // Lossy WebP VP8  --> " "
        if (d[23] !== 0x9d || d[24] !== 0x01 || d[25] !== 0x2a) return UNSUPPORTED_TYPE;
        return {
          mime: 'image/webp',
          width:  (d[26] | d[27] << 8) & 0x3FFF,
          height: (d[28] | d[29] << 8) & 0x3FFF
        };
    }
    return UNSUPPORTED_TYPE;
  }
  // AVIF: Box size | ftyp | avif/avis
  if (d32[1] === 0x70797466 && (d32[2] === 0x66697661 || d32[2] === 0x73697661)) {
    let pos = -1;
    // search for ispe box within first 1024 bytes
    const limit = Math.min(d.length - 16, 1024);
    for (let i = 8; i < limit; i++) {
      // scan for ispe
      if (d[i] === 0x69 && d[i + 1] === 0x73 && d[i + 2] === 0x70 && d[i + 3] === 0x65) {
        pos = i;
        break;
      }
    }
    if (pos !== -1) {
      // dimensions are in BE at +8 (width) at +12 (height)
      const width =
        d[pos +  8] << 24 |
        d[pos +  9] << 16 |
        d[pos + 10] <<  8 |
        d[pos + 11];
      const height =
        d[pos + 12] << 24 |
        d[pos + 13] << 16 |
        d[pos + 14] <<  8 |
        d[pos + 15];
      if (width > 0 && height > 0) {
        return { mime: 'image/avif', width, height };
      }
    }
    return UNSUPPORTED_TYPE;
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
