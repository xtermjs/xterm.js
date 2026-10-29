/**
 * Copyright (c) 2024 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * Helpers for the image rendering matrix suite (ImageRendering.test.ts).
 *
 * Everything here is deterministic and generated at test time so the suite
 * carries zero binary fixtures. Synthetic sources are chosen to make the
 * device- vs CSS-resolution difference legible:
 *
 *  - `checker`/`rings` are high-frequency: downscaling them at CSS resolution
 *    aliases the detail into flat gray, while device resolution retains it.
 *  - `gradient` is low-frequency: it looks the same at either resolution and
 *    acts as a control.
 */

import { deflateSync } from 'zlib';
import { readFileSync } from 'fs';
import { sixelEncode } from 'sixel';

export type Pattern = 'checker' | 'rings' | 'gradient' | 'chart';

/** Generate a `size`x`size` RGBA buffer for the given pattern. */
export function makeRGBA(pattern: Pattern, size: number): Uint8Array {
  const px = new Uint8Array(size * size * 4);
  const set = (x: number, y: number, r: number, g: number, b: number): void => {
    const i = (y * size + x) * 4;
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
  };
  const cx = (size - 1) / 2; const cy = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      switch (pattern) {
        case 'checker': {
          const on = ((x >> 1) + (y >> 1)) & 1; // 2px cells
          const v = on ? 0 : 255;
          set(x, y, v, v, v);
          break;
        }
        case 'rings': {
          const d = Math.hypot(x - cx, y - cy);
          const v = (Math.floor(d) & 1) ? 0 : 255; // 1px concentric rings
          set(x, y, v, v, v);
          break;
        }
        case 'gradient': {
          // Low-frequency: nothing to recover on downscale (honest control).
          const v = Math.round((x / (size - 1)) * 255);
          set(x, y, v, 128, 255 - v);
          break;
        }
        case 'chart': {
          // Multi-frequency checkerboard lens/resolution target: four quadrants
          // with check size doubling (finest top-left). Downscaling collapses
          // the fine quadrants to gray at CSS resolution but resolves them at
          // device resolution - the raw-pixel sibling of fixture/hidpi/
          // resolution-chart.png, usable on kitty and sixel too.
          const half = size / 2;
          const quad = (x < half ? 0 : 1) + (y < half ? 0 : 2);
          const s = Math.max(1, Math.round(size / 160)) * (1 << quad);
          const on = (Math.floor(x / s) + Math.floor(y / s)) & 1;
          const v = on ? 255 : 0;
          set(x, y, v, v, v);
          break;
        }
      }
    }
  }
  return px;
}

// --- minimal PNG encoder (RGBA, filter 0), built on zlib. No deps. ---

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/** Encode an RGBA buffer as a PNG and return base64. */
export function encodePNGBase64(rgba: Uint8Array, w: number, h: number): string {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  // raw scanlines with filter byte 0 per row
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride)
      .copy(raw, y * (stride + 1) + 1);
  }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ]);
  return png.toString('base64');
}

// --- protocol sequence builders ---

/**
 * iTerm inline image (IIP) from an already-encoded image file (PNG/JPEG/...),
 * as `imgcat` would send it. `cells` sizes to N terminal cells.
 */
export function iipFromFile(path: string, cells?: number): string {
  const buf = readFileSync(path);
  const dims = cells ? `width=${cells};height=${cells}` : 'width=auto;height=auto';
  return `\x1b]1337;File=inline=1;size=${buf.length};${dims};preserveAspectRatio=1:${buf.toString('base64')}\x07`;
}

/** iTerm inline image (IIP). `cells` sizes to N terminal cells; undefined = native. */
export function iipSeq(rgba: Uint8Array, w: number, h: number, cells?: number): string {
  const b64 = encodePNGBase64(rgba, w, h);
  const size = Buffer.from(b64, 'base64').length;
  const dims = cells ? `width=${cells};height=${cells}` : 'width=auto;height=auto';
  return `\x1b]1337;File=inline=1;size=${size};${dims};preserveAspectRatio=1:${b64}\x07`;
}

/**
 * IIP sized with explicit `px` params. Per iTerm2 these address DEVICE pixels,
 * so the image must render `px` device pixels regardless of devicePixelRatio.
 */
export function iipSeqPx(rgba: Uint8Array, w: number, h: number, px: number): string {
  const b64 = encodePNGBase64(rgba, w, h);
  const size = Buffer.from(b64, 'base64').length;
  return `\x1b]1337;File=inline=1;size=${size};width=${px}px;height=${px}px;preserveAspectRatio=0:${b64}\x07`;
}

/** kitty graphics, raw RGBA (f=32). `cells` sizes via c=,r=; undefined = native. */
export function kittySeq(rgba: Uint8Array, w: number, h: number, cells?: number): string {
  const b64 = Buffer.from(rgba).toString('base64');
  const keys = `a=T,f=32,s=${w},v=${h}` + (cells ? `,c=${cells},r=${cells}` : '');
  const CH = 4096; const parts: string[] = [];
  for (let i = 0; i < b64.length; i += CH) parts.push(b64.slice(i, i + CH));
  return parts.map((p, i) => {
    const first = i === 0; const last = i === parts.length - 1;
    const k = first ? `${keys},m=${last ? 0 : 1}` : `m=${last ? 0 : 1}`;
    return `\x1b_G${k};${p}\x1b\\`;
  }).join('');
}

/** sixel. No in-band cell sizing exists, so sixel renders at native pixel size. */
export function sixelSeq(rgba: Uint8Array, w: number, h: number): string {
  const palette = new Set<number>();
  const d32 = new Uint32Array(rgba.buffer, rgba.byteOffset, w * h);
  for (let i = 0; i < d32.length; i++) palette.add(d32[i]);
  return '\x1bPq' + sixelEncode(rgba, w, h, [...palette]) + '\x1b\\';
}
