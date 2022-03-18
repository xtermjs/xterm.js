/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { addDisposableDomListener } from 'browser/Lifecycle';
import { IRenderService } from 'browser/services/Services';
import { Disposable } from 'common/Lifecycle';
import { IBufferService, IDecorationService, IInternalDecoration, IOptionsService } from 'common/services/Services';

// This is used to reduce memory usage
// when refreshStyle is called
// by storing and updating
// the sizes of the decorations to be drawn
const renderSizes = new Uint16Array(3);
const enum SizeIndex {
  OUTER_SIZE = 0,
  INNER_SIZE = 1
}

const drawHeight = {
  full: 0,
  left: 0,
  center: 0,
  right: 0
};

const drawWidth = {
  full: 0,
  left: 0,
  center: 0,
  right: 0
};

const drawX = {
  full: 0,
  left: 0,
  center: 0,
  right: 0
};

export class OverviewRulerRenderer extends Disposable {
  private readonly _canvas: HTMLCanvasElement;
  private readonly _ctx: CanvasRenderingContext2D;
  private readonly _decorationElements: Map<IInternalDecoration, HTMLElement> = new Map();
  private get _width(): number {
    return this._optionsService.options.overviewRulerWidth || 0;
  }
  private _animationFrame: number | undefined;

  constructor(
    private readonly _viewportElement: HTMLElement,
    private readonly _screenElement: HTMLElement,
    @IBufferService private readonly _bufferService: IBufferService,
    @IDecorationService private readonly _decorationService: IDecorationService,
    @IRenderService private readonly _renderService: IRenderService,
    @IOptionsService private readonly _optionsService: IOptionsService
  ) {
    super();
    this._canvas = document.createElement('canvas');
    this._canvas.classList.add('xterm-decoration-overview-ruler');
    this._refreshCanvasDimensions();
    this._viewportElement.parentElement?.insertBefore(this._canvas, this._viewportElement);
    const ctx = this._canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Ctx cannot be null');
    } else {
      this._ctx = ctx;
    }
    this._queueRefresh(true);
    this.register(this._bufferService.buffers.onBufferActivate(() => {
      this._canvas!.style.display = this._bufferService.buffer === this._bufferService.buffers.alt ? 'none' : 'block';
    }));
    this.register(this._renderService.onRenderedBufferChange(() => this._queueRefresh()));
    this.register(this._renderService.onDimensionsChange(() => this._queueRefresh(true, true)));
    this.register(addDisposableDomListener(window, 'resize', () => this._queueRefresh(true)));
    this.register(this._decorationService.onDecorationRegistered(() => this._queueRefresh(undefined, true)));
    this.register(this._decorationService.onDecorationRemoved(decoration => this._removeDecoration(decoration)));
    this.register(this._optionsService.onOptionChange(o => {
      if (o === 'overviewRulerWidth') {
        // renderSizes[SizeIndex.OUTER_SIZE] = Math.floor(this._canvas.width / 3);
        // renderSizes[SizeIndex.INNER_SIZE] = Math.ceil(this._canvas.width / 3);
        this._refreshDrawConstants();
        this._queueRefresh();
      }
    }));
    console.log('width', this._canvas.width);
    this._refreshDrawConstants();
    // renderSizes[SizeIndex.OUTER_SIZE] = Math.floor(this._canvas.width / 3);
    // renderSizes[SizeIndex.INNER_SIZE] = Math.ceil(this._canvas.width / 3);
  }

  public override dispose(): void {
    for (const decoration of this._decorationElements) {
      decoration[0].dispose();
    }
    this._decorationElements.clear();
    this._canvas?.remove();
    super.dispose();
  }

  private _refreshDrawConstants(): void {
    // width
    const outerWidth = Math.floor(this._canvas.width / 3);
    const innerWidth = Math.ceil(this._canvas.width / 3);
    drawWidth.full = this._canvas.width;
    drawWidth.left = outerWidth;
    drawWidth.center = innerWidth;
    drawWidth.right = outerWidth;
    // height
    drawHeight.full = Math.round(2 * window.devicePixelRatio);
    drawHeight.left = Math.round(6 * window.devicePixelRatio);
    drawHeight.center = Math.round(6 * window.devicePixelRatio);
    drawHeight.right = Math.round(6 * window.devicePixelRatio);
    // x
    drawX.full = 0;
    drawX.left = 0;
    drawX.center = drawWidth.left;
    drawX.right = drawWidth.left + drawWidth.center;
  }

  private _refreshStyle(decoration: IInternalDecoration, updateAnchor?: boolean): void {
    if (updateAnchor) {
      if (decoration.options.anchor === 'right') {
        this._canvas.style.right = decoration.options.x ? `${decoration.options.x * this._renderService.dimensions.actualCellWidth}px` : '';
      } else {
        this._canvas.style.left = decoration.options.x ? `${decoration.options.x * this._renderService.dimensions.actualCellWidth}px` : '';
      }
    }
    if (!decoration.options.overviewRulerOptions) {
      this._decorationElements.delete(decoration);
      return;
    }
    this._ctx.lineWidth = 1;
    this._ctx.fillStyle = decoration.options.overviewRulerOptions.color;
    this._ctx.fillRect(
      /* x */ drawX[decoration.options.overviewRulerOptions.position!],
      /* y */ Math.round(this._canvas.height * (decoration.options.marker.line / this._bufferService.buffers.active.lines.length)),
      /* w */ drawWidth[decoration.options.overviewRulerOptions.position!],
      /* h */ drawHeight[decoration.options.overviewRulerOptions.position!]
    );
  }

  private _refreshCanvasDimensions(): void {
    this._canvas.style.width = `${this._width}px`;
    this._canvas.style.height = `${this._screenElement.clientHeight}px`;
    this._canvas.width = Math.round(this._width * window.devicePixelRatio);
    this._canvas.height = Math.round(this._screenElement.clientHeight * window.devicePixelRatio);
    this._refreshDrawConstants();
  }

  private _refreshDecorations(updateCanvasDimensions?: boolean, updateAnchor?: boolean): void {
    if (updateCanvasDimensions) {
      this._refreshCanvasDimensions();
    }
    this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    for (const decoration of this._decorationService.decorations) {
      this._renderDecoration(decoration, updateAnchor);
    }
  }

  private _renderDecoration(decoration: IInternalDecoration, updateAnchor?: boolean): void {
    const element = this._decorationElements.get(decoration);
    if (!element) {
      this._decorationElements.set(decoration, this._canvas);
      decoration.onDispose(() => this._queueRefresh());
    }
    this._refreshStyle(decoration, updateAnchor);
  }

  private _queueRefresh(updateCanvasDimensions?: boolean, updateAnchor?: boolean): void {
    if (this._animationFrame !== undefined) {
      return;
    }
    this._animationFrame = window.requestAnimationFrame(() => {
      this._refreshDecorations(updateCanvasDimensions, updateAnchor);
      this._animationFrame = undefined;
    });
  }

  private _removeDecoration(decoration: IInternalDecoration): void {
    this._decorationElements.get(decoration)?.remove();
    this._decorationElements.delete(decoration);
  }
}
