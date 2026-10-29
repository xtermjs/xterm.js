/**
 * Copyright (c) 2023 The xterm.js authors. All rights reserved.
 * @license MIT
 */


export type ImageType = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/qoi' | 'image/webp' | 'image/avif' | 'unsupported' | '';

export interface IMetrics {
  mime: ImageType;
  width: number;
  height: number;
  animated: boolean;
}

export const UNSUPPORTED_TYPE: IMetrics = {
  mime: 'unsupported',
  width: 0,
  height: 0,
  animated: false
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
      height: d[20] << 24 | d[21] << 16 | d[22] << 8 | d[23],
      animated: isAPNG(d)
    };
  }
  // JPEG: FF D8 FF
  if (d[0] === 0xFF && d[1] === 0xD8 && d[2] === 0xFF) {
    const [width, height] = jpgSize(d);
    return { mime: 'image/jpeg', width, height, animated: false };
  }
  // GIF: GIF87a or GIF89a
  if (d32[0] === 0x38464947 && (d[4] === 0x37 || d[4] === 0x39) && d[5] === 0x61) {
    return {
      mime: 'image/gif',
      width:  d[6] | d[7] << 8,
      height: d[8] | d[9] << 8,
      animated: isAGIF(d)
    };
  }
  // QOI: qoif
  if (d32[0] === 0x66696F71) {
    return {
      mime: 'image/qoi',
      width:  d[4] << 24 | d[5] << 16 | d[ 6] << 8 | d[ 7],
      height: d[8] << 24 | d[9] << 16 | d[10] << 8 | d[11],
      animated: false
    };
  }
  // WEBP: RIFF | xxxx | WEBP | VP8x
  if (d32[0] === 0x46464952 && d32[2] === 0x50424557 && (d32[3] & 0xFFFFFF) === 0x385056) {
    switch (d[15]) {
      case 0x58:  // Extended WebP VP8X --> "X"
        return {
          mime: 'image/webp',
          width:  (d[24] | d[25] << 8 | d[26] << 16) + 1,
          height: (d[27] | d[28] << 8 | d[29] << 16) + 1,
          animated: (d[20] & 0x02) !== 0
        };
      case 0x4C:  // Lossless WebP VP8L --> "L"
        if (d[20] !== 0x2f) return UNSUPPORTED_TYPE;
        const dim = d[21] | d[22] << 8 | d[23] << 16 | d[24] << 24;
        return {
          mime: 'image/webp',
          width:  (dim        & 0x3FFF) + 1,
          height: (dim >>> 14 & 0x3FFF) + 1,
          animated: false
        };
      case 0x20:  // Lossy WebP VP8  --> " "
        if (d[23] !== 0x9d || d[24] !== 0x01 || d[25] !== 0x2a) return UNSUPPORTED_TYPE;
        return {
          mime: 'image/webp',
          width:  (d[26] | d[27] << 8) & 0x3FFF,
          height: (d[28] | d[29] << 8) & 0x3FFF,
          animated: false
        };
    }
    return UNSUPPORTED_TYPE;
  }
  // AVIF: Box size | ftyp | avif/avis
  if (d32[1] === 0x70797466 && (d32[2] === 0x66697661 || d32[2] === 0x73697661)) {
    let pos = -1;
    let anim = d32[2] === 0x73697661; // avis is meant to be animated
    // search for boxes within first 1024 bytes
    const limit = Math.min(d.length - 16, 1024);
    for (let i = 8; i < limit; i++) {
      // scan for ispe for dimensions
      if (pos === -1 && d[i] === 0x69 && d[i + 1] === 0x73 && d[i + 2] === 0x70 && d[i + 3] === 0x65) {
        pos = i;
      }
      // scan for stsz or moov
      if (!anim) {
        const isStsz = d[i] === 0x73 && d[i + 1] === 0x74 && d[i + 2] === 0x73 && d[i + 3] === 0x7A;
        const isMoov = d[i] === 0x6D && d[i + 1] === 0x6F && d[i + 2] === 0x6F && d[i + 3] === 0x76;
        if (isStsz || isMoov) {
          anim = true;
        }
      }
      if (pos !== -1 && anim) {
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
        return { mime: 'image/avif', width, height, animated: anim };
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
  if (blockLength < 2) return [0, 0];
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
    if (blockLength < 2) return [0, 0];
  }
}


function isAGIF(data: Uint8Array): boolean {
  let pos = 10;
  const gPacked = data[pos];
  const hasGP = (gPacked & 0x80) !== 0;
  pos += 3;
  if (hasGP) {
    const gpSize = 2 << (gPacked & 0x07);
    pos += 3 * gpSize;
  }
  let gceCount = 0;
  while (pos < data.length) {
    const blockType = data[pos];
    if (blockType === 0x21) { // Extension Block
      if (pos + 1 >= data.length) return false;
      const extLabel = data[pos + 1];
      if (extLabel === 0xF9) { // Graphic Control Extension
        gceCount++;
        if (gceCount > 1) return true; // early exit on 2nd frame
      }
      pos += 2;
      while (pos < data.length) {
        const blockSize = data[pos];
        if (blockSize === 0x00) break;
        pos += blockSize + 1;
      }
      if (pos >= data.length) return false;
      pos++;
    } else if (blockType === 0x2C) { // Image Descriptor
      if (pos + 10 >= data.length) return false;
      pos += 10;
      const lPacked = data[pos - 1];
      if ((lPacked & 0x80) !== 0) {
        const lpSize = 2 << (lPacked & 0x07);
        pos += 3 * lpSize;
      }
      if (pos >= data.length) return false;
      pos++;
      while (pos < data.length) {
        const blockSize = data[pos];
        if (blockSize === 0x00) break;
        pos += blockSize + 1;
      }
      if (pos >= data.length) return false;
      pos++;
    } else if (blockType === 0x3B) {
      break;
    } else {
      return false;
    }
  }
  return false;
}


function isAPNG(d: Uint8Array): boolean {
  let p = 8;
  while (p + 8 < d.length) {
    const length = (d[p] << 24 | d[p + 1] << 16 | d[p + 2] << 8 | d[p + 3]) >>> 0;
    // 'acTL' before 'IDAT': APNG
    if (d[p + 4] === 0x61 && d[p + 5] === 0x63 && d[p + 6] === 0x54 && d[p + 7] === 0x4c) {
      return true;
    }
    // 'IDAT' first: no APNG
    if (d[p + 4] === 0x49 && d[p + 5] === 0x44 && d[p + 6] === 0x41 && d[p + 7] === 0x54) {
      return false;
    }
    p += 12 + length;
  }
  return false;
}
