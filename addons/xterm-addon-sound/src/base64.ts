export type UintTypedArray = Uint8Array | Uint16Array | Uint32Array | Uint8ClampedArray;

// base64 maps
const BASE64_CHARMAP = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const ENC_MAP = new Uint8Array(BASE64_CHARMAP.split('').map(el => el.charCodeAt(0)));
const PAD = '='.charCodeAt(0);

// slow decoder map
const DEC_MAP = new Uint8Array(256);
DEC_MAP.fill(255);
for (let i = 0; i < ENC_MAP.length; ++i) {
  DEC_MAP[ENC_MAP[i]] = i;
}

function initDecodeMap(map: Uint32Array, shift: number): void {
  map.fill(3 << 24);
  for (let i = 0; i < ENC_MAP.length; ++i) {
    map[ENC_MAP[i]] = i << shift;
  }
}

// fast decoder maps
const DEC0 = new Uint32Array(256);
const DEC1 = new Uint32Array(256);
const DEC2 = new Uint32Array(256);
const DEC3 = new Uint32Array(256);
initDecodeMap(DEC0, 18);
initDecodeMap(DEC1, 12);
initDecodeMap(DEC2, 6);
initDecodeMap(DEC3, 0);


interface IPositionUpdate {
  sourcePos: number;
  targetPos: number;
}


export class Base64 {
  /**
   * Calculate needed encode space.
   */
  public static encodeSize(length: number): number {
    return Math.ceil(length / 3) * 4;
  }

  /**
   * Calculate needed decode space.
   * Returns an upper estimation if the encoded data contains padding
   * or invalid bytes (exact number if cleaned up).
   */
  public static decodeSize(length: number): number {
    return Math.ceil(length / 4) * 3 - (Math.ceil(length / 4) * 4 - length);
  }

  /**
   * Encode base64.
   * Returns number of encoded bytes written to `target`.
   */
  public static encode(data: UintTypedArray, target: UintTypedArray, length: number = data.length, pad: boolean = true): number {
    if (!length) {
      return 0;
    }
    if (target.length < Base64.encodeSize(length)) {
      throw new Error('not enough room to encode base64 data');
    }
    const padding = length % 3;
    if (padding) {
      length -= padding;
    }
    let j = 0;
    for (let i = 0; i < length; i += 3) {
      // load 3x 8 bit values
      let accu = data[i] << 16 | data[i + 1] << 8 | data[i + 2];

      // write 4x 6 bit values
      target[j] = ENC_MAP[accu >> 18];
      target[j + 1] = ENC_MAP[(accu >> 12) & 0x3F];
      target[j + 2] = ENC_MAP[(accu >> 6) & 0x3F];
      target[j + 3] = ENC_MAP[accu & 0x3F];
      j += 4;
    }
    if (padding) {
      if (padding === 2) {
        let accu = data[length] << 8 | data[length + 1];
        accu <<= 2;
        target[j++] = ENC_MAP[accu >> 12];
        target[j++] = ENC_MAP[(accu >> 6) & 0x3F];
        target[j++] = ENC_MAP[accu & 0x3F];
        if (pad) {
          target[j++] = PAD;
        }
      } else {
        let accu = data[length];
        accu <<= 4;
        target[j++] = ENC_MAP[accu >> 6];
        target[j++] = ENC_MAP[accu & 0x3F];
        if (pad) {
          target[j++] = PAD;
          target[j++] = PAD;
        }
      }
    }
    return j;
  }

  // slow bytewise decoder, handles invalid and final chunks
  public static decodeChunk(source: UintTypedArray, target: UintTypedArray, endPos: number, p: IPositionUpdate): void {
    let count = 0;
    let d = 0;
    let accu = 0;
    while (p.sourcePos < endPos) {
      if ((d = DEC_MAP[source[p.sourcePos++]]) !== 0xFF) {
        count++;
        accu <<= 6;
        accu |= d;
        // save fixed chunk, return fixed positions to fast decoder
        if (!(count & 3)) {
          target[p.targetPos] = accu >> 16;
          target[p.targetPos + 1] = (accu >> 8) & 0xFF;
          target[p.targetPos + 2] = accu & 0xFF;
          p.targetPos += 3;
          return;
        }
      } else {
        // TODO: error rules based on base64 type
      }
    }
    if (!count) return;

    // handle final chunk
    switch (count & 3) {
      case 1:
        return;
      case 2:
        target[p.targetPos++] = accu >> 4;
        return;
      case 3:
        accu >>= 2;
        target[p.targetPos++] = accu >> 8;
        target[p.targetPos++] = accu & 0xFF;
        return;
    }
  }

  /**
   * Decode base64.
   * Returns number of decoded bytes written to `target`.
   */
  public static decode(source: UintTypedArray, target: UintTypedArray, length: number = source.length): number {
    if (!length) {
      return 0;
    }
    let endPos = length;
    while (DEC_MAP[source[endPos - 1]] === 0xFF && endPos--) {}
    let accu = 0;
    let fourStop = endPos - 4;
    const p = {sourcePos: 0, targetPos: 0};

    // fast loop on four bytes
    do {
      accu = DEC0[source[p.sourcePos]]
        | DEC1[source[p.sourcePos + 1]]
        | DEC2[source[p.sourcePos + 2]]
        | DEC3[source[p.sourcePos + 3]];
      if (accu & 0xFF000000) {
        // handle invalid chunk in slow decoder and fix positions
        Base64.decodeChunk(source, target, endPos, p);
      } else {
        target[p.targetPos] = accu >> 16;
        target[p.targetPos + 1] = (accu >> 8) & 0xFF;
        target[p.targetPos + 2] = accu & 0xFF;
        p.targetPos += 3;
        p.sourcePos += 4;
      }
    } while (p.sourcePos < fourStop);

    // handle last chunk in slow decoder
    Base64.decodeChunk(source, target, endPos, p);
    return p.targetPos;
  }
}
