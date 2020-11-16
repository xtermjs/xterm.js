// FIXME: remove file and import node-imgsize instead

import { Base64 } from './base64';
import { ImageType, ISize, UintTypedArray } from './Types';

/**
 * Functions to get the image size from binary image data.
 * The functions support peeking into base64 encoded data.
 */
export class ImageSize {
  // header buffer to hold PNG and GIF header from base64
  private static _headerBuffer = new Uint8Array(24);

  public static fromJPEG(d: UintTypedArray, base64: boolean = false): ISize {
    const result: ISize = {width: -1, height: -1, type: ImageType.INVALID};

    if (base64) {
      // JPEG starts with "/9j/" in base64
      if (d[0] !== 0x2F || d[1] !== 0x39 || d[2] !== 0x6A || d[3] !== 0x2F) {
        return result;
      }
      // FIXME: currently decodes all data since the loop below relies on seeing all data
      const buffer = new Uint8Array(Base64.decodeSize(d.length));
      const decodedLength = Base64.decode(d, buffer);
      d = buffer.subarray(0, decodedLength);
    }

    const length = d.length;
    if (length < 10) {
      return result;
    }
    // JPEG should always start with 0xFFD8 followed by 0xFFE0 (JFIF) or 0xFFE1 (Exif)
    if (d[0] !== 0xFF || d[1] !== 0xD8 || d[2] !== 0xFF || (d[3] !== 0xE0 && d[3] !== 0xE1)) {
      return result;
    }
    // should have either "JFIF" or "Exif" following
    if ((d[6] !== 0x4a || d[7] !== 0x46 || d[8] !== 0x49 || d[9] !== 0x46 || d[10] !== 0x00)
      && (d[6] !== 0x45 || d[7] !== 0x78 || d[8] !== 0x69 || d[9] !== 0x66 || d[10] !== 0x00))
    {
      return result;
    }
    let i = 4;
    // walk the blocks and search for SOFx marker
    let blockLength = d[i] << 8 | d[i + 1];
    while (true) {
      i += blockLength;
      if (i >= length) {
        // exhausted without size info
        result.type = ImageType.JPEG;
        return result;
      }
      if (d[i] !== 0xFF) {
        return result;
      }
      if (d[i + 1] === 0xC0 || d[i + 1] === 0xC2) {
        if (i + 8 < length) {
          result.width = d[i + 7] << 8 | d[i + 8];
          result.height = d[i + 5] << 8 | d[i + 6];
          result.type = ImageType.JPEG;
          return result;
        }
        return result;
      }
      i += 2;
      blockLength = d[i] << 8 | d[i + 1];
    }
  }

  public static fromPNG(d: UintTypedArray, base64: boolean = false): ISize {
    const result: ISize = {width: -1, height: -1, type: ImageType.INVALID};

    if (base64) {
      if (d.length < 32) {
        return result;
      }
      // PNG starts with "iVBORw0K" in base64
      // check for "iVBO" (first 4 bytes)
      if (d[0] !== 0x69 || d[1] !== 0x56 || d[2] !== 0x42 || d[3] !== 0x4F) {
        return result;
      }
      // decode 32 bytes --> 24 bytes needed to get size
      const decodedLength = Base64.decode(d, ImageSize._headerBuffer, 32);
      if (decodedLength !== 24) {
        return result;
      }
      d = ImageSize._headerBuffer;
    }

    if (d.length < 24) {
      return result;
    }
    // header check 89 50 4E 47 0D 0A 1A 0A
    if (d[0] !== 0x89 || d[1] !== 0x50 || d[2] !== 0x4E || d[3] !== 0x47
        || d[4] !== 0x0D || d[5] !== 0x0A || d[6] !== 0x1A || d[7] !== 0x0A) {
      return result;
    }
    // first chunk must be IHDR
    if (d[12] !== 0x49 || d[13] !== 0x48 || d[14] !== 0x44 || d[15] !== 0x52) {
      return result;
    }
    // next 8 byte contain width/height in big endian
    result.width = d[16] << 24 | d[17] << 16 | d[18] << 8 | d[19];
    result.height = d[20] << 24 | d[21] << 16 | d[22] << 8 | d[23];
    result.type = ImageType.PNG;
    return result;
  }

  public static fromGIF(d: UintTypedArray, base64: boolean = false): ISize {
    const result: ISize = {width: -1, height: -1, type: ImageType.INVALID};

    if (base64) {
      if (d.length < 16) {
        return result;
      }
      // GIF starts with "R0lG" in base64
      if (d[0] !== 0x52 || d[1] !== 0x30 || d[2] !== 0x6C || d[3] !== 0x47) {
        return result;
      }
      // decode 16 bytes --> 12 (10 bytes needed to get size)
      const decodedLength = Base64.decode(d, ImageSize._headerBuffer, 16);
      if (decodedLength !== 12) {
        return result;
      }
      d = ImageSize._headerBuffer;
    }

    const length = d.length;
    if (length < 10) {
      return result;
    }
    // header starts with "GIF"
    if (d[0] !== 0x47 || d[1] !== 0x49 || d[2] !== 0x46) {
      return result;
    }
    // 3 bytes "87a" or "89a" following
    if (d[3] !== 0x38 || (d[4] !== 0x37 && d[4] !== 0x39) || d[5] !== 0x61) {
      return result;
    }
    // next 4 bytes contain width/heigt in little endian
    result.width = d[7] << 8 | d[6];
    result.height = d[9] << 8 | d[8];
    result.type = ImageType.GIF;
    return result;
  }

  public static guessFromBytes(data: UintTypedArray, base64: boolean = false): ISize {
    if (base64) {
      switch (data[0]) {
        case 0x2F:  // '/'
          return ImageSize.fromJPEG(data, base64);
        case 0x69:  // 'i'
          return ImageSize.fromPNG(data, base64);
        case 0x52:  // 'R'
          return ImageSize.fromGIF(data, base64);
        default:
          return {width: -1, height: -1, type: ImageType.INVALID};
      }
    } else {
      switch (data[0]) {
        case 0xFF:
          return ImageSize.fromJPEG(data, base64);
        case 0x89:
          return ImageSize.fromPNG(data, base64);
        case 0x47:  // 'G'
          return ImageSize.fromGIF(data, base64);
        default:
          return {width: -1, height: -1, type: ImageType.INVALID};
      }
    }
  }
}
