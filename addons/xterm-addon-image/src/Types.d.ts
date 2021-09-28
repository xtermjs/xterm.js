/**
 * Copyright (c) 2020 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IDisposable, IMarker, Terminal } from 'xterm';

// private imports from base repo we build against
import { Cell, BgFlags, Content } from 'common/buffer/Constants';
import type { AttributeData } from 'common/buffer/AttributeData';
import type { IParams, IDcsHandler, IEscapeSequenceParser } from 'common/parser/Types';
import type { IBuffer } from 'common/buffer/Types';
import type { IBufferLine, IExtendedAttrs, IInputHandler } from 'common/Types';
import type { IOptionsService, IDirtyRowService, ICoreService } from 'common/services/Services';
import type { IColorManager, ITerminal } from 'browser/Types';
import type { IRenderDimensions } from 'browser/renderer/Types';
import type { IRenderService } from 'browser/services/Services';

// export some privates for local usage
export { AttributeData, IParams, IDcsHandler, BgFlags, IRenderDimensions, IRenderService, IColorManager, Cell, Content };

/**
 * Plugin ctor options.
 */
export interface IImageAddonOptions {
  enableSizeReports: boolean;
  pixelLimit: number;
  storageLimit: number;
  showPlaceholder: boolean;
  cursorRight: boolean;
  cursorBelow: boolean;
  sixelSupport: boolean;
  sixelScrolling: boolean;
  sixelPaletteLimit: number;
  sixelSizeLimit: number;
  sixelPrivatePalette: boolean;
  sixelDefaultPalette: 'VT340-COLOR' | 'VT340-GREY' | 'ANSI256';
}

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
  _extendedAttrs: {[index: number]: IExtendedAttrsImage | undefined};
  _data: Uint32Array;
}

interface IInputHandlerExt extends IInputHandler {
  _parser: IEscapeSequenceParser;
  _curAttrData: AttributeData;
  onRequestReset(handler: () => void): IDisposable;
}

export interface ICoreTerminalExt extends ITerminal {
  _dirtyRowService: IDirtyRowService;
  _colorManager: IColorManager;
  _inputHandler: IInputHandlerExt;
  _renderService: IRenderService;
}

export interface ITerminalExt extends Terminal {
  _core: ICoreTerminalExt;
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
  orig: HTMLCanvasElement | undefined;
  origCellSize: ICellSize;
  actual: HTMLCanvasElement | undefined;
  actualCellSize: ICellSize;
  marker: IMarker | undefined;
  tileCount: number;
  bufferType: 'alternate' | 'normal';
}
