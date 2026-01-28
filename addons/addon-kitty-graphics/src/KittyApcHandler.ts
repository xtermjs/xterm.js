/**
 * Copyright (c) 2025 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * Kitty graphics protocol types, constants, parsing, and APC handler.
 */

import type { IKittyImage } from '@xterm/addon-kitty-graphics';

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
 * See: https://sw.kovidgoyal.net/kitty/graphics-protocol/#control-data-reference where the format for *-bit came from.
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
 * Stores metadata from the first chunk while accumulating payload data.
 */
interface IPendingTransmission {
  /** The parsed command from the first chunk (contains action, format, dimensions, etc.) */
  cmd: IKittyCommand;
  /** Accumulated base64 payload data */
  data: string;
}

/**
 * Terminal interface for sending responses.
 * Question from Anthony: Do we really need this...
 */
interface ITerminal {
  input(data: string, wasUserInput: boolean): void;
}

/**
 * Renderer interface for image display.
 */
interface IKittyRenderer {
  getCellSize(): { width: number, height: number };
  placeImage(bitmap: ImageBitmap, id: number, col?: number, row?: number, width?: number, height?: number): number;
  removeByImageId(id: number): void;
  clearAll(): void;
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

/**
 * Handles Kitty graphics protocol APC sequences.
 * Manages parsing, chunked transmissions, and dispatching to action handlers.
 *
 * TODO: Go over this with Daniel: Like SixelHandler, this receives direct references to storage
 * and terminal rather than using callbacks.
 *
 * TODO: File transmission (t=f) is not supported since browsers cannot access the filesystem.
 * Maybe we need something from VS Code?
 */
export class KittyApcHandler {
  /**
   * Pending chunked transmissions keyed by image ID.
   * ID 0 is used for transmissions without an explicit ID (the "anonymous" transmission).
   */
  private _pendingTransmissions: Map<number, IPendingTransmission> = new Map();
  private _nextImageId = 1;

  constructor(
    private readonly _images: Map<number, IKittyImage>,
    private readonly _decodedImages: Map<number, ImageBitmap>,
    private readonly _renderer: IKittyRenderer | undefined,
    private readonly _terminal: ITerminal | undefined,
    private readonly _debug: boolean = false
  ) {}

  /**
   * Handle a Kitty graphics APC sequence.
   * @param data - The data portion of the APC sequence (after 'G')
   * @returns true if handled successfully
   */
  public handle(data: string): boolean {
    const semiIdx = data.indexOf(';');
    const controlData = semiIdx === -1 ? data : data.substring(0, semiIdx);
    const payload = semiIdx === -1 ? '' : data.substring(semiIdx + 1);

    const cmd = parseKittyCommand(controlData);
    cmd.payload = payload;

    if (this._debug) {
      console.log('[KittyApcHandler] Received command:', cmd);
    }

    const action = cmd.action ?? 't';

    switch (action) {
      case KittyAction.TRANSMIT:
        return this._handleTransmit(cmd);
      case KittyAction.TRANSMIT_DISPLAY:
        return this._handleTransmitDisplay(cmd);
      case KittyAction.QUERY:
        return this._handleQuery(cmd);
      case KittyAction.DELETE:
        return this._handleDelete(cmd);
      default:
        return true;
    }
  }

  /**
   * Clear all pending transmissions. Called on dispose.
   */
  public clearPendingTransmissions(): void {
    this._pendingTransmissions.clear();
  }

  private _handleTransmit(cmd: IKittyCommand): boolean {
    const payload = cmd.payload ?? '';
    const pendingKey = cmd.id ?? 0;

    // larger image would require chunking.
    const isMoreComing = cmd.more === 1;
    const pending = this._pendingTransmissions.get(pendingKey);

    if (pending) {
      pending.data += payload;

      if (this._debug) {
        console.log(`[KittyApcHandler] Chunk continuation for id=${pendingKey}, total size=${pending.data.length}, more=${isMoreComing}`);
      }

      if (isMoreComing) {
        return true;
      }

      const originalCmd = pending.cmd;
      const fullPayload = pending.data;
      this._pendingTransmissions.delete(pendingKey);

      const id = originalCmd.id ?? this._nextImageId++;

      const image: IKittyImage = {
        id,
        data: fullPayload,
        width: originalCmd.width ?? 0,
        height: originalCmd.height ?? 0,
        format: (originalCmd.format ?? KittyFormat.PNG) as 24 | 32 | 100,
        compression: originalCmd.compression ?? ''
      };

      this._images.set(image.id, image);

      if (this._debug) {
        console.log(`[KittyApcHandler] Stored chunked image ${id}, payload size=${fullPayload.length}`);
      }

      if (originalCmd.action === KittyAction.TRANSMIT_DISPLAY) {
        this._displayImage(image, originalCmd.columns, originalCmd.rows);
      }

      cmd.id = id;
      return true;
    }

    if (isMoreComing) {
      this._pendingTransmissions.set(pendingKey, {
        cmd: { ...cmd },
        data: payload
      });

      if (this._debug) {
        console.log(`[KittyApcHandler] Started chunked transmission, id=${pendingKey}, format=${cmd.format}, compression=${cmd.compression}, size=${cmd.width}x${cmd.height}, initial payload=${payload.length}`);
      }

      return true;
    }

    const id = cmd.id ?? this._nextImageId++;

    const image: IKittyImage = {
      id,
      data: payload,
      width: cmd.width ?? 0,
      height: cmd.height ?? 0,
      format: (cmd.format ?? KittyFormat.PNG) as 24 | 32 | 100,
      compression: cmd.compression ?? ''
    };

    this._images.set(image.id, image);

    if (this._debug) {
      console.log(`[KittyApcHandler] Stored image ${id}`);
    }

    cmd.id = id;
    return true;
  }

  private _handleTransmitDisplay(cmd: IKittyCommand): boolean {
    const pendingKey = cmd.id ?? 0;
    const wasPendingBefore = this._pendingTransmissions.has(pendingKey);

    this._handleTransmit(cmd);

    if (cmd.more === 1) {
      return true;
    }

    if (wasPendingBefore) {
      return true;
    }

    const id = cmd.id!;
    const image = this._images.get(id);
    if (image) {
      this._displayImage(image, cmd.columns, cmd.rows);
    }

    return true;
  }

  /**
   * Handle query action (a=q).
   *
   * Per the Kitty graphics protocol documentation:
   * "Sometimes, using an id is not appropriate... In that case, you can use the
   * query action, set a=q. Then the terminal emulator will try to load the image
   * and respond with either OK or an error, as above, but it will not replace an
   * existing image with the same id, nor will it store the image."
   */
  private _handleQuery(cmd: IKittyCommand): boolean {
    const id = cmd.id ?? 0;
    const quiet = cmd.quiet ?? 0;

    if (this._debug) {
      console.log(`[KittyApcHandler] Query received, id=${id}, quiet=${quiet}`);
    }

    const payload = cmd.payload || '';

    if (!payload) {
      this._sendResponse(id, 'OK', quiet);
      return true;
    }

    try {
      const binaryString = atob(payload);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const format = cmd.format || KittyFormat.RGBA;

      if (format === KittyFormat.PNG) {
        this._sendResponse(id, 'OK', quiet);
      } else {
        const width = cmd.width || 0;
        const height = cmd.height || 0;

        if (!width || !height) {
          this._sendResponse(id, 'EINVAL:width and height required for raw pixel data', quiet);
          return true;
        }

        const bytesPerPixel = format === KittyFormat.RGBA ? BYTES_PER_PIXEL_RGBA : BYTES_PER_PIXEL_RGB;
        const expectedBytes = width * height * bytesPerPixel;

        if (bytes.length < expectedBytes) {
          this._sendResponse(id, `EINVAL:insufficient pixel data, got ${bytes.length}, expected ${expectedBytes}`, quiet);
          return true;
        }

        this._sendResponse(id, 'OK', quiet);
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'unknown error';
      this._sendResponse(id, `EINVAL:${errorMsg}`, quiet);
    }

    return true;
  }

  private _handleDelete(cmd: IKittyCommand): boolean {
    const id = cmd.id;

    if (id !== undefined) {
      this._images.delete(id);
      // Close and remove decoded bitmap
      const bitmap = this._decodedImages.get(id);
      if (bitmap) {
        bitmap.close();
        this._decodedImages.delete(id);
      }
      // Remove from renderer
      this._renderer?.removeByImageId(id);
    } else {
      this._images.clear();
      // Close all decoded bitmaps
      for (const bitmap of this._decodedImages.values()) {
        bitmap.close();
      }
      this._decodedImages.clear();
      // Clear all from renderer
      this._renderer?.clearAll();
    }

    return true;
  }

  /**
   * Send a response back to the client via the terminal's input method.
   */
  private _sendResponse(id: number, message: string, quiet: number): void {
    const isOk = message === 'OK';
    if (isOk && quiet === 1) {
      return;
    }
    if (!isOk && quiet === 2) {
      return;
    }

    if (!this._terminal) {
      return;
    }

    const response = `\x1b_Gi=${id};${message}\x1b\\`;
    this._terminal.input(response, false);

    if (this._debug) {
      console.log(`[KittyApcHandler] Sent response: i=${id};${message}`);
    }
  }

  /**
   * Decode and display an image at the cursor position.
   */
  private _displayImage(image: IKittyImage, columns?: number, rows?: number): void {
    if (!this._renderer) {
      return;
    }

    const storedImage = this._images.get(image.id);
    if (!storedImage) {
      if (this._debug) {
        console.log(`[KittyApcHandler] No image found for id=${image.id} after transmit`);
      }
      return;
    }

    this._decodeAndDisplay(storedImage, columns, rows).catch(err => {
      if (this._debug) {
        console.error(`[KittyApcHandler] Failed to decode/display image ${image.id}:`, err);
      }
    });
  }

  /**
   * Decode an image and display it at the cursor position.
   */
  private async _decodeAndDisplay(image: IKittyImage, columns?: number, rows?: number): Promise<void> {
    if (!this._renderer) {
      return;
    }

    let bitmap = this._decodedImages.get(image.id);

    if (!bitmap) {
      bitmap = await this._decodeImage(image);
      this._decodedImages.set(image.id, bitmap);

      if (this._debug) {
        console.log(`[KittyApcHandler] Decoded image ${image.id}: ${bitmap.width}x${bitmap.height}`);
      }
    }

    let width = 0;
    let height = 0;
    if (columns || rows) {
      const cellSize = this._renderer.getCellSize();
      if (columns) {
        width = columns * cellSize.width;
      }
      if (rows) {
        height = rows * cellSize.height;
      }
      if (width && !height) {
        height = Math.round(width * (bitmap.height / bitmap.width));
      } else if (height && !width) {
        width = Math.round(height * (bitmap.width / bitmap.height));
      }
    }

    this._renderer.placeImage(bitmap, image.id, undefined, undefined, width, height);

    if (this._debug) {
      console.log(`[KittyApcHandler] Placed image ${image.id} at cursor, size: ${width || bitmap.width}x${height || bitmap.height}`);
    }
  }

  /**
   * Decode base64 image data into an ImageBitmap.
   */
  private async _decodeImage(image: IKittyImage): Promise<ImageBitmap> {
    const format = image.format;
    const base64Data = image.data as string;

    // TODO: This atob + charCodeAt loop has bad runtime and creates memory pressure with large
    // images. Consider using the wasm-based base64 decoder from xterm-wasm-parts which also
    // supports chunked data ingestion. See addon-image/src/IIPHandler.ts for chunked usage.
    const binaryString = atob(base64Data);
    let bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    if (image.compression === KittyCompression.ZLIB) {
      bytes = await this._decompressZlib(bytes);
      if (this._debug) {
        console.log(`[KittyApcHandler] Decompressed ${binaryString.length} -> ${bytes.length} bytes`);
      }
    }

    if (format === KittyFormat.PNG) {
      const blob = new Blob([bytes], { type: 'image/png' });
      return createImageBitmap(blob);
    }

    const width = image.width;
    const height = image.height;

    if (!width || !height) {
      throw new Error('Width and height required for raw pixel data');
    }

    const bytesPerPixel = format === KittyFormat.RGBA ? BYTES_PER_PIXEL_RGBA : BYTES_PER_PIXEL_RGB;
    const expectedBytes = width * height * bytesPerPixel;

    if (bytes.length < expectedBytes) {
      throw new Error(`Insufficient pixel data: got ${bytes.length}, expected ${expectedBytes}`);
    }

    // Convert to RGBA ImageData
    // TODO: Get this checked by Daniel.
    const pixelCount = width * height;
    const data = new Uint8ClampedArray(pixelCount * BYTES_PER_PIXEL_RGBA);
    const isRgba = format === KittyFormat.RGBA;

    let srcOffset = 0;
    let dstOffset = 0;
    for (let i = 0; i < pixelCount; i++) {
      data[dstOffset    ] = bytes[srcOffset    ]; // R
      data[dstOffset + 1] = bytes[srcOffset + 1]; // G
      data[dstOffset + 2] = bytes[srcOffset + 2]; // B
      data[dstOffset + 3] = isRgba ? bytes[srcOffset + 3] : ALPHA_OPAQUE;
      srcOffset += bytesPerPixel;
      dstOffset += BYTES_PER_PIXEL_RGBA;
    }

    return createImageBitmap(new ImageData(data, width, height));
  }

  /**
   * Decompress zlib/deflate compressed data using the browser's DecompressionStream API.
   */
  private async _decompressZlib(compressed: Uint8Array): Promise<Uint8Array> {
    try {
      return await this._decompress(compressed, 'deflate');
    } catch {
      return await this._decompress(compressed, 'deflate-raw');
    }
  }

  private async _decompress(compressed: Uint8Array, format: 'deflate' | 'deflate-raw'): Promise<Uint8Array> {
    const ds = new DecompressionStream(format);
    const writer = ds.writable.getWriter();
    writer.write(compressed);
    writer.close();

    const chunks: Uint8Array[] = [];
    const reader = ds.readable.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  }
}
