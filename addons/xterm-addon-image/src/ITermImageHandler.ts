/**
 * Copyright (c) 2020 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Align, ICoreTerminal, IImageAddonOptions, IImageSpec, ImageType, IOscHandler } from './Types';
import { Base64 } from './base64';
import { ImageSize } from './imgsize';
import { ImageStorage } from './ImageStorage';

// ESC ] 1337 ; File = [arguments] : base-64 encoded file contents ^G
//
// Key                  Description of value
// name	  	            base-64 encoded filename. Defaults to "Unnamed file".
// size	  	            File size in bytes.
//                      The file transfer will be canceled if this size is exceeded.
// width	  	          Optional. Width to render. See notes below.
// height	  	          Optional. Height to render. See notes below.
// preserveAspectRatio	Optional. If set to 0, then the image's inherent aspect ratio will not be respected;
//                      otherwise, it will fill the specified width and height as much as possible without stretching.
//                      Defaults to 1.
// inline	  	          Optional. If set to 1, the file will be displayed inline.
//                      Otherwise, it will be downloaded with no visual representation in the terminal session.
//                      Defaults to 0.
//
// The width and height are given as a number followed by a unit, or the word "auto".
//
//     N: N character cells.
//     Npx: N pixels.
//     N%: N percent of the session's width or height.
//     auto: The image's inherent size will be used to determine an appropriate dimension.
//
// The width/height description is quite unclear (lacks any defaults). --> Needs live tests.



interface IHeader {
  [key: string]: any;
  name: string;
  size: number;
  width?: string;
  height?: string;
  preserveAspectRatio: boolean;
  inline: boolean;
}

const DEFAULT_HEADER: IHeader = {
  name: 'Unnamed file',
  size: 0,
  preserveAspectRatio: true,
  inline: false
};

const FIELD_PARSER: { [key: string]: (data: string) => any } = {
  name: (data: string) => utf8StringToString(atob(data)),
  size: parseInt,
  width: (data: string) => data,
  height: (data: string) => data,
  preserveAspectRatio: (data: string) => !!parseInt(data),
  inline: (data: string) => !!parseInt(data)
};

function utf32ToString(data: Uint32Array, start: number = 0, end: number = data.length): string {
  // Note:  This work only for lengths < 100k, beyond that it throws a stack error.
  //        We still use it for speed reasons, but only for header parts that are rather short.
  return String.fromCharCode.apply(null, data.subarray(start, end) as any);
}

function utf8StringToString(s: string): string {
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; ++i) bytes[i] = s.charCodeAt(i) & 0xFF;
  return (new TextDecoder()).decode(bytes);
}

export class InlineImageProtocol implements IOscHandler {
  private _headerString = '';
  private _header = DEFAULT_HEADER;
  private _imageData: Uint16Array | undefined;
  private _offset = 0;
  private _abort = false;

  constructor(
    private readonly _opts: IImageAddonOptions,
    private readonly _storage: ImageStorage,
    private readonly _coreTerminal: ICoreTerminal
  ) { }

  private _reset(): void {
    this._headerString = '';
    this._header = DEFAULT_HEADER;
    this._imageData = undefined;
    this._offset = 0;
    this._abort = false;
  }

  public start(): void {
    this._reset();
  }

  public put(data: Uint32Array, start: number, end: number): void {
    if (this._abort) return;
    if (this._imageData) {
      if (end - start + this._offset > this._imageData.length) {
        console.log('iTermImageProtocol: too much data, abort');
        this._reset();
        this._abort = true;
        return;
      }
      this._imageData.set(data.subarray(start, end), this._offset);
      this._offset += end - start;
      return;
    }
    // scan for ':' as marker between header and payload
    for (let i = start; i < end; ++i) {
      if (data[i] === 58) {
        this._headerString += utf32ToString(data, start, i);
        if (!this._parseHeader()) {
          return;
        }
        // alloc data array
        this._imageData = new Uint16Array(Base64.encodeSize(this._header.size));
        this._imageData.set(data.subarray(i + 1, end));
        this._offset = end - i - 1;
        return;
      }
    }
    this._headerString += utf32ToString(data, start, end);
  }

  public end(success: boolean): void | boolean {
    if (!this._imageData) return true;
    if (success) {
      this._addImageToStorage();
    }
    this._reset();
    return true;
  }

  private _parseHeader(): boolean {
    if (!this._headerString.startsWith('File=')) {
      this._reset();
      this._abort = true;
      return false;
    }
    this._header = this._headerString.slice(5).split(';').reduce(
      (accu, current) => {
        const [key, value] = current.split('=');
        accu[key] = (FIELD_PARSER[key]) ? FIELD_PARSER[key](value) : value;
        return accu;
      },
      this._header
    );
    this._headerString = '';
    // dont handle file downloads, also limit size
    // TODO: size limit as option
    if (!this._header.inline || this._header.size > 10000000) {
      this._reset();
      this._abort = true;
      return false;
    }
    return true;
  }

  private _addImageToStorage(): void {
    if (!this._imageData) return;

    const bytes = new Uint8Array(this._header.size);
    Base64.decode(this._imageData, bytes);
    const size = ImageSize.guessFromBytes(bytes, false);
    if (size.type === ImageType.INVALID || size.width === -1 || size.height === -1) {
      return;
    }

    // FIXME: move this to node-imgsize
    let mimetype = '';
    switch (size.type) {
      case ImageType.GIF:
        mimetype = 'image/gif';
        break;
      case ImageType.JPEG:
        mimetype = 'image/jpeg';
        break;
      case ImageType.PNG:
        mimetype = 'image/png';
        break;
    }
    const blob = new Blob([bytes], { type: mimetype });

    // TODO: rescale modes
    // FIXME: addImage and ImageSpec needs serious overhaul

    /**
     * Idea:
     * - make Base64.decode a stream decoder outputting decoded chunks with offsets
     * - as soon as we have the dimension notion from JPEG, progress terminal state
     * - offload further decode and image creation to worker
     * - works likewise for SIXELs: as soon as we have dimensions move decoder to worker
     *
     * needed changes in ImageStorage:
     * - make ImageBitmap to the central storage format (with workaround for safari) - not needed anymore?
     * - use canvas only temporarily for rescaling stuff
     * - create a resourceUpdated(imageId) method, which walks the current viewport,
     *   finds lines containing imageId and requests a redraw
     */
    const image = this._storage.getCellAdjustedCanvas(size.width, size.height);
    const imageId = this._storage.addImage(image, {
      scroll: true,   // scrolling off has no meaning here
      right: true,    // FIXME: Is this always on in iTerm?
      below: this._opts.cursorBelow,
      alpha: true,
      fill: 0,
      align: Align.CENTER
    }, false);

    const spec: IImageSpec = (this._storage as any)._images.get(imageId);
    createImageBitmap(blob).then(bitmap => {
      spec.bitmap = bitmap;
      this._coreTerminal._core._renderService.refreshRows(0, this._coreTerminal.rows);
    });
  }
}
