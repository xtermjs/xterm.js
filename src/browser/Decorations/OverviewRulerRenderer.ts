/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { addDisposableDomListener } from 'browser/Lifecycle';
import { IRenderService } from 'browser/services/Services';
import { Disposable } from 'common/Lifecycle';
import { IBufferService, IDecorationService, IInternalDecoration, IOptionsService } from 'common/services/Services';

const enum ScrollbarConstants {
  WIDTH = 15
}

export class OverviewRulerRenderer extends Disposable {
  private _canvas: HTMLCanvasElement;
  private _ctx: CanvasRenderingContext2D | null;
  private readonly _decorationElements: Map<IInternalDecoration, HTMLElement> = new Map();

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
    this._canvas.classList.add('xterm-decoration-scrollbar');
    this._viewportElement.parentElement?.insertBefore(this._canvas, this._viewportElement);
    this._ctx = this._canvas.getContext('2d');
    this._canvas.style.width = `${this._optionsService.options.overviewRulerWidth || ScrollbarConstants.WIDTH}px`;
    this._canvas.style.height = `${this._screenElement.clientHeight}px`;
    this._canvas.width = Math.floor((this._optionsService.options.overviewRulerWidth|| ScrollbarConstants.WIDTH)* window.devicePixelRatio);
    this._canvas.height = Math.floor(this._screenElement.clientHeight * window.devicePixelRatio);
    this.refreshDecorations();
    this.register(this._bufferService.buffers.onBufferActivate(() => {
      this._canvas!.style.display = this._bufferService.buffer === this._bufferService.buffers.alt ? 'none' : 'block';
    }));
    this.register(this._renderService.onRenderedBufferChange(() => this.refreshDecorations()));
    this.register(this._renderService.onDimensionsChange(() => this.refreshDecorations()));
    this.register(addDisposableDomListener(window, 'resize', () => this.refreshDecorations()));
    this.register(this._decorationService.onDecorationRegistered(() => this._queueRefresh()));
    this.register(this._decorationService.onDecorationRemoved(decoration => this._removeDecoration(decoration)));
  }

  public override dispose(): void {
    for (const decoration of this._decorationElements) {
      this._ctx?.clearRect(
        0,
        Math.round(this._canvas.height * (decoration[0].marker.line / this._bufferService.buffers.active.lines.length)),
        this._canvas.width,
        window.devicePixelRatio
      );
    }
    this._decorationElements.clear();
    this._canvas?.remove();
    super.dispose();
  }

  private _refreshStyle(decoration: IInternalDecoration): void {
    if (!this._ctx) {
      return;
    }
    if (decoration.options.anchor === 'right') {
      this._canvas.style.right = decoration.options.x ? `${decoration.options.x * this._renderService.dimensions.actualCellWidth}px` : '';
    } else {
      this._canvas.style.left = decoration.options.x ? `${decoration.options.x * this._renderService.dimensions.actualCellWidth}px` : '';
    }
    if (!decoration.options.overviewRulerItemColor) {
      this._decorationElements.delete(decoration);
      return;
    }
    this._ctx.lineWidth = 1;
    this._ctx.strokeStyle = decoration.options.overviewRulerItemColor;
    this._ctx.strokeRect(
      0,
      Math.round(this._canvas.height * (decoration.options.marker.line / this._bufferService.buffers.active.lines.length)),
      this._canvas.width,
      window.devicePixelRatio
    );
  }

  public refreshDecorations(): void {
    this._canvas.style.width = `${this._canvas.width || ScrollbarConstants.WIDTH}px`;
    this._canvas.style.height = `${this._screenElement.clientHeight}px`;
    this._canvas.width = Math.floor((this._canvas.width || ScrollbarConstants.WIDTH)* window.devicePixelRatio);
    this._canvas.height = Math.floor(this._screenElement.clientHeight * window.devicePixelRatio);

    for (const decoration of this._decorationService.decorations) {
      this._renderDecoration(decoration);
    }
  }

  private _renderDecoration(decoration: IInternalDecoration): void {
    const element = this._decorationElements.get(decoration);
    if (!element) {
      this._decorationElements.set(decoration, this._canvas);
    }
    this._refreshStyle(decoration);
    decoration.onRenderEmitter.fire(this._canvas);
  }

  private _queueRefresh(): void {
    if (this._animationFrame !== undefined) {
      return;
    }
    this._animationFrame = window.requestAnimationFrame(() => {
      this.refreshDecorations();
      this._animationFrame = undefined;
    });
  }

  private _removeDecoration(decoration: IInternalDecoration): void {
    const element = this._decorationElements.get(decoration);
    element?.remove();
    this._decorationElements.delete(decoration);
  }
}
