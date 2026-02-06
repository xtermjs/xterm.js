/**
 * Copyright (c) 2025 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IApcHandler, IImageAddonOptions, IResetHandler, ITerminalExt } from '../Types';
import { ImageRenderer } from '../ImageRenderer';
import { ImageStorage, CELL_SIZE_DEFAULT } from '../ImageStorage';
import Base64Decoder, { type DecodeStatus } from 'xterm-wasm-parts/lib/base64/Base64Decoder.wasm';
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

// Memory limit for base64 decoder (4MB, same as IIPHandler)
const DECODER_KEEP_DATA = 4194304;
const DECODER_INITIAL_DATA = 4194304; // 4MB

// Local mirror of const enum (esbuild can't inline const enums from external packages)
const DECODER_OK: DecodeStatus.OK = 0;

// Maximum control data size
const MAX_CONTROL_DATA_SIZE = 512;

// Semicolon codepoint
const SEMICOLON = 0x3B;

/**
 * Kitty graphics protocol handler with streaming base64 decoding.
 */
export class KittyGraphicsHandler implements IApcHandler, IResetHandler {
  private _aborted = false;
  private _decodeError = false;

  private _activeDecoder: Base64Decoder | null = null;
  private readonly _maxEncodedBytes: number;
  private readonly _initialEncodedBytes: number;

  // Streaming related states

  /** True while receiving control data (before semicolon). */
  private _inControlData = true;

  /** Buffer for control data. */
  private _controlData = new Uint32Array(MAX_CONTROL_DATA_SIZE);
  private _controlLength = 0;

  /** Pre-calculated encoded size limit */
  private _encodedSizeLimit = 0;
  private _totalEncodedSize = 0;

  /** Parsed command. These are the control data before semicolon. */
  private _parsedCommand: IKittyCommand | null = null;

  // Storage related states

  private _pendingTransmissions: Map<number, IPendingTransmission> = new Map();
  private _nextImageId = 1;
  private _images: Map<number, IKittyImageData> = new Map();
  private _decodedImages: Map<number, ImageBitmap> = new Map();

  constructor(
    private readonly _opts: IImageAddonOptions,
    private readonly _renderer: ImageRenderer,
    private readonly _storage: ImageStorage,
    private readonly _coreTerminal: ITerminalExt
  ) {
    // Convert decoded size limit -> max encoded bytes.
    this._maxEncodedBytes = Math.ceil(this._opts.kittySizeLimit * 4 / 3);
    // ensure we preallocate more than configured limit while using 4mb initial size.
    this._initialEncodedBytes = Math.min(DECODER_INITIAL_DATA, this._maxEncodedBytes);
  }

  public reset(): void {
    for (const pending of this._pendingTransmissions.values()) {
      pending.decoder.release();
    }
    this._pendingTransmissions.clear();
    if (this._activeDecoder) {
      this._activeDecoder.release();
      this._activeDecoder = null;
    }
    this._images.clear();
    for (const bitmap of this._decodedImages.values()) {
      bitmap.close();
    }
    this._decodedImages.clear();
  }

  public start(): void {
    this._aborted = false;
    this._decodeError = false;
    this._inControlData = true;
    this._controlLength = 0;
    this._parsedCommand = null;
    // Pre-calculate encoded limit once: base64 is 4 bytes encoded → 3 bytes decoded
    this._encodedSizeLimit = this._maxEncodedBytes;
    this._totalEncodedSize = 0;
    this._activeDecoder = null;
  }

  public put(data: Uint32Array, start: number, end: number): void {
    if (this._aborted) return;

    if (!this._inControlData) {
      this._streamPayload(data, start, end);
    } else {
      // Scan for semicolon
      let controlEnd = end;
      for (let i = start; i < end; i++) {
        if (data[i] === SEMICOLON) {
          this._inControlData = false;
          controlEnd = i;
          break;
        }
      }

      // Copy control data
      const copyLength = controlEnd - start;
      if (this._controlLength + copyLength > MAX_CONTROL_DATA_SIZE) {
        this._aborted = true;
        return;
      }
      this._controlData.set(data.subarray(start, controlEnd), this._controlLength);
      this._controlLength += copyLength;

      if (!this._inControlData) {
        // Found semicolon - parse control data early for validation
        this._parsedCommand = parseKittyCommand(this._parseControlDataString());

        // Early validation: i+I conflict
        if (this._parsedCommand.id !== undefined && this._parsedCommand.imageNumber !== undefined) {
          this._sendResponse(this._parsedCommand.id, 'EINVAL:cannot specify both i and I keys', this._parsedCommand.quiet ?? 0);
          this._aborted = true;
          return;
        }

        // Delete action doesn't need payload - skip streaming
        if (this._parsedCommand.action === KittyAction.DELETE) {
          return;
        }

        // Stream remaining as payload
        const payloadStart = controlEnd + 1;
        if (payloadStart < end) {
          this._streamPayload(data, payloadStart, end);
        }
      }
    }
  }

  /**
   * Stream payload bytes into the base64 decoder.
   */
  private _streamPayload(data: Uint32Array, start: number, end: number): void {
    if (this._aborted) return;

    // Check size limit (compare encoded bytes against pre-calculated limit)
    // Include cumulative size from pending transmission for multi-chunk images
    const pendingKey = this._parsedCommand?.id ?? 0;
    const pending = this._pendingTransmissions.get(pendingKey);
    const previousEncodedSize = pending?.totalEncodedSize ?? 0;
    this._totalEncodedSize += end - start;
    const cumulativeEncodedSize = previousEncodedSize + this._totalEncodedSize;
    if (cumulativeEncodedSize > this._encodedSizeLimit) {
      const decoderToRelease = this._activeDecoder ?? pending?.decoder;
      if (decoderToRelease) {
        decoderToRelease.release();
      }
      this._activeDecoder = null;
      if (pending) {
        this._pendingTransmissions.delete(pendingKey);
      }
      this._aborted = true;
      return;
    }

    if (this._decodeError) return;

    if (pending?.decoder && !this._activeDecoder) {
      this._activeDecoder = pending.decoder;
    }
    if (!this._activeDecoder) {
      this._activeDecoder = new Base64Decoder(DECODER_KEEP_DATA, this._maxEncodedBytes, this._initialEncodedBytes);
      this._activeDecoder.init();
    }

    if (this._activeDecoder.put(data.subarray(start, end)) !== DECODER_OK) {
      this._activeDecoder.release();
      this._activeDecoder = null;
      this._decodeError = true;
      if (pending) {
        this._pendingTransmissions.delete(pendingKey);
      }
    }
  }

  public end(success: boolean): boolean | Promise<boolean> {
    if (this._aborted || !success) {
      if (this._activeDecoder) {
        this._activeDecoder.release();
        this._activeDecoder = null;
      }
      return true;
    }

    // No semicolon = no payload (delete, capability query)
    if (this._inControlData) {
      return this._handleNoPayloadCommand();
    }

    // Use command parsed early in put() - i+I already validated there
    const cmd = this._parsedCommand!;

    // Delete action was handled by skipping payload - just execute
    if (cmd.action === KittyAction.DELETE) {
      return this._handleDelete(cmd);
    }

    const pendingKey = cmd.id ?? 0;
    const isMoreComing = cmd.more === 1;
    const pending = this._pendingTransmissions.get(pendingKey);

    if (isMoreComing) {
      if (this._activeDecoder) {
        if (pending) {
          pending.totalEncodedSize += this._totalEncodedSize;
          pending.decodeError = pending.decodeError || this._decodeError;
        } else {
          this._pendingTransmissions.set(pendingKey, {
            cmd: { ...cmd },
            decoder: this._activeDecoder,
            totalEncodedSize: this._totalEncodedSize,
            decodeError: this._decodeError
          });
        }
        this._activeDecoder = null;
      }
      return true;
    }

    let decodeError = this._decodeError;
    let finalCmd = cmd;
    let decoder = this._activeDecoder;

    if (pending) {
      finalCmd = pending.cmd;
      decoder = pending.decoder;
      decodeError = decodeError || pending.decodeError;
      this._pendingTransmissions.delete(pendingKey);
    }

    let imageBytes = new Uint8Array(0);
    if (decoder) {
      if (decoder.end() !== DECODER_OK) {
        decodeError = true;
      }
      imageBytes = decoder.data8;
      decoder.release();
    }
    this._activeDecoder = null;

    return this._handleCommandWithBytesAndCmd(finalCmd, imageBytes, decodeError);
  }

  // Command handling

  private _parseControlDataString(): string {
    let str = '';
    for (let i = 0; i < this._controlLength; i++) {
      str += String.fromCodePoint(this._controlData[i]);
    }
    return str;
  }

  private _handleNoPayloadCommand(): boolean | Promise<boolean> {
    const cmd = parseKittyCommand(this._parseControlDataString());

    // Per spec: specifying both i and I is an error
    if (cmd.id !== undefined && cmd.imageNumber !== undefined) {
      this._sendResponse(cmd.id, 'EINVAL:cannot specify both i and I keys', cmd.quiet ?? 0);
      return true;
    }

    const action = cmd.action ?? 't';

    switch (action) {
      case KittyAction.DELETE:
        return this._handleDelete(cmd);
      case KittyAction.QUERY:
        this._sendResponse(cmd.id ?? 0, 'OK', cmd.quiet ?? 0);
        return true;
      default:
        return true;
    }
  }

  private _handleCommandWithBytesAndCmd(cmd: IKittyCommand, bytes: Uint8Array, decodeError: boolean): boolean | Promise<boolean> {
    const action = cmd.action ?? 't';

    switch (action) {
      case KittyAction.TRANSMIT:
        return this._handleTransmit(cmd, bytes, decodeError);
      case KittyAction.TRANSMIT_DISPLAY:
        return this._handleTransmitDisplay(cmd, bytes, decodeError);
      case KittyAction.QUERY:
        return this._handleQuery(cmd, bytes, decodeError);
      default:
        return true;
    }
  }

  private _handleTransmit(cmd: IKittyCommand, bytes: Uint8Array, decodeError: boolean): boolean {
    // TODO: Support file-based transmission modes (t=f, t=t, t=s)
    // Currently only supports direct transmission (t=d, the default).
    // - t=f (file): Payload is base64-encoded file path. Terminal reads image from that path.
    // - t=t (temp file): Payload is base64-encoded path in temp directory. Terminal reads, deletes.
    // - t=s Payload is base64-encoded POSIX shm name. Terminal reads from shared memory.
    // These modes require filesystem/IPC access not available in browsers. For Node.js/Electron:
    // 1. Check cmd.transmission (t key) before treating bytes as image data
    // 2. For t=f/t/s: decode bytes as UTF-8 string (the path/name), then read file contents
    // 3. For t=d: treat bytes as image data (current behavior)

    if (decodeError || bytes.length === 0) return true;

    const id = cmd.id ?? this._nextImageId++;
    const image: IKittyImageData = {
      id,
      data: bytes,
      width: cmd.width ?? 0,
      height: cmd.height ?? 0,
      format: (cmd.format ?? KittyFormat.PNG) as 24 | 32 | 100,
      compression: cmd.compression ?? ''
    };
    this._images.set(id, image);
    return true;
  }

  private _handleTransmitDisplay(cmd: IKittyCommand, bytes: Uint8Array, decodeError: boolean): boolean | Promise<boolean> {
    if (decodeError) return true;

    const pendingKey = cmd.id ?? 0;

    this._handleTransmit(cmd, bytes, decodeError);

    // If still accumulating chunks, don't display yet
    if (this._pendingTransmissions.has(pendingKey)) return true;

    // Display the completed image
    const id = cmd.id ?? this._nextImageId - 1;
    const image = this._images.get(id);
    if (image) {
      return this._displayImage(image, cmd.columns, cmd.rows);
    }
    return true;
  }

  private _handleQuery(cmd: IKittyCommand, bytes: Uint8Array, decodeError: boolean): boolean {
    const id = cmd.id ?? 0;
    const quiet = cmd.quiet ?? 0;

    // Check decode error first (invalid base64)
    if (decodeError) {
      this._sendResponse(id, 'EINVAL:invalid base64 data', quiet);
      return true;
    }

    // Capability query (no payload) - just respond OK
    if (bytes.length === 0) {
      this._sendResponse(id, 'OK', quiet);
      return true;
    }

    const format = cmd.format ?? KittyFormat.RGBA;

    if (format === KittyFormat.PNG) {
      this._sendResponse(id, 'OK', quiet);
    } else {
      const width = cmd.width ?? 0;
      const height = cmd.height ?? 0;

      if (!width || !height) {
        this._sendResponse(id, 'EINVAL:width and height required for raw pixel data', quiet);
        return true;
      }

      const bytesPerPixel = format === KittyFormat.RGBA ? BYTES_PER_PIXEL_RGBA : BYTES_PER_PIXEL_RGB;
      const expectedBytes = width * height * bytesPerPixel;

      if (bytes.length < expectedBytes) {
        this._sendResponse(id, `EINVAL:insufficient pixel data`, quiet);
        return true;
      }

      this._sendResponse(id, 'OK', quiet);
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

  private _sendResponse(id: number, message: string, quiet: number): void {
    const isOk = message === 'OK';
    if (isOk && quiet === 1) return;
    if (!isOk && quiet === 2) return;

    const response = `\x1b_Gi=${id};${message}\x1b\\`;
    this._coreTerminal._core.coreService.triggerDataEvent(response);
  }

  // Image display

  private _displayImage(image: IKittyImageData, columns?: number, rows?: number): boolean | Promise<boolean> {
    return this._decodeAndDisplay(image, columns, rows)
      .then(() => true)
      .catch(() => true);
  }

  private async _decodeAndDisplay(image: IKittyImageData, columns?: number, rows?: number): Promise<void> {
    let bitmap = this._decodedImages.get(image.id);

    if (!bitmap) {
      bitmap = await this._createBitmap(image);
      this._decodedImages.set(image.id, bitmap);
    }

    let w = bitmap.width;
    let h = bitmap.height;

    if (columns || rows) {
      const cw = this._renderer.dimensions?.css.cell.width || CELL_SIZE_DEFAULT.width;
      const ch = this._renderer.dimensions?.css.cell.height || CELL_SIZE_DEFAULT.height;

      if (columns) w = columns * cw;
      if (rows) h = rows * ch;

      if (columns && !rows) h = Math.round(w * (bitmap.height / bitmap.width));
      else if (rows && !columns) w = Math.round(h * (bitmap.width / bitmap.height));
    }

    if (w * h > this._opts.pixelLimit) return;

    if (w !== bitmap.width || h !== bitmap.height) {
      const resized = await createImageBitmap(bitmap, { resizeWidth: w, resizeHeight: h });
      this._storage.addImage(resized);
    } else {
      this._storage.addImage(bitmap);
    }

    // TODO: Implement cursor movement per Kitty graphics protocol spec
    // Per spec: "After placing an image on the screen the cursor must be moved to the
    // right by the number of cols in the image placement rectangle and down by the
    // number of rows in the image placement rectangle."
    //
    // Default behavior (C=0 or unspecified): Move cursor by cols/rows
    // With C=1: Don't move cursor at all
    //
    // Implementation would need:
    // 1. Get placement.C value (cursor movement policy)
    // 2. Calculate cols = placement.columns || Math.ceil(w / cellWidth)
    // 3. Calculate rows = placement.rows || Math.ceil(h / cellHeight)
    // 4. If C !== 1: Move cursor right by cols and down by rows
    //    this._bufferService.buffer.x += cols;
    //    this._bufferService.buffer.y += rows;
  }

  /**
   * Create ImageBitmap from already-decoded image data.
   */
  private async _createBitmap(image: IKittyImageData): Promise<ImageBitmap> {
    let bytes = image.data;


    if (image.compression === KittyCompression.ZLIB) {
      bytes = await this._decompressZlib(bytes);
    }

    if (image.format === KittyFormat.PNG) {
      const blob = new Blob([bytes as BlobPart], { type: 'image/png' });
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

    // Raw pixel data
    const width = image.width;
    const height = image.height;

    if (!width || !height) {
      throw new Error('Width and height required for raw pixel data');
    }

    const bytesPerPixel = image.format === KittyFormat.RGBA ? BYTES_PER_PIXEL_RGBA : BYTES_PER_PIXEL_RGB;
    const expectedBytes = width * height * bytesPerPixel;

    if (bytes.length < expectedBytes) {
      throw new Error('Insufficient pixel data');
    }

    const pixelCount = width * height;
    const data = new Uint8ClampedArray(pixelCount * BYTES_PER_PIXEL_RGBA);
    const isRgba = image.format === KittyFormat.RGBA;

    let srcOffset = 0;
    let dstOffset = 0;
    for (let i = 0; i < pixelCount; i++) {
      data[dstOffset] = bytes[srcOffset];
      data[dstOffset + 1] = bytes[srcOffset + 1];
      data[dstOffset + 2] = bytes[srcOffset + 2];
      data[dstOffset + 3] = isRgba ? bytes[srcOffset + 3] : ALPHA_OPAQUE;
      srcOffset += bytesPerPixel;
      dstOffset += BYTES_PER_PIXEL_RGBA;
    }

    return createImageBitmap(new ImageData(data, width, height));
  }

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
    writer.write(compressed as BufferSource);
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

  public get images(): ReadonlyMap<number, IKittyImageData> {
    return this._images;
  }
}
