/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { addDisposableDomListener } from 'browser/Lifecycle';
import { IRenderService } from 'browser/services/Services';
import { EventEmitter, IEvent } from 'common/EventEmitter';
import { Disposable } from 'common/Lifecycle';
import { IBufferService, IDecorationService, IInstantiationService, IInternalDecoration } from 'common/services/Services';
import { IDecorationOptions, IDecoration, IMarker } from 'xterm';

const enum ScrollbarConstants {
  WIDTH = 7
}

export class OverviewRulerRenderer extends Disposable {
  private _canvas: HTMLCanvasElement;
  private _ctx: CanvasRenderingContext2D | null;
  private _decorations: ScrollbarDecoration[] = [];
  private _width: number | undefined;
  private _anchor: 'right' | 'left' | undefined;
  private _x: number | undefined;

  constructor(
    private readonly _viewportElement: HTMLElement,
    private readonly _screenElement: HTMLElement,
    @IBufferService private readonly _bufferService: IBufferService,
    @IDecorationService private readonly _decorationService: IDecorationService,
    @IInstantiationService private readonly _instantiationService: IInstantiationService,
    @IRenderService private readonly _renderService: IRenderService
  ) {
    super();
    this._canvas = document.createElement('canvas');
    this._canvas.classList.add('xterm-decoration-scrollbar');
    this._viewportElement.parentElement?.insertBefore(this._canvas, this._viewportElement);
    this._ctx = this._canvas.getContext('2d');
    this.refreshDecorations();
    this.register(this._bufferService.buffers.onBufferActivate(() => {
      this._canvas!.style.display = this._bufferService.buffer === this._bufferService.buffers.alt ? 'none' : 'block';
    }));
    this.register(this._renderService.onRenderedBufferChange(() => this.refreshDecorations()));
    this.register(this._renderService.onDimensionsChange(() => this.refreshDecorations()));
    this.register(addDisposableDomListener(window, 'resize', () => this.refreshDecorations()));
    this.register(this._decorationService.onDecorationRegistered(e => this.registerDecoration(e)));
    this.register(this._decorationService.onDecorationRemoved(d => d.dispose()));
  }
  public registerDecoration(decoration: IInternalDecoration): void {
    if (!this._ctx || !decoration.options.overviewRulerItemColor) {
      return;
    }

    // TODO: Does this do anything anymore?
    this._instantiationService.createInstance(ScrollbarDecoration, { marker: decoration.options.marker, overviewRulerItemColor: decoration.options.overviewRulerItemColor });

    this._ctx.lineWidth = 1;
    this._ctx.strokeStyle = decoration.options.overviewRulerItemColor;
    this._ctx.strokeRect(
      0,
      Math.round(this._canvas.height * (decoration.marker.line / this._bufferService.buffers.active.lines.length)),
      this._canvas.width,
      window.devicePixelRatio
    );
  }

  public refreshDecorations(): void {
    if (!this._ctx) {
      return;
    }
    this._canvas.style.width = `${this._width || ScrollbarConstants.WIDTH}px`;
    this._canvas.style.height = `${this._screenElement.clientHeight}px`;
    this._canvas.width = Math.floor((this._width || ScrollbarConstants.WIDTH)* window.devicePixelRatio);
    this._canvas.height = Math.floor(this._screenElement.clientHeight * window.devicePixelRatio);
    if (this._anchor === 'right') {
      this._canvas.style.right = this._x ? `${this._x * this._renderService.dimensions.actualCellWidth}px` : '';
    } else {
      this._canvas.style.left = this._x ? `${this._x * this._renderService.dimensions.actualCellWidth}px` : '';
    }
    this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    for (const decoration of this._decorations) {
      decoration.render(this._ctx, this._canvas);
    }
  }
  public override dispose(): void {
    for (const decoration of this._decorations) {
      decoration.dispose();
    }
    this._decorations = [];
    this._canvas?.remove();
    super.dispose();
  }
}
class ScrollbarDecoration extends Disposable implements IDecoration {
  private readonly _marker: IMarker;
  private _ctx: CanvasRenderingContext2D | undefined;
  private _canvas: HTMLCanvasElement | undefined;
  private _color: string | undefined;

  public isDisposed: boolean = false;

  public get element(): HTMLCanvasElement | undefined { return this._canvas; }
  public get marker(): IMarker { return this._marker; }
  public get color(): string | undefined { return this._color; }

  private _onDispose = new EventEmitter<void>();
  public get onDispose(): IEvent<void> { return this._onDispose.event; }

  private _onRender = new EventEmitter<HTMLElement>();
  public get onRender(): IEvent<HTMLElement> { return this._onRender.event; }

  constructor(
    options: IDecorationOptions,
    @IBufferService private readonly _bufferService: IBufferService
  ) {
    super();
    this._marker = options.marker;
    this._color = options.overviewRulerItemColor;
    this._marker.onDispose(() => this.dispose());
  }

  public render(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
    if (!this.color) {
      throw new Error('No color was provided for the overview ruler decoraiton');
    }
    this._ctx = ctx;
    this._canvas = canvas;
    ctx.lineWidth = 1;
    ctx.strokeStyle = this.color;
    ctx.strokeRect(
      0,
      Math.round(canvas.height * (this.marker.line / this._bufferService.buffers.active.lines.length)),
      canvas.width,
      window.devicePixelRatio
    );
    this._onRender.fire(canvas);
  }

  public override dispose(): void {
    if (this._isDisposed || !this._canvas || !this._ctx) {
      return;
    }
    this._ctx.clearRect(
      0,
      Math.round(this._canvas.height * (this.marker.line / this._bufferService.buffers.active.lines.length)),
      this._canvas.width,
      window.devicePixelRatio
    );
    this.isDisposed = true;
    this._onDispose.fire();
    super.dispose();
  }
}
