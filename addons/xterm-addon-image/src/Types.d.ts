/**
 * Copyright (c) 2020 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { RGBA8888 } from 'sixel';
import { IDisposable, IMarker, Terminal } from 'xterm';

/**
 * Plugin ctor options.
 */
export interface IImageAddonOptionalOptions {
  /**
   * Leave cursor to right of image.
   * This has no effect, if an image covers all cells to the right.
   * Same as DECSET 8452, default is false.
   */
  cursorRight?: boolean;
  /**
   * Leave cursor below the first row of an image, scrolling if needed.
   * If disabled, the cursor is left at the beginning of the next line.
   * This settings is partially overwritten by `cursorRight`, if an image
   * does not cover all cells to the right.
   * Same as DECSET 7730, default is false.
   */
  cursorBelow?: boolean;

  /**
   * SIXEL settings
   */
  // Whether SIXEL is enabled (default is true).
  sixelSupport?: boolean;
  // Whether SIXEL scrolling is enabled (default is true). Same as DECSET 80.
  sixelScrolling?: boolean;
  // Palette color limit (default 256).
  sixelPaletteLimit?: number;
  // SIXEL image size limit in bytes (default 25000000).
  sixelSizeLimit?: number;
  // Whether to use private palettes for SIXEL sequences (default is true). Same as DECSET 1070.
  sixelPrivatePalette?: boolean;
  // Default start palette (default 'ANSI256').
  sixelDefaultPalette?: 'VT340-COLOR' | 'VT340-GREY' | 'ANSI256';

  /**
   * TODO: iTerm image protocol support
   */
  itermImageProtocolSupport: boolean;

  /**
   * TODO: storage settings
   */
  // storage limit in MBs (default 100 MB)
  storageLimit?: number;
  // whether to show a placeholder for evicted images
  showPlaceholder?: boolean;
}

export type IImageAddonOptions = {
  [P in keyof IImageAddonOptionalOptions]-?: IImageAddonOptionalOptions[P];
};


/**
 * Private interfaces.
 * Note: Some of the interfaces mimick corresponding private interfaces
 * in the xterm codebase, thus ensure to stay in line with those.
 */

// stub symbols needed for private DCS handler support

type ParamsArray = (number | number[])[];

export interface IParams {
  maxLength: number;
  maxSubParamsLength: number;
  params: Int32Array;
  length: number;
  clone(): IParams;
  toArray(): ParamsArray;
  reset(): void;
  addParam(value: number): void;
  addSubParam(value: number): void;
  hasSubParams(idx: number): boolean;
  getSubParams(idx: number): Int32Array | null;
  getSubParamsAll(): {[idx: number]: Int32Array};
}

export interface IDcsHandler {
  hook(params: IParams): void;
  put(data: Uint32Array, start: number, end: number): void;
  unhook(success: boolean): void | boolean;
}

export interface IOscHandler {
  start(): void;
  put(data: Uint32Array, start: number, end: number): void;
  end(success: boolean): void | boolean;
}

// stub needed symbols from parser

interface IFunctionIdentifier {
  prefix?: string;
  intermediates?: string;
  final: string;
}

export interface ITerminalParser {
  registerDcsHandler(id: IFunctionIdentifier, handler: IDcsHandler): IDisposable;
  registerOscHandler(id: number, handler: IOscHandler): IDisposable;
}

// stub into xterm core terminal
/* eslint-disable */
export interface ICoreTerminal extends Terminal {
  _core: {
    buffer: {
      x: number;
      y: number;
      ybase: number;
      ydisp: number;
      lines: {
        get(id: number): {
          getBg(id: number): number;
          _extendedAttrs: IExtendedAttrsImage[];
          _data: Uint32Array;
        } | undefined;
      };
    };
    cols: number;
    rows: number;
    screenElement: HTMLElement;
    optionsService: {
      onOptionChange(handler: (s: string) => void): IDisposable;
    };
    _dirtyRowService: {
      markAllDirty(): void;
    };
    open(parent: HTMLElement): void;
    _renderService: IRenderService;
    _inputHandler: {
      _parser: ITerminalParser;
      _curAttrData: {
        isInverse(): boolean;
        isFgDefault(): boolean;
        isFgRGB(): boolean;
        getFgColor(): number;
        isBgDefault(): boolean;
        isBgRGB(): boolean;
        getBgColor(): number;
      };
      lineFeed(): void;
      onRequestReset(handler: () => void): IDisposable;
    };
    _coreService: {
      triggerDataEvent(s: string): void;
    };
    _colorManager: {
      colors: {
        ansi: {
          [key: number]: {
            rgba: number;
          };
        };
        foreground: {
          rgba: number;
        };
        background: {
          rgba: number;
        };
      };
    };
  };
}
/* eslint-enable */

// stub dimensions
export interface IRenderDimensions {
  scaledCharWidth: number;
  scaledCharHeight: number;
  scaledCellWidth: number;
  scaledCellHeight: number;
  scaledCharLeft: number;
  scaledCharTop: number;
  scaledCanvasWidth: number;
  scaledCanvasHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  actualCellWidth: number;
  actualCellHeight: number;
}

export interface ICellSize {
  width: number;
  height: number;
}

export interface IImageSpec {
  orig: HTMLCanvasElement | undefined | HTMLImageElement;
  origCellSize: ICellSize;
  actual: HTMLCanvasElement | undefined | HTMLImageElement;
  actualCellSize: ICellSize;
  bitmap: ImageBitmap | undefined;
  marker: IMarker | undefined;
  tileCount: number;
  bufferType: 'alternate' | 'normal';
}


// image storage options
export interface IStorageOptions {
  // whether to scroll on image input
  scroll: boolean;
  // whether cursor should be right in the next logical cell
  right: boolean;
  // whether cursor is moved below the first row or to beginning
  below: boolean;
  // whether image contains alpha parts (to be respected by furture overdrawing composition)
  alpha: boolean;
  // fill color to be used to align to full cell coverage
  fill: RGBA8888;
  // alignment within to covered cells
  align: Align;
}


export const enum Align {
  TOP_LEFT = 0,
  TOP = 1,
  TOP_RIGHT = 2,
  RIGHT = 3,
  BOTTOM_RIGHT = 4,
  BOTTOM = 5,
  BOTTOM_LEFT = 6,
  LEFT = 7,
  CENTER = 8
}

export interface IExtendedAttrsImage {
  underlineStyle: number;
  underlineColor: number;
  imageId: number;
  tileId: number;
  clone(): IExtendedAttrsImage;
  isEmpty(): boolean;
}

export interface IRenderService {
  setRenderer(renderer: any): void;
  dimensions: IRenderDimensions;
  refreshRows(start: number, end: number): void;
}


/**
 * copied over from node-imgsize
 */
export type UintTypedArray = Uint8Array | Uint16Array | Uint32Array | Uint8ClampedArray;

/**
 * Supported image types.
 * INVALID is set if the data does not pass the header checks,
 * either being to short or containing invalid bytes.
 */
export const enum ImageType {
  JPEG = 0,
  PNG = 1,
  GIF = 2,
  INVALID = 255
}

/**
 * Returned by ImageSize functions.
 * If the dimensions could not be determined height/width are set to -1.
 * If the header checks fail type is set to INVALID.
 * PNG and GIF have a fixed sized header thus -1 in width/height means that the data
 * did not pass the header checks.
 * JPEG might pass the header checks (type set to JPEG) and still report no width/height,
 * if the SOFx frame was not found within the provided data.
 */
export interface ISize {
  width: number;
  height: number;
  type: ImageType;
}
