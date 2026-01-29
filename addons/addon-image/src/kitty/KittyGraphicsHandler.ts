/**
 * Copyright (c) 2025 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * Kitty graphics protocol APC handler.
 * Implements IApcHandler to integrate with xterm.js parser.
 */

import { IApcHandler, IImageAddonOptions, IResetHandler, ITerminalExt } from '../Types';
import { ImageRenderer } from '../ImageRenderer';
import { ImageStorage, CELL_SIZE_DEFAULT } from '../ImageStorage';
import {
  KittyAction,
  KittyFormat,
  KittyCompression,
  IKittyCommand,
  IPendingTransmission,
  IKittyImageData,
  BYTES_PER_PIXEL_RGB,
  BYTES_PER_PIXEL_RGBA,
  ALPHA_OPAQUE,
  parseKittyCommand
} from './KittyGraphicsTypes';

/**
 * Kitty graphics protocol handler.
 *
 * Handles APC sequences for the Kitty graphics protocol, supporting:
 * - Image transmission (a=t)
 * - Image transmission + display (a=T)
 * - Query (a=q)
 * - Delete (a=d)
 *
 * TODO: File transmission (t=f) is not supported since browsers cannot access the filesystem.
 * Explore using the File System Access API for opt-in filesystem access when available.
 */
export class KittyGraphicsHandler implements IApcHandler, IResetHandler {
  private _aborted = false;
  private _data: string = '';

  /**
   * Pending chunked transmissions keyed by image ID.
   * ID 0 is used for transmissions without an explicit ID (the "anonymous" transmission).
   */
  private _pendingTransmissions: Map<number, IPendingTransmission> = new Map();
  private _nextImageId = 1;

  /**
   * Stored images - kept for protocol compliance (transmit without display, then display later).
   */
  private _images: Map<number, IKittyImageData> = new Map();

  /**
   * Cached decoded bitmaps.
   */
  private _decodedImages: Map<number, ImageBitmap> = new Map();

  constructor(
    private readonly _opts: IImageAddonOptions,
    private readonly _renderer: ImageRenderer,
    private readonly _storage: ImageStorage,
    private readonly _coreTerminal: ITerminalExt
  ) {}

  public reset(): void {
    // Clear pending transmissions
    this._pendingTransmissions.clear();
    // Clear stored images
    this._images.clear();
    // Close decoded bitmaps
    for (const bitmap of this._decodedImages.values()) {
      bitmap.close();
    }
    this._decodedImages.clear();
  }

  /**
   * Called at the start of a new APC sequence.
   */
  public start(): void {
    this._aborted = false;
    this._data = '';
  }

  /**
   * Called for each chunk of data in the APC sequence.
   * Accumulates codepoints as a string.
   */
  public put(data: Uint32Array, start: number, end: number): void {
    if (this._aborted) return;

    // Check size limit
    if (this._data.length + (end - start) > this._opts.kittySizeLimit) {
      console.warn('[KittyHandler] Data exceeds size limit, aborting');
      this._aborted = true;
      return;
    }

    // Convert Uint32Array codepoints to string
    // TODO: This atob + charCodeAt pattern has bad runtime. Consider using the wasm-based
    // base64 decoder from xterm-wasm-parts which supports chunked data ingestion.
    // For now, we accumulate as string and decode at the end.
    for (let i = start; i < end; i++) {
      this._data += String.fromCodePoint(data[i]);
    }
  }

  /**
   * Called at the end of the APC sequence.
   */
  public end(success: boolean): boolean | Promise<boolean> {
    if (this._aborted || !success) {
      return true;
    }

    return this._handleCommand(this._data);
  }

  /**
   * Handle a complete Kitty graphics command.
   */
  private _handleCommand(data: string): boolean | Promise<boolean> {
    const semiIdx = data.indexOf(';');
    const controlData = semiIdx === -1 ? data : data.substring(0, semiIdx);
    const payload = semiIdx === -1 ? '' : data.substring(semiIdx + 1);

    const cmd = parseKittyCommand(controlData);
    cmd.payload = payload;

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

  private _handleTransmit(cmd: IKittyCommand): boolean {
    const payload = cmd.payload ?? '';
    const pendingKey = cmd.id ?? 0;
    const isMoreComing = cmd.more === 1;
    const pending = this._pendingTransmissions.get(pendingKey);

    if (pending) {
      pending.data += payload;

      if (isMoreComing) {
        return true;
      }

      const originalCmd = pending.cmd;
      const fullPayload = pending.data;
      this._pendingTransmissions.delete(pendingKey);

      const id = originalCmd.id ?? this._nextImageId++;

      const image: IKittyImageData = {
        id,
        data: fullPayload,
        width: originalCmd.width ?? 0,
        height: originalCmd.height ?? 0,
        format: (originalCmd.format ?? KittyFormat.PNG) as 24 | 32 | 100,
        compression: originalCmd.compression ?? ''
      };

      this._images.set(image.id, image);

      if (originalCmd.action === KittyAction.TRANSMIT_DISPLAY) {
        // Fire-and-forget the display, transmit itself succeeded
        void this._displayImage(image, originalCmd.columns, originalCmd.rows);
        return true;
      }

      cmd.id = id;
      return true;
    }

    if (isMoreComing) {
      this._pendingTransmissions.set(pendingKey, {
        cmd: { ...cmd },
        data: payload
      });
      return true;
    }

    const id = cmd.id ?? this._nextImageId++;

    const image: IKittyImageData = {
      id,
      data: payload,
      width: cmd.width ?? 0,
      height: cmd.height ?? 0,
      format: (cmd.format ?? KittyFormat.PNG) as 24 | 32 | 100,
      compression: cmd.compression ?? ''
    };

    this._images.set(image.id, image);
    cmd.id = id;
    return true;
  }

  private _handleTransmitDisplay(cmd: IKittyCommand): boolean | Promise<boolean> {
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
      return this._displayImage(image, cmd.columns, cmd.rows);
    }

    return true;
  }

  /**
   * Handle query action (a=q).
   */
  private _handleQuery(cmd: IKittyCommand): boolean {
    const id = cmd.id ?? 0;
    const quiet = cmd.quiet ?? 0;
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
      const bitmap = this._decodedImages.get(id);
      if (bitmap) {
        bitmap.close();
        this._decodedImages.delete(id);
      }
    } else {
      this._images.clear();
      for (const bitmap of this._decodedImages.values()) {
        bitmap.close();
      }
      this._decodedImages.clear();
    }

    return true;
  }

  /**
   * Send a response back to the client.
   */
  private _sendResponse(id: number, message: string, quiet: number): void {
    const isOk = message === 'OK';
    if (isOk && quiet === 1) return;
    if (!isOk && quiet === 2) return;

    const response = `\x1b_Gi=${id};${message}\x1b\\`;
    this._coreTerminal._core.coreService.triggerDataEvent(response);
  }

  /**
   * Decode and display an image using the shared ImageStorage.
   */
  private _displayImage(image: IKittyImageData, columns?: number, rows?: number): boolean | Promise<boolean> {
    return this._decodeAndDisplay(image, columns, rows)
      .then(() => true)
      .catch(err => {
        console.warn('[KittyHandler] Failed to decode/display image:', err);
        return true;
      });
  }

  private async _decodeAndDisplay(image: IKittyImageData, columns?: number, rows?: number): Promise<void> {
    let bitmap = this._decodedImages.get(image.id);

    if (!bitmap) {
      bitmap = await this._decodeImage(image);
      this._decodedImages.set(image.id, bitmap);
    }

    // Calculate display size
    let w = bitmap.width;
    let h = bitmap.height;

    if (columns || rows) {
      const cw = this._renderer.dimensions?.css.cell.width || CELL_SIZE_DEFAULT.width;
      const ch = this._renderer.dimensions?.css.cell.height || CELL_SIZE_DEFAULT.height;

      if (columns) {
        w = columns * cw;
      }
      if (rows) {
        h = rows * ch;
      }
      // Maintain aspect ratio if only one dimension specified
      if (columns && !rows) {
        h = Math.round(w * (bitmap.height / bitmap.width));
      } else if (rows && !columns) {
        w = Math.round(h * (bitmap.width / bitmap.height));
      }
    }

    // Check pixel limit
    if (w * h > this._opts.pixelLimit) {
      console.warn('[KittyHandler] Image exceeds pixel limit');
      return;
    }

    // Use shared ImageStorage to add the image
    // This handles cursor movement and integration with the terminal
    if (w !== bitmap.width || h !== bitmap.height) {
      // Resize if needed
      const resized = await createImageBitmap(bitmap, { resizeWidth: w, resizeHeight: h });
      this._storage.addImage(resized);
    } else {
      this._storage.addImage(bitmap);
    }
  }

  /**
   * Decode base64 image data into an ImageBitmap.
   */
  private async _decodeImage(image: IKittyImageData): Promise<ImageBitmap> {
    const format = image.format;
    const base64Data = image.data;

    // TODO: This atob + charCodeAt loop has bad runtime and creates memory pressure with large
    // images. Consider using the wasm-based base64 decoder from xterm-wasm-parts.
    const binaryString = atob(base64Data);
    let bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    if (image.compression === KittyCompression.ZLIB) {
      bytes = await this._decompressZlib(bytes) as Uint8Array<ArrayBuffer>;
    }

    if (format === KittyFormat.PNG) {
      const blob = new Blob([bytes], { type: 'image/png' });
      // Safari fallback pattern (from IIPHandler)
      if (!window.createImageBitmap) {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        return new Promise<ImageBitmap>((resolve, reject) => {
          img.addEventListener('load', () => {
            URL.revokeObjectURL(url);
            const canvas = ImageRenderer.createCanvas(window.document, img.width, img.height);
            canvas.getContext('2d')?.drawImage(img, 0, 0);
            createImageBitmap(canvas).then(resolve).catch(reject);
          });
          img.addEventListener('error', reject);
          img.src = url;
        });
      }
      return createImageBitmap(blob);
    }

    // Raw pixel data (RGB or RGBA)
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
    // TODO: For RGBA, use bytes directly. For RGB, use Uint32Array bit manipulation
    // for 5-6x speedup.
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
    writer.write(new Uint8Array(compressed) as Uint8Array<ArrayBuffer>);
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

  /**
   * Get stored images (for testing/debugging).
   */
  public get images(): ReadonlyMap<number, IKittyImageData> {
    return this._images;
  }
}
