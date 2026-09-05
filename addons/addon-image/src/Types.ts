/**
 * Copyright (c) 2020 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IDisposable, IMarker, Terminal } from '@xterm/xterm';

// private imports from base repo we build against
import { Attributes, BgFlags, Content, ExtFlags, UnderlineStyle } from 'common/buffer/Constants';
import type { AttributeData } from 'common/buffer/AttributeData';
import type { IParams, IDcsHandler, IOscHandler, IApcHandler, IEscapeSequenceParser } from 'common/parser/Types';
import type { IInputHandler } from 'common/Types';
import type { ITerminal, ReadonlyColorSet } from 'browser/Types';
import type { IRenderDimensions } from 'browser/renderer/shared/Types';
import type { ICoreBrowserService, IRenderService, IThemeService } from 'browser/services/Services';

export const enum Cell {
  CONTENT = 0,  // codepoint and wcwidth information (enum Content)
  FG = 1,       // foreground color in lower 3 bytes (rgb), attrs in 4th byte (enum FgFlags)
  BG = 2,       // background color in lower 3 bytes (rgb), attrs in 4th byte (enum BgFlags)
  SIZE = 3      // size of single cell on buffer array
}

// export some privates for local usage
export { AttributeData, IParams, IDcsHandler, IOscHandler, IApcHandler, BgFlags, IRenderDimensions, IRenderService, Content, ExtFlags, Attributes, UnderlineStyle, ReadonlyColorSet };

/**
 * Plugin ctor options.
 */
export interface IImageAddonOptions {
  enableSizeReports: boolean;
  pixelLimit: number;
  storageLimit: number;
  showPlaceholder: boolean;
  sixelSupport: boolean;
  sixelScrolling: boolean;
  sixelPaletteLimit: number;
  sixelSizeLimit: number;
  iipSupport: boolean;
  iipSizeLimit: number;
  kittySupport: boolean;
  kittySizeLimit: number;
}

export interface IResetHandler {
  // attached to RIS and DECSTR
  reset(): void;
}

/* eslint-disable */
/**
 * Stub into private interfaces.
 * This should be kept in line with common libs.
 * Any change made here should be replayed in the accessors test case to
 * have a somewhat reliable testing against code changes in the core repo.
 */

interface IInputHandlerExt extends IInputHandler {
  _parser: IEscapeSequenceParser;
  _curAttrData: AttributeData;
  _dirtyRowTracker: {
    markRangeDirty(y1: number, y2: number): void;
    markAllDirty(): void;
    markDirty(y: number): void;
  };
  onRequestReset(handler: () => void): IDisposable;
}
/* eslint-enable */

export interface ICoreTerminalExt extends ITerminal {
  _themeService: IThemeService | undefined;
  _inputHandler: IInputHandlerExt;
  _renderService: IRenderService;
  _coreBrowserService: ICoreBrowserService | undefined;
}

export interface ITerminalExt extends Terminal {
  _core: ICoreTerminalExt;
}

/**
 * Some storage definitions.
 */
export interface ICellSize {
  width: number;
  height: number;
}

export type ImageLayer = 'top' | 'bottom';
export type CursorPos = 'vt340' | 'iip';

export interface IAddImageOpts {
  scrolling: boolean;
  layer: ImageLayer;
  zIndex: number;
  cursorPos: CursorPos;
  prescaleX?: number;
  prescaleY?: number;
}

export interface IDrawable {
  native: ImageBitmap | VideoFrame | HTMLCanvasElement;
  width: number;
  height: number;
  close(): void;
  readonly bytes: number;
}

export type ImageType = 'unsupported'
  | 'image/png'
  | 'image/jpeg'
  | 'image/gif'
  | 'image/qoi'
  | 'image/webp'
  | 'image/avif'
  // sixel
  | 'image/sixel'
  // rgb|a blobs for kitty
  | 'image/rgb'
  | 'image/rgba';

export interface IMetrics {
  mime: ImageType;
  width: number;
  height: number;
}

export interface IImageSpec {
  /** entries for a later IImageSource type */
  /** drawable for screen rendering */
  src: IDrawable;
  /** image bytes as blob */
  data: Blob | undefined;
  /** metrics about image like mime and dimensions */
  metrics: IMetrics;

  /** entries for a later IPlacement type */
  /** cell size at time of insert */
  cellSize: ICellSize;
  /** eviction marker */
  marker: IMarker | undefined;
  /** used tiles as eviction hint */
  tileCount: number;
  /** buffer it was placed on */
  bufferType: 'alternate' | 'normal';
  /** layer it was placed on */
  layer: ImageLayer;
  zIndex: number;
  /** scaling factor on source dimensions, default = 1.0 */
  prescaleX: number;
  prescaleY: number;
  /** crop offset into source, default = 0 (currently unused) */
  precropX: number;
  precropY: number;
  /** output scaling, default = 1.0 (currently unused) */
  scaleX: number;
  scaleY: number;
  /** output offset, default = 0 (currently unused) */
  offsetX: number;
  offsetY: number;
  /** compositing mode on output, default = 'alpha' (currently unused) */
  blendMode: 'overwrite' | 'alpha';
}
