/**
 * Copyright (c) 2025 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { Terminal, ITerminalAddon, IDisposable } from '@xterm/xterm';
import type { KittyGraphicsAddon as IKittyGraphicsApi, IKittyGraphicsOptions, IKittyImage } from '@xterm/addon-kitty-graphics';
import { KittyImageRenderer } from './KittyImageRenderer';

/**
 * Kitty graphics protocol action types.
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
 */
const enum KittyFormat {
  RGB = 24,
  RGBA = 32,
  PNG = 100
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

    switch (key) {
      // Question: How do we know which radix to use?
      case 'a': cmd.action = value; break;
      case 'f': cmd.format = parseInt(value); break;
      case 'i': cmd.id = parseInt(value); break;
      case 's': cmd.width = parseInt(value); break;
      case 'v': cmd.height = parseInt(value); break;
      case 'x': cmd.x = parseInt(value); break;
      case 'y': cmd.y = parseInt(value); break;
      case 'c': cmd.columns = parseInt(value); break;
      case 'r': cmd.rows = parseInt(value); break;
      case 'm': cmd.more = parseInt(value); break;
      case 'q': cmd.quiet = parseInt(value); break;
    }
  }

  return cmd;
}

export class KittyGraphicsAddon implements ITerminalAddon, IKittyGraphicsApi {
  private _terminal: Terminal | undefined;
  private _apcHandler: IDisposable | undefined;
  private _renderer: KittyImageRenderer | undefined;
  private _images: Map<number, IKittyImage> = new Map();
  private _decodedImages: Map<number, ImageBitmap> = new Map();
  private _pendingData: Map<number, string> = new Map();
  private _nextImageId = 1;
  private _debug: boolean;

  constructor(options?: IKittyGraphicsOptions) {
    this._debug = options?.debug ?? false;
  }

  public get images(): ReadonlyMap<number, IKittyImage> {
    return this._images;
  }

  public activate(terminal: Terminal): void {
    this._terminal = terminal;
    this._renderer = new KittyImageRenderer(terminal);

    if (this._debug) {
      console.log('[KittyGraphicsAddon] Activating, registering APC handler for G (0x47)');
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
    this._pendingData.clear();

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

    const action = cmd.action || 't';

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
    const id = cmd.id || this._nextImageId++;
    const payload = cmd.payload || '';

    if (cmd.more === 1) {
      const existing = this._pendingData.get(id) || '';
      this._pendingData.set(id, existing + payload);
      return true;
    }

    let fullPayload = payload;
    if (this._pendingData.has(id)) {
      fullPayload = this._pendingData.get(id)! + payload;
      this._pendingData.delete(id);
    }

    const image: IKittyImage = {
      id,
      data: fullPayload,
      width: cmd.width || 0,
      height: cmd.height || 0,
      format: (cmd.format || KittyFormat.PNG) as 24 | 32 | 100
    };

    this._images.set(id, image);

    if (this._debug) {
      console.log(`[KittyGraphicsAddon] Stored image ${id}`);
    }

    return true;
  }

  private _handleTransmitDisplay(cmd: IKittyCommand): boolean {
    // First store the image
    this._handleTransmit(cmd);

    // Get the image ID (same logic as _handleTransmit)
    const id = cmd.id || (this._nextImageId - 1);
    const image = this._images.get(id);

    if (!image) {
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
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
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
   * Decode an image and display it at the cursor position.
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

  private _handleQuery(cmd: IKittyCommand): boolean {
    // TODO: Respond with APC sequence indicating graphics support
    // Protocol: terminal should reply with ESC _ G i=<id>;OK ESC \
    if (this._debug) {
      console.log('[KittyGraphicsAddon] Query received');
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
