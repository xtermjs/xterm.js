/**
 * Copyright (c) 2020 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { RGBA8888 } from 'sixel/lib/Types';
import { IDisposable, IMarker, Terminal } from 'xterm';

// private imports from base repo we build against
import { AttributeData } from 'common/buffer/AttributeData';
import { IParams, IDcsHandler, IEscapeSequenceParser } from 'common/parser/Types';
import { IBuffer } from 'common/buffer/Types';
import { IBufferLine, IExtendedAttrs, IInputHandler } from 'common/Types';
import { BgFlags } from 'common/buffer/Constants';
import { IOptionsService, IDirtyRowService, ICoreService } from 'common/services/Services';
import { IColorManager } from 'browser/Types';
import { IRenderDimensions } from 'browser/renderer/Types';
import { IRenderService } from 'browser/services/Services';

// export some privates for local usage
export { AttributeData, IParams, IDcsHandler, BgFlags, IRenderDimensions, IRenderService };

/**
 * Plugin ctor options.
 */
export interface IImageAddonOptionalOptions {
  /**
   * Path to the worker file.
   */
  workerPath?: string;
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
 * Stub into private interfaces.
 * This should be kept in line with common libs.
 * Any change made here should be replayed in the accessors test case to
 * have a somewhat reliable testing against code changes in the core repo.
 */

// overloaded IExtendedAttrs to hold image refs
export interface IExtendedAttrsImage extends IExtendedAttrs {
  imageId: number;
  tileId: number;
}

/* eslint-disable */
export interface IBufferLineExt extends IBufferLine {
  _extendedAttrs: {[index: number]: IExtendedAttrsImage};
  _data: Uint32Array;
}

interface IInputHandlerExt extends IInputHandler {
  _parser: IEscapeSequenceParser;
  _curAttrData: AttributeData;
  onRequestReset(handler: () => void): IDisposable;
}

// we need several private services from core terminal
// thus stub them here (access is tested by test case)
export interface ICoreTerminal extends Terminal {
  _core: {
    buffer: IBuffer;
    cols: number;
    rows: number;
    screenElement: HTMLElement;
    open(parent: HTMLElement): void;

    // needed sub parts
    optionsService: IOptionsService;
    _dirtyRowService: IDirtyRowService;
    _coreService: ICoreService;
    _colorManager: IColorManager;
    _inputHandler: IInputHandlerExt;
    _renderService: IRenderService;
  };
}
/* eslint-enable */


/**
 * Some storage definitions.
 */
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
  // whether image contains alpha parts (to be respected by future overdrawing composition)
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
