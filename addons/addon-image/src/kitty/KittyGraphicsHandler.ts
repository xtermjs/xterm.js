/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IDisposable } from '@xterm/xterm';
import { IApcHandler, IImageAddonOptions, IResetHandler, ITerminalExt, ImageLayer } from '../Types';
import { ImageRenderer } from '../ImageRenderer';
import { CELL_SIZE_DEFAULT } from '../ImageStorage';
import { KittyImageStorage } from './KittyImageStorage';
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

// Kitty graphics protocol handler with streaming base64 decoding.
export class KittyGraphicsHandler implements IApcHandler, IResetHandler, IDisposable {
  private _aborted = false;
  private _decodeError = false;

  private _activeDecoder: Base64Decoder | null = null;
  private readonly _maxEncodedBytes: number;
  private readonly _initialEncodedBytes: number;

  // Streaming related states

  // True while receiving control data (before semicolon).
  private _inControlData = true;

  // Buffer for control data.
  private _controlData = new Uint32Array(MAX_CONTROL_DATA_SIZE);
  private _controlLength = 0;

  // Pre-calculated encoded size limit
  private _encodedSizeLimit = 0;
  private _totalEncodedSize = 0;

  // Parsed command. These are the control data before semicolon.
  private _parsedCommand: IKittyCommand | null = null;

  // Storage related states

  private _pendingTransmissions: Map<number, IPendingTransmission> = new Map();
  // Tracks the pending key of the most recently started chunked upload.
  // Per spec, subsequent chunks only need m= (and optionally q=), without i=.
  // When a chunk arrives with no i=, this key is used to find the pending upload.
  private _lastPendingKey: number | undefined;

  constructor(
    private readonly _opts: IImageAddonOptions,
    private readonly _renderer: ImageRenderer,
    private readonly _kittyStorage: KittyImageStorage,
    private readonly _coreTerminal: ITerminalExt
  ) {
    // Convert decoded size limit -> max encoded bytes.
    this._maxEncodedBytes = Math.ceil(this._opts.kittySizeLimit * 4 / 3);
    // ensure we preallocate more than configured limit while using 4mb initial size.
    this._initialEncodedBytes = Math.min(DECODER_INITIAL_DATA, this._maxEncodedBytes);
  }

  public reset(): void {
    this._cleanupAllPending();
    if (this._activeDecoder) {
      this._activeDecoder.release();
      this._activeDecoder = null;
    }
    this._kittyStorage.reset();
  }

  public dispose(): void {
    this.reset();
  }

  private _removePendingEntry(key: number): void {
    this._pendingTransmissions.delete(key);
    if (this._lastPendingKey === key) {
      this._lastPendingKey = undefined;
    }
  }

  private _cleanupAllPending(): void {
    for (const pending of this._pendingTransmissions.values()) {
      pending.decoder.release();
    }
    this._pendingTransmissions.clear();
    this._lastPendingKey = undefined;
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

  // Stream payload bytes into the base64 decoder.
  private _streamPayload(data: Uint32Array, start: number, end: number): void {
    if (this._aborted) return;

    // Check size limit (compare encoded bytes against pre-calculated limit)
    // Include cumulative size from pending transmission for multi-chunk images.
    // Per spec, subsequent chunks may omit i=, so fall back to _lastPendingKey.
    const pendingKey = this._parsedCommand?.id ?? this._lastPendingKey ?? 0;
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
        this._removePendingEntry(pendingKey);
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
        this._removePendingEntry(pendingKey);
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

    // Per spec, subsequent chunks may omit i=, so fall back to _lastPendingKey.
    const pendingKey = cmd.id ?? this._lastPendingKey ?? 0;
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
        this._lastPendingKey = pendingKey;
        this._activeDecoder = null;
      }
      return true;
    }

    // Final chunk received — clear the last pending key
    if (pending) {
      this._lastPendingKey = undefined;
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
    }
    this._activeDecoder = null;

    // Handle command first — handlers create Blob/ImageData from imageBytes,
    // which copies the data. Only then is it safe to release the decoder's
    // wasm memory that imageBytes points into.
    const result = this._handleCommandWithBytesAndCmd(finalCmd, imageBytes, decodeError);
    if (decoder) {
      decoder.release();
    }
    return result;
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
        // TODO: Implement remaining actions when needed:
        // - a=p (placement): place a previously transmitted image
        // - a=f (frame): animation frame operations
        // - a=a (animation): animation control
        // - a=c (compose): compose images
        if (cmd.id !== undefined) {
          this._sendResponse(cmd.id, 'EINVAL:unsupported action', cmd.quiet ?? 0);
        }
        return true;
    }
  }

  private _handleCommandWithBytesAndCmd(cmd: IKittyCommand, bytes: Uint8Array, decodeError: boolean): boolean | Promise<boolean> {
    const action = cmd.action ?? 't';

    switch (action) {
      case KittyAction.TRANSMIT: {
        const result = this._handleTransmit(cmd, bytes, decodeError);
        // Only send response when _handleTransmit didn't already respond
        // (it handles unsupported transmission medium responses internally)
        if ((cmd.transmission ?? 'd') === 'd' && cmd.id !== undefined) {
          if (decodeError) {
            this._sendResponse(cmd.id, 'EINVAL:invalid base64 data', cmd.quiet ?? 0);
          } else if (bytes.length > 0) {
            this._sendResponse(cmd.id, 'OK', cmd.quiet ?? 0);
          }
        }
        return result;
      }
      case KittyAction.TRANSMIT_DISPLAY:
        return this._handleTransmitDisplay(cmd, bytes, decodeError);
      case KittyAction.QUERY:
        return this._handleQuery(cmd, bytes, decodeError);
      default:
        // TODO: Implement remaining actions when needed:
        // - a=p (placement): place a previously transmitted image
        // - a=f (frame): animation frame operations
        // - a=a (animation): animation control
        // - a=c (compose): compose images
        if (cmd.id !== undefined) {
          this._sendResponse(cmd.id, 'EINVAL:unsupported action', cmd.quiet ?? 0);
        }
        return true;
    }
  }

  private _handleTransmit(cmd: IKittyCommand, bytes: Uint8Array, decodeError: boolean): boolean {
    // TODO: Support file-based transmission modes (t=f, t=t, t=s)
    // Currently only supports direct transmission (t=d, the default).
    // - t=f (file): Payload is base64-encoded file path. Terminal reads image from that path.
    // - t=t (temp file): Payload is base64-encoded path in temp directory. Terminal reads, deletes.
    // - t=s: Payload is base64-encoded POSIX shm name. Terminal reads from shared memory.
    // These modes require filesystem/IPC access not available in browsers. For Node.js/Electron:
    // 1. Check cmd.transmission (t key) before treating bytes as image data
    // 2. For t=f/t/s: decode bytes as UTF-8 string (the path/name), then read file contents
    // 3. For t=d: treat bytes as image data (current behavior)
    // When implementing, also update _handleQuery to accept these transmission mediums.
    const transmission = cmd.transmission ?? 'd';
    if (transmission !== 'd') {
      if (cmd.id !== undefined) {
        this._sendResponse(cmd.id, 'EINVAL:unsupported transmission medium', cmd.quiet ?? 0);
      }
      return true;
    }

    if (decodeError || bytes.length === 0) return true;

    this._kittyStorage.storeImage(cmd.id, {
      data: new Blob([bytes as BlobPart]),
      width: cmd.width ?? 0,
      height: cmd.height ?? 0,
      format: (cmd.format ?? KittyFormat.RGBA) as 24 | 32 | 100,
      compression: cmd.compression ?? ''
    });
    return true;
  }

  private _handleTransmitDisplay(cmd: IKittyCommand, bytes: Uint8Array, decodeError: boolean): boolean | Promise<boolean> {
    if (decodeError) {
      if (cmd.id !== undefined) {
        this._sendResponse(cmd.id, 'EINVAL:invalid base64 data', cmd.quiet ?? 0);
      }
      return true;
    }

    this._handleTransmit(cmd, bytes, decodeError);

    const id = cmd.id ?? this._kittyStorage.lastImageId;
    const image = this._kittyStorage.getImage(id);
    if (image) {
      const result = this._displayImage(image, cmd);
      if (cmd.id !== undefined) {
        return result.then(success => {
          this._sendResponse(id, success ? 'OK' : 'EINVAL:image rendering failed', cmd.quiet ?? 0);
          return true;
        });
      }
      return result.then(() => true);
    }
    return true;
  }

  private _handleQuery(cmd: IKittyCommand, bytes: Uint8Array, decodeError: boolean): boolean {
    const id = cmd.id ?? 0;
    const quiet = cmd.quiet ?? 0;

    // Per spec: reject unsupported transmission mediums (only t=d is supported atm)
    // TODO: When filesystem support is added (Node.js/Electron), update this to accept
    // t=f (file), t=t (temp file), and t=s (shared memory) and respond OK for queries.
    const transmission = cmd.transmission ?? 'd';
    if (transmission !== 'd') {
      this._sendResponse(id, 'EINVAL:unsupported transmission medium', quiet);
      return true;
    }

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
    // Per spec: default delete selector is 'a' (delete all visible placements)
    const selector = cmd.deleteSelector ?? 'a';

    // TODO: Distinguish lowercase (delete placements only) from uppercase
    // (delete placements + free stored image data). Currently both variants
    // free everything since we don't separate stored data from placements.
    switch (selector) {
      case 'a':
      case 'A':
        this._cleanupAllPending();
        this._kittyStorage.deleteAll();
        break;
      case 'i':
      case 'I':
        if (cmd.id !== undefined) {
          const pending = this._pendingTransmissions.get(cmd.id);
          if (pending) {
            pending.decoder.release();
          }
          this._removePendingEntry(cmd.id);
          this._kittyStorage.deleteById(cmd.id);
        }
        break;
      default:
        // Unsupported selectors (c, n, p, q, r, x, y, z, f) — ignore for now
        break;
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

  private _displayImage(image: IKittyImageData, cmd: IKittyCommand): Promise<boolean> {
    return this._decodeAndDisplay(image, cmd)
      .then(() => true)
      .catch(() => false);
  }

  private async _decodeAndDisplay(image: IKittyImageData, cmd: IKittyCommand): Promise<void> {
    let bitmap = await this._createBitmap(image);

    const cropX = Math.max(0, cmd.x ?? 0);
    const cropY = Math.max(0, cmd.y ?? 0);
    const cropW = cmd.sourceWidth ?? (bitmap.width - cropX);
    const cropH = cmd.sourceHeight ?? (bitmap.height - cropY);

    const maxCropW = Math.max(0, bitmap.width - cropX);
    const maxCropH = Math.max(0, bitmap.height - cropY);
    const finalCropW = Math.max(0, Math.min(cropW, maxCropW));
    const finalCropH = Math.max(0, Math.min(cropH, maxCropH));

    if (finalCropW === 0 || finalCropH === 0) {
      bitmap.close();
      throw new Error('invalid source rectangle');
    }

    if (cropX !== 0 || cropY !== 0 || finalCropW !== bitmap.width || finalCropH !== bitmap.height) {
      const cropped = await createImageBitmap(bitmap, cropX, cropY, finalCropW, finalCropH);
      bitmap.close();
      bitmap = cropped;
    }

    const cw = this._renderer.dimensions?.css.cell.width || CELL_SIZE_DEFAULT.width;
    const ch = this._renderer.dimensions?.css.cell.height || CELL_SIZE_DEFAULT.height;

    // Per spec: c/r default to image's natural cell dimensions
    let imgCols = cmd.columns ?? Math.ceil(bitmap.width / cw);
    let imgRows = cmd.rows ?? Math.ceil(bitmap.height / ch);

    let w = bitmap.width;
    let h = bitmap.height;

    // Scale bitmap to fit placement rectangle when c/r are specified
    if (cmd.columns !== undefined || cmd.rows !== undefined) {
      w = Math.round(imgCols * cw);
      h = Math.round(imgRows * ch);
    }

    if (w * h > this._opts.pixelLimit) {
      bitmap.close();
      throw new Error('image exceeds pixel limit');
    }

    // Save cursor position before addImage modifies it
    const buffer = this._coreTerminal._core.buffer;
    const savedX = buffer.x;
    const savedY = buffer.y;
    const savedYbase = buffer.ybase;

    // Determine layer based on z-index: negative = behind text, 0+ = on top.
    // When z<0 we always use the bottom layer even without allowTransparency —
    // the image will simply be hidden behind the opaque text background, which
    // is the correct behavior (client asked for "behind text").
    const wantsBottom = cmd.zIndex !== undefined && cmd.zIndex < 0;
    const layer: ImageLayer = wantsBottom ? 'bottom' : 'top';

    let finalBitmap = bitmap;
    if (w !== bitmap.width || h !== bitmap.height) {
      finalBitmap = await createImageBitmap(bitmap, { resizeWidth: w, resizeHeight: h });
      bitmap.close();
    }

    // Per spec: X/Y are pixel offsets within the first cell, so clamp to cell dimensions
    const xOffset = Math.min(Math.max(0, cmd.xOffset ?? 0), cw - 1);
    const yOffset = Math.min(Math.max(0, cmd.yOffset ?? 0), ch - 1);
    if (xOffset !== 0 || yOffset !== 0) {
      const offsetCanvas = ImageRenderer.createCanvas(window.document, finalBitmap.width + xOffset, finalBitmap.height + yOffset);
      const offsetCtx = offsetCanvas.getContext('2d');
      if (!offsetCtx) {
        finalBitmap.close();
        throw new Error('Failed to create offset canvas context');
      }
      offsetCtx.drawImage(finalBitmap, xOffset, yOffset);

      const offsetBitmap = await createImageBitmap(offsetCanvas);
      offsetCanvas.width = offsetCanvas.height = 0;
      finalBitmap.close();
      finalBitmap = offsetBitmap;
      w = finalBitmap.width;
      h = finalBitmap.height;
      if (w * h > this._opts.pixelLimit) {
        finalBitmap.close();
        throw new Error('image exceeds pixel limit');
      }
      if (cmd.columns === undefined) {
        imgCols = Math.ceil(finalBitmap.width / cw);
      }
      if (cmd.rows === undefined) {
        imgRows = Math.ceil(finalBitmap.height / ch);
      }
    }

    const zIndex = cmd.zIndex ?? 0;
    this._kittyStorage.addImage(image.id, finalBitmap, true, layer, zIndex);

    // Kitty cursor movement
    // Per spec: cursor placed at first column after last image column,
    // on the last row of the image. C=1 means don't move cursor.
    if (cmd.cursorMovement === 1) {
      // C=1: restore cursor to position before image was placed
      const scrolled = buffer.ybase - savedYbase;
      buffer.x = savedX;
      // Can't restore cursor to scrollback?
      buffer.y = Math.max(savedY - scrolled, 0);
    } else {
      // Default (C=0): advance cursor horizontally past the image
      // addImage already positioned cursor on the last row via lineFeeds
      buffer.x = Math.min(savedX + imgCols, this._coreTerminal.cols);
    }
  }

  // Create ImageBitmap from already-decoded image data.
  private async _createBitmap(image: IKittyImageData): Promise<ImageBitmap> {
    let bytes: Uint8Array = new Uint8Array(await image.data.arrayBuffer());

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
          img.addEventListener('error', () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load image'));
          });
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

    if (image.format === KittyFormat.RGBA) {
      // RGBA: use bytes directly — no copy needed
      return createImageBitmap(new ImageData(new Uint8ClampedArray(bytes.buffer as ArrayBuffer, bytes.byteOffset, pixelCount * BYTES_PER_PIXEL_RGBA), width, height));
    }

    // RGB→RGBA: interleave alpha using uint32 block processing (4 pixels per iteration).
    // 3 uint32 reads + 4 uint32 writes per 4 pixels vs 28 byte reads/writes — ~6x faster.
    // Assumes little-endian (all modern browsers/Node.js).
    const data = new Uint8ClampedArray(pixelCount * BYTES_PER_PIXEL_RGBA);
    const src32 = new Uint32Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 4));
    const dst32 = new Uint32Array(data.buffer);
    const alignedPixels = pixelCount & ~3;  // round down to multiple of 4

    let srcOffset = 0;
    let dstOffset = 0;
    for (let i = 0; i < alignedPixels; i += 4) {
      const b0 = src32[srcOffset++];
      const b1 = src32[srcOffset++];
      const b2 = src32[srcOffset++];
      // Little-endian: pixel bytes are [R,G,B] → uint32 ABGR layout
      dst32[dstOffset++] = (b0 & 0x00FFFFFF) | 0xFF000000;
      dst32[dstOffset++] = ((b0 >>> 24) | (b1 << 8)) & 0x00FFFFFF | 0xFF000000;
      dst32[dstOffset++] = ((b1 >>> 16) | (b2 << 16)) & 0x00FFFFFF | 0xFF000000;
      dst32[dstOffset++] = (b2 >>> 8) | 0xFF000000;
    }

    // Handle remaining 1–3 pixels
    let srcByte = alignedPixels * BYTES_PER_PIXEL_RGB;
    let dstByte = alignedPixels * BYTES_PER_PIXEL_RGBA;
    for (let i = alignedPixels; i < pixelCount; i++) {
      data[dstByte]     = bytes[srcByte];
      data[dstByte + 1] = bytes[srcByte + 1];
      data[dstByte + 2] = bytes[srcByte + 2];
      data[dstByte + 3] = ALPHA_OPAQUE;
      srcByte += BYTES_PER_PIXEL_RGB;
      dstByte += BYTES_PER_PIXEL_RGBA;
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
    return this._kittyStorage.images;
  }

  public get _kittyIdToStorageId(): ReadonlyMap<number, number> {
    return this._kittyStorage.kittyIdToStorageId;
  }

  public get pendingTransmissions(): ReadonlyMap<number, IPendingTransmission> {
    return this._pendingTransmissions;
  }
}
