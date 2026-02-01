/**
 * Copyright (c) 2025 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * Kitty graphics protocol types, constants, and parsing utilities.
 */

/**
 * Kitty graphics protocol action types.
 * See: https://sw.kovidgoyal.net/kitty/graphics-protocol/#control-data-reference under key 'a'.
 */
export const enum KittyAction {
  TRANSMIT = 't',
  TRANSMIT_DISPLAY = 'T',
  QUERY = 'q',
  PLACEMENT = 'p',
  DELETE = 'd'
}

/**
 * Kitty graphics protocol format types.
 * See: https://sw.kovidgoyal.net/kitty/graphics-protocol/#control-data-reference
 */
export const enum KittyFormat {
  RGB = 24,
  RGBA = 32,
  PNG = 100
}

/**
 * Kitty graphics protocol compression types.
 * See: https://sw.kovidgoyal.net/kitty/graphics-protocol/#control-data-reference under key 'o'.
 */
export const enum KittyCompression {
  NONE = '',
  ZLIB = 'z'
}

/**
 * Kitty graphics protocol control data keys.
 * See: https://sw.kovidgoyal.net/kitty/graphics-protocol/#control-data-reference
 */
export const enum KittyKey {
  // Action to perform (t=transmit, T=transmit+display, q=query, p=placement, d=delete)
  ACTION = 'a',
  // Image format (24=RGB, 32=RGBA, 100=PNG)
  FORMAT = 'f',
  // Image ID for referencing stored images
  ID = 'i',
  // Source image width in pixels
  WIDTH = 's',
  // Source image height in pixels
  HEIGHT = 'v',
  // The left edge (in pixels) of the image area to display
  X_OFFSET = 'x',
  // The top edge (in pixels) of the image area to display
  Y_OFFSET = 'y',
  // Number of terminal columns to display the image over
  COLUMNS = 'c',
  // Number of terminal rows to display the image over
  ROWS = 'r',
  // More data flag (1=more chunks coming, 0=final chunk)
  MORE = 'm',
  // Compression type (z=zlib). This is essential for chunking larger images.
  COMPRESSION = 'o',
  // Quiet mode (1=suppress OK responses, 2=suppress error responses)
  QUIET = 'q'
}

// Pixel format constants
export const BYTES_PER_PIXEL_RGB = 3;
export const BYTES_PER_PIXEL_RGBA = 4;
export const ALPHA_OPAQUE = 255;

/**
 * Parsed Kitty graphics command.
 */
export interface IKittyCommand {
  action?: string;
  format?: number;
  id?: number;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  columns?: number;
  rows?: number;
  more?: number;
  quiet?: number;
  compression?: string;
  payload?: string;
}

/**
 * Pending chunked transmission state.
 * Stores metadata from the first chunk while accumulating decoded payload data.
 */
export interface IPendingTransmission {
  /** The parsed command from the first chunk (contains action, format, dimensions, etc.) */
  cmd: IKittyCommand;
  /** Accumulated decoded payload chunks */
  chunks: Uint8Array[];
  /** Total size of accumulated chunks */
  totalSize: number;
  /** Leftover base64 bytes (0-3) that weren't aligned in previous chunk */
  leftover: Uint32Array;
  /** Number of valid bytes in leftover */
  leftoverLength: number;
}

/**
 * Stored Kitty image data.
 */
export interface IKittyImageData {
  id: number;
  /** Decoded image bytes (already decoded from base64) */
  data: Uint8Array;
  width: number;
  height: number;
  format: 24 | 32 | 100;
  compression?: string;
}

/**
 * Parses Kitty graphics control data into a command object.
 */
export function parseKittyCommand(data: string): IKittyCommand {
  const cmd: IKittyCommand = {};
  const parts = data.split(',');

  for (const part of parts) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;

    const key = part.substring(0, eqIdx);
    const value = part.substring(eqIdx + 1);

    // Handle string keys first
    if (key === KittyKey.ACTION) {
      cmd.action = value;
      continue;
    }
    if (key === KittyKey.COMPRESSION) {
      cmd.compression = value;
      continue;
    }
    const numValue = parseInt(value);
    switch (key) {
      case KittyKey.FORMAT: cmd.format = numValue; break;
      case KittyKey.ID: cmd.id = numValue; break;
      case KittyKey.WIDTH: cmd.width = numValue; break;
      case KittyKey.HEIGHT: cmd.height = numValue; break;
      case KittyKey.X_OFFSET: cmd.x = numValue; break;
      case KittyKey.Y_OFFSET: cmd.y = numValue; break;
      case KittyKey.COLUMNS: cmd.columns = numValue; break;
      case KittyKey.ROWS: cmd.rows = numValue; break;
      case KittyKey.MORE: cmd.more = numValue; break;
      case KittyKey.QUIET: cmd.quiet = numValue; break;
    }
  }

  return cmd;
}
