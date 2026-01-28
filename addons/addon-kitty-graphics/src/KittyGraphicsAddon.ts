/**
 * Copyright (c) 2025 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { Terminal, ITerminalAddon, IDisposable } from '@xterm/xterm';
import type { KittyGraphicsAddon as IKittyGraphicsApi, IKittyGraphicsOptions, IKittyImage } from '@xterm/addon-kitty-graphics';
import { KittyImageRenderer } from './KittyImageRenderer';
import type { ITerminalExt } from './Types';

/**
 * Kitty graphics protocol action types.
 * Possible actions from protocol.
 * See: https://sw.kovidgoyal.net/kitty/graphics-protocol/#control-data-reference under key 'a'.
 */
const enum KittyAction {
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
const enum KittyFormat {
  RGB = 24,
  RGBA = 32,
  PNG = 100
}

/**
 * Kitty graphics protocol compression types.
 * See: https://sw.kovidgoyal.net/kitty/graphics-protocol/#control-data-reference under key 'o'.
 */
const enum KittyCompression {
  NONE = '',
  ZLIB = 'z'
}

/**
 * Kitty graphics protocol control data keys.
 * See: https://sw.kovidgoyal.net/kitty/graphics-protocol/#control-data-reference
 */
const enum KittyKey {
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
  // Compression type (z=zlib)
  COMPRESSION = 'o',
  // Quiet mode (1=suppress OK responses, 2=suppress error responses)
  QUIET = 'q'
}

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
 * Parses Kitty graphics control data into a command object.
 * Exported for testing.
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
 * Pending chunked transmission state.
 * Stores metadata from the first chunk while accumulating payload data.
 */
interface IPendingTransmission {
  /** The parsed command from the first chunk (contains action, format, dimensions, etc.) */
  cmd: IKittyCommand;
  /** Accumulated base64 payload data */
  data: string;
}

export class KittyGraphicsAddon implements ITerminalAddon, IKittyGraphicsApi {
  private _terminal: ITerminalExt | undefined;
  private _apcHandler: IDisposable | undefined;
  private _renderer: KittyImageRenderer | undefined;
  // Question: ImageAddon has ImageStorage, lot going on there though comapred to IKittyImage atm.
  // Maybe add more, rename to IKittyImageStorage instead of IKittyImage?
  private _images: Map<number, IKittyImage> = new Map();
  private _decodedImages: Map<number, ImageBitmap> = new Map();
  /**
   * Pending chunked transmissions keyed by image ID.
   * ID 0 is used for transmissions without an explicit ID (the "anonymous" transmission).
   */
  private _pendingTransmissions: Map<number, IPendingTransmission> = new Map();
  private _nextImageId = 1;
  private _debug: boolean;

  constructor(options?: IKittyGraphicsOptions) {
    this._debug = options?.debug ?? false;
  }

  public get images(): ReadonlyMap<number, IKittyImage> {
    return this._images;
  }

  public activate(terminal: Terminal): void {
    this._terminal = terminal as ITerminalExt;
    this._renderer = new KittyImageRenderer(terminal);

    if (this._debug) {
      console.log('[KittyGraphicsAddon] Registering APC handler for G (0x47)');
    }

    // Register APC handler for 'G' (0x47) - Kitty graphics protocol
    // APC sequence format: ESC _ G <data> ESC \
    this._apcHandler = terminal.parser.registerApcHandler(0x47, (data: string) => {
      return this._handleKittyGraphics(data);
    });
  }

  public dispose(): void {
    this._apcHandler?.dispose();
    this._renderer?.dispose();
    this._images.clear();
    this._pendingTransmissions.clear();

    // Close all decoded bitmaps
    for (const bitmap of this._decodedImages.values()) {
      bitmap.close();
    }
    this._decodedImages.clear();

    this._terminal = undefined;
  }

  private _handleKittyGraphics(data: string): boolean {
    const semiIdx = data.indexOf(';');
    const controlData = semiIdx === -1 ? data : data.substring(0, semiIdx);
    const payload = semiIdx === -1 ? '' : data.substring(semiIdx + 1);

    const cmd = parseKittyCommand(controlData);
    cmd.payload = payload;

    if (this._debug) {
      console.log('[KittyGraphicsAddon] Received command:', cmd);
    }

    const action = cmd.action ?? 't';

    // Actions from: https://sw.kovidgoyal.net/kitty/graphics-protocol/#control-data-reference
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

  private _handleTransmit(cmd: IKittyCommand): boolean {
    const payload = cmd.payload ?? '';
    // Use 0 as the key for anonymous transmissions (no explicit i=)
    const pendingKey = cmd.id ?? 0;

    // Check if this is a continuation of a chunked transmission
    const isMoreComing = cmd.more === 1;
    const pending = this._pendingTransmissions.get(pendingKey);

    if (pending) {
      // This is a continuation chunk - append data
      pending.data += payload;

      if (this._debug) {
        console.log(`[KittyGraphicsAddon] Chunk continuation for id=${pendingKey}, total size=${pending.data.length}, more=${isMoreComing}`);
      }

      if (isMoreComing) {
        // More chunks coming, keep waiting
        return true;
      }

      // Final chunk - use the stored command's metadata
      const originalCmd = pending.cmd;
      const fullPayload = pending.data;
      this._pendingTransmissions.delete(pendingKey);

      // Assign a real ID if this was anonymous (pendingKey === 0)
      const id = originalCmd.id ?? this._nextImageId++;

      const image: IKittyImage = {
        id,
        data: fullPayload,
        width: originalCmd.width ?? 0,
        height: originalCmd.height ?? 0,
        format: (originalCmd.format ?? KittyFormat.PNG) as 24 | 32 | 100,
        compression: originalCmd.compression ?? ''
      };

      this._images.set(id, image);

      if (this._debug) {
        console.log(`[KittyGraphicsAddon] Stored chunked image ${id}, payload size=${fullPayload.length}`);
      }

      // If the original action was 'T' (transmit+display), display the image now
      if (originalCmd.action === KittyAction.TRANSMIT_DISPLAY) {
        this._decodeAndDisplay(image, originalCmd.columns, originalCmd.rows).catch(err => {
          if (this._debug) {
            console.error(`[KittyGraphicsAddon] Failed to decode/display chunked image ${id}:`, err);
          }
        });
      }

      cmd.id = id;
      return true;
    }

    // This is the first chunk (or a non-chunked transmission)
    if (isMoreComing) {
      // First chunk of a multi-chunk transmission - store the command and start accumulating
      this._pendingTransmissions.set(pendingKey, {
        cmd: { ...cmd },  // Clone the command to preserve metadata
        data: payload
      });

      if (this._debug) {
        console.log(`[KittyGraphicsAddon] Started chunked transmission, id=${pendingKey}, format=${cmd.format}, compression=${cmd.compression}, size=${cmd.width}x${cmd.height}, initial payload=${payload.length}`);
      }

      return true;
    }

    // Non-chunked transmission - store immediately
    const id = cmd.id ?? this._nextImageId++;

    const image: IKittyImage = {
      id,
      data: payload,
      width: cmd.width ?? 0,
      height: cmd.height ?? 0,
      format: (cmd.format ?? KittyFormat.PNG) as 24 | 32 | 100,
      compression: cmd.compression ?? ''
    };

    this._images.set(id, image);

    if (this._debug) {
      console.log(`[KittyGraphicsAddon] Stored image ${id}`);
    }

    // Update cmd.id for _handleTransmitDisplay
    cmd.id = id;
    return true;
  }

  private _handleTransmitDisplay(cmd: IKittyCommand): boolean {
    const pendingKey = cmd.id ?? 0;
    const wasPendingBefore = this._pendingTransmissions.has(pendingKey);

    // Delegate to _handleTransmit which will:
    // 1. Accumulate chunks if m=1
    // 2. Store the image when complete
    // 3. Trigger display when chunked transmission completes (checks original action)
    this._handleTransmit(cmd);

    // If this was a chunked transmission (first chunk with m=1), _handleTransmit
    // stored it as pending and will display when complete. Don't display now.
    if (cmd.more === 1) {
      return true;
    }

    // If there was a pending transmission that just completed, _handleTransmit
    // already triggered the display. Don't display again.
    if (wasPendingBefore) {
      return true;
    }

    // For non-chunked transmission, display now
    const id = cmd.id!;
    const image = this._images.get(id);

    if (!image) {
      if (this._debug) {
        console.log(`[KittyGraphicsAddon] No image found for id=${id} after transmit`);
      }
      return true;
    }

    // Decode and display with sizing
    this._decodeAndDisplay(image, cmd.columns, cmd.rows).catch(err => {
      if (this._debug) {
        console.error(`[KittyGraphicsAddon] Failed to decode/display image ${id}:`, err);
      }
    });

    return true;
  }

  /**
   * Decode base64 image data into an ImageBitmap.
   */
  private async _decodeImage(image: IKittyImage): Promise<ImageBitmap> {
    const format = image.format;
    const base64Data = image.data as string;

    // Decode base64 to binary
    const binaryString = atob(base64Data);
    let bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Decompress if needed (o=z means zlib/deflate compression)
    if (image.compression === KittyCompression.ZLIB) {
      bytes = await this._decompressZlib(bytes);
      if (this._debug) {
        console.log(`[KittyGraphicsAddon] Decompressed ${binaryString.length} -> ${bytes.length} bytes`);
      }
    }

    if (format === KittyFormat.PNG) {
      // PNG: create blob and decode
      const blob = new Blob([bytes], { type: 'image/png' });
      return createImageBitmap(blob);
    }

    // RGB (24) or RGBA (32): create ImageData
    const width = image.width;
    const height = image.height;

    if (!width || !height) {
      throw new Error('Width and height required for raw pixel data');
    }

    const bytesPerPixel = format === KittyFormat.RGBA ? 4 : 3;
    const expectedBytes = width * height * bytesPerPixel;

    if (bytes.length < expectedBytes) {
      throw new Error(`Insufficient pixel data: got ${bytes.length}, expected ${expectedBytes}`);
    }

    // Convert to RGBA ImageData
    const imageData = new ImageData(width, height);
    const data = imageData.data;

    for (let i = 0; i < width * height; i++) {
      const srcOffset = i * bytesPerPixel;
      const dstOffset = i * 4;

      data[dstOffset] = bytes[srcOffset];         // R
      data[dstOffset + 1] = bytes[srcOffset + 1]; // G
      data[dstOffset + 2] = bytes[srcOffset + 2]; // B
      data[dstOffset + 3] = format === KittyFormat.RGBA
        ? bytes[srcOffset + 3]  // A from source
        : 255;                   // Fully opaque for RGB
    }

    return createImageBitmap(imageData);
  }

  /**
   * Decompress zlib/deflate compressed data using the browser's DecompressionStream API.
   */
  private async _decompressZlib(compressed: Uint8Array): Promise<Uint8Array> {
    // Use DecompressionStream API (available in modern browsers)
    // 'deflate-raw' is the format used by zlib without headers
    // Try 'deflate' first (zlib with header), fall back to 'deflate-raw' if that fails
    try {
      return await this._decompress(compressed, 'deflate');
    } catch {
      // If 'deflate' fails, try 'deflate-raw'
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

    // Combine chunks into single Uint8Array
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  }

  /**
   * Decode an image and display it at the cursor position.
   * @param image - The Kitty image to decode and display
   * @param columns - Optional: number of terminal columns to span
   * @param rows - Optional: number of terminal rows to span
   */
  private async _decodeAndDisplay(image: IKittyImage, columns?: number, rows?: number): Promise<void> {
    if (!this._renderer) {
      return;
    }

    // Check if already decoded
    let bitmap = this._decodedImages.get(image.id);

    if (!bitmap) {
      bitmap = await this._decodeImage(image);
      this._decodedImages.set(image.id, bitmap);

      if (this._debug) {
        console.log(`[KittyGraphicsAddon] Decoded image ${image.id}: ${bitmap.width}x${bitmap.height}`);
      }
    }

    // Calculate pixel dimensions from columns/rows if specified
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
      // If only one dimension specified, maintain aspect ratio
      if (width && !height) {
        height = Math.round(width * (bitmap.height / bitmap.width));
      } else if (height && !width) {
        width = Math.round(height * (bitmap.width / bitmap.height));
      }
    }

    // Place at cursor position
    this._renderer.placeImage(bitmap, image.id, undefined, undefined, width, height);

    if (this._debug) {
      console.log(`[KittyGraphicsAddon] Placed image ${image.id} at cursor, size: ${width || bitmap.width}x${height || bitmap.height}`);
    }
  }

  /**
   * Send a response back to the client via the terminal's data event.
   * Per the Kitty protocol, responses are sent when an image id (i=) is specified.
   * Format: ESC _ G i=<id>;message ESC \
   *
   * The quiet flag (q=) can suppress responses:
   * - q=1: suppress OK responses
   * - q=2: suppress error responses
   *
   * @param id - The image ID to include in the response
   * @param message - The message (e.g., 'OK' or 'EINVAL:error description')
   * @param quiet - The quiet flag value (0, 1, or 2)
   */
  private _sendResponse(id: number, message: string, quiet: number): void {
    // Check quiet flag: q=1 suppresses OK, q=2 suppresses errors
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
      console.log(`[KittyGraphicsAddon] Sent response: i=${id};${message}`);
    }
  }

  /**
   * Handle query action (a=q).
   *
   * Per the Kitty graphics protocol documentation:
   * "Sometimes, using an id is not appropriate... In that case, you can use the
   * query action, set a=q. Then the terminal emulator will try to load the image
   * and respond with either OK or an error, as above, but it will not replace an
   * existing image with the same id, nor will it store the image."
   *
   * The query is used by clients to check if the terminal supports the graphics
   * protocol. A typical query looks like:
   *   ESC _ G i=31,s=1,v=1,a=q,t=d,f=24;AAAA ESC \ ESC [c
   *
   * If the terminal supports graphics, it responds with:
   *   ESC _ G i=31;OK ESC \
   *
   * @param cmd - The parsed Kitty command
   */
  private _handleQuery(cmd: IKittyCommand): boolean {
    const id = cmd.id ?? 0;
    const quiet = cmd.quiet ?? 0;

    if (this._debug) {
      console.log(`[KittyGraphicsAddon] Query received, id=${id}, quiet=${quiet}`);
    }

    // Try to validate the image data without storing it
    const payload = cmd.payload || '';

    if (!payload) {
      // No payload - just checking if graphics protocol is supported
      // Respond with OK to indicate support
      this._sendResponse(id, 'OK', quiet);
      return true;
    }

    // Validate the image data can be decoded
    try {
      // Decode base64 to verify it's valid
      const binaryString = atob(payload);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const format = cmd.format || 32;

      if (format === KittyFormat.PNG) {
        // For PNG, we just verify base64 decoded successfully
        // Full PNG validation would require async createImageBitmap
        // which we can't do synchronously, so we trust the data is valid PNG
        this._sendResponse(id, 'OK', quiet);
      } else {
        // RGB (24) or RGBA (32): verify we have enough bytes
        const width = cmd.width || 0;
        const height = cmd.height || 0;

        if (!width || !height) {
          this._sendResponse(id, 'EINVAL:width and height required for raw pixel data', quiet);
          return true;
        }

        const bytesPerPixel = format === KittyFormat.RGBA ? 4 : 3;
        const expectedBytes = width * height * bytesPerPixel;

        if (bytes.length < expectedBytes) {
          this._sendResponse(id, `EINVAL:insufficient pixel data, got ${bytes.length}, expected ${expectedBytes}`, quiet);
          return true;
        }

        this._sendResponse(id, 'OK', quiet);
      }
    } catch (e) {
      // Base64 decode failed or other error
      const errorMsg = e instanceof Error ? e.message : 'unknown error';
      this._sendResponse(id, `EINVAL:${errorMsg}`, quiet);
    }

    return true;
  }

  private _handleDelete(cmd: IKittyCommand): boolean {
    if (cmd.id !== undefined) {
      this._images.delete(cmd.id);
      // Close and remove decoded bitmap
      const bitmap = this._decodedImages.get(cmd.id);
      if (bitmap) {
        bitmap.close();
        this._decodedImages.delete(cmd.id);
      }
      // Remove from renderer
      this._renderer?.removeByImageId(cmd.id);
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
}
