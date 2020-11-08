/**
 * Copyright (c) 2020 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IDisposable } from 'xterm';

/**
 * Plugin ctor options.
 */
export interface IImageAddonOptionalOptions {
  // SIXEL settings
  // Whether SIXEL is enabled (default is true).
  sixelSupport?: boolean;
  // Whether SIXEL scrolling is enabled (default is true).
  sixelScrolling?: boolean;
  // Palette color limit (default 256).
  sixelPaletteLimit?: number;
  // SIXEL image size limit in bytes (calculated with 4 channels, default 12000000).
  sixelSizeLimit?: number;
  // Whether it use private palettes for separate SIXEL sequences.
  sixelPrivatePalette?: boolean;
  // Default start palette (default 'ANSI256').
  sixelDefaultPalette?: 'VT340-COLOR' | 'VT340-GREY' | 'ANSI256';
  // TODO: iTerm image protocol support
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

// stub needed symbols from parser

interface IFunctionIdentifier {
  prefix?: string;
  intermediates?: string;
  final: string;
}

export interface ITerminalParser {
  addDcsHandler(id: IFunctionIdentifier, handler: IDcsHandler): IDisposable;
}

// stub into xterm core terminal
/* eslint-disable */
export interface ICoreTerminal {
  _core: {
    _inputHandler: {
      _parser: ITerminalParser;
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
  orig: HTMLCanvasElement;
  origCellSize: ICellSize;
  actual: HTMLCanvasElement;
  actualCellSize: ICellSize;
  bitmap: ImageBitmap | undefined;
}
