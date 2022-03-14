/**
 * Copyright (c) 2022 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { addDisposableDomListener } from 'browser/Lifecycle';
import { IDecorationService, IRenderService } from 'browser/services/Services';
import { EventEmitter, IEvent } from 'common/EventEmitter';
import { Disposable } from 'common/Lifecycle';
import { IBufferService, IInstantiationService } from 'common/services/Services';
import { IDecorationOptions, IDecoration, IMarker } from 'xterm';

const enum ScrollbarConstants {
  WIDTH = 7
}

interface IDecorationRenderer {
  refreshDecorations(shouldRecreate?: boolean): void;
  registerDecoration(decorationOptions: IDecorationOptions): IDecoration | undefined;
}

class BufferDecorationRenderer extends Disposable implements IDecorationRenderer {
  private _decorationContainer: HTMLElement | undefined;
  private readonly _decorations: BufferDecoration[] = [];
  private _renderService: IRenderService | undefined;

  constructor(
    @IBufferService private readonly _bufferService: IBufferService,
    private readonly _screenElement: HTMLElement) {
    super();
    this.register(this._bufferService.buffers.onBufferActivate(() => {
      // this._canvas!.style.display = this._bufferService.buffer === this._bufferService.buffers.alt ? 'none' : 'block';
    }));
  }
  public refreshDecorations(shouldRecreate?: boolean): void {
    if (!this._renderService) {
      return;
    }
    for (const decoration of this._decorations) {
      decoration.render(this._renderService, shouldRecreate);
    }
  }
  public registerDecoration(decorationOptions: IDecorationOptions): IDecoration | undefined {
    if (this._screenElement && !this._decorationContainer) {
      this._decorationContainer = document.createElement('div');
      this._decorationContainer.classList.add('xterm-decoration-container');
      this._screenElement.appendChild(this._decorationContainer);
    }
    const decoration = new BufferDecoration(this._bufferService, decorationOptions, this._decorationContainer);
    this._decorations.push(decoration);
    decoration.onDispose(() => this._decorations.splice(this._decorations.indexOf(decoration), 1));
    this.refreshDecorations();
    return decoration;
  }
  public override dispose(): void {
    if (this._screenElement && this._decorationContainer && this._screenElement.contains(this._decorationContainer)) {
      this._screenElement.removeChild(this._decorationContainer);
    }
    for (const bufferDecoration of this._decorations) {
      bufferDecoration.dispose();
    }
    super.dispose();
  }
  public attachToDom(renderService: IRenderService): void {
    this._renderService = renderService;
  }
}

class OverviewRulerRenderer extends Disposable implements IDecorationRenderer  {
  private _canvas: HTMLCanvasElement | undefined;
  private _ctx: CanvasRenderingContext2D | null = null;
  private _decorations: ScrollbarDecoration[] = [];
  private _width: number | undefined;
  private _anchor: 'right' | 'left' | undefined;
  private _x: number | undefined;

  constructor(
    @IInstantiationService private readonly _instantiationService: IInstantiationService,
    @IBufferService private readonly _bufferService: IBufferService,
    @IRenderService private readonly _renderService: IRenderService,
    private readonly _viewportElement: HTMLElement,
    private readonly _screenElement: HTMLElement
  ) {
    super();
    this.register(this._bufferService.buffers.onBufferActivate(() => {
      this._canvas!.style.display = this._bufferService.buffer === this._bufferService.buffers.alt ? 'none' : 'block';
    }));
  }
  public registerDecoration(decorationOptions: IDecorationOptions): IDecoration | undefined {
    if (!this._viewportElement.parentElement) {
      return;
    }
    if (!this._canvas) {
      this._canvas = document.createElement('canvas');
      this._canvas.classList.add('xterm-decoration-scrollbar');
      this._viewportElement.parentElement.insertBefore(this._canvas, this._viewportElement);
    }
    this._width = decorationOptions.width;
    this._anchor = decorationOptions.anchor;
    this._x = decorationOptions.x;

    if (!this._ctx) {
      this._ctx = this._canvas.getContext('2d');
      this.refreshDecorations();
    }
    const decoration = this._instantiationService.createInstance(ScrollbarDecoration, { marker: decorationOptions.marker, overviewRulerItemColor: decorationOptions.overviewRulerItemColor }, this._canvas, this._ctx!);
    decoration.onDispose(() => this._decorations.splice(this._decorations.indexOf(decoration), 1));
    this._decorations.push(decoration);
    return decoration;
  }
  public refreshDecorations(): void {
    if (!this._canvas || !this._ctx || !this._screenElement || !this._renderService) {
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
      decoration.render();
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

export class DecorationService extends Disposable implements IDecorationService {

  private _renderService: IRenderService | undefined;
  private _animationFrame: number | undefined;

  private _screenElement: HTMLElement | undefined;
  private _viewportElement: HTMLElement | undefined;

  private _overviewRulerRenderer: OverviewRulerRenderer | undefined;
  private _bufferDecorationRenderer: BufferDecorationRenderer | undefined;

  constructor(@IInstantiationService private readonly _instantiationService: IInstantiationService, @IBufferService private readonly _bufferService: IBufferService) {
    super();
  }

  public attachToDom(renderService: IRenderService, screenElement: HTMLElement, viewportElement: HTMLElement): void {
    this._renderService = renderService;
    this._screenElement = screenElement;
    this._viewportElement = viewportElement;
    this.register(this._renderService.onRenderedBufferChange(() => this._queueRefresh()));
    this.register(this._renderService.onDimensionsChange(() => this._refresh(true)));
    this.register(addDisposableDomListener(window, 'resize', () => this._queueRefresh()));
    if (!this._bufferDecorationRenderer && this._viewportElement && this._screenElement) {
      // TODO: allow registering before the viewport element exists
      this._bufferDecorationRenderer = new BufferDecorationRenderer(this._bufferService, this._screenElement);
      this._bufferDecorationRenderer.attachToDom(renderService);
    }
  }

  public registerDecoration(decorationOptions: IDecorationOptions): IDecoration | undefined {
    if (decorationOptions.marker.isDisposed || !this._renderService) {
      return undefined;
    }

    if (decorationOptions.overviewRulerItemColor && this._viewportElement && this._screenElement) {
      if (!this._overviewRulerRenderer) {
        this._overviewRulerRenderer = new OverviewRulerRenderer(this._instantiationService, this._bufferService, this._renderService, this._viewportElement, this._screenElement);
      }
      return this._overviewRulerRenderer.registerDecoration(decorationOptions);
    }
    return this._bufferDecorationRenderer?.registerDecoration(decorationOptions);
  }

  public dispose(): void {
    this._overviewRulerRenderer?.dispose();
    this._bufferDecorationRenderer?.dispose();
  }

  private _refresh(shouldRecreate?: boolean): void {
    this._bufferDecorationRenderer?.refreshDecorations(shouldRecreate);
    this._overviewRulerRenderer?.refreshDecorations();
  }

  private _queueRefresh(): void {
    if (this._animationFrame !== undefined) {
      return;
    }
    this._animationFrame = window.requestAnimationFrame(() => {
      this._refresh();
      this._animationFrame = undefined;
    });
  }
}

export class ScrollbarDecoration extends Disposable implements IDecoration {
  private readonly _marker: IMarker;
  private _element: HTMLCanvasElement | undefined;
  private _color: string | undefined;

  public isDisposed: boolean = false;

  public get element(): HTMLCanvasElement { return this._element!; }
  public get marker(): IMarker { return this._marker; }
  public get color(): string { return this._color!; }

  private _onDispose = new EventEmitter<void>();
  public get onDispose(): IEvent<void> { return this._onDispose.event; }

  private _onRender = new EventEmitter<HTMLElement>();
  public get onRender(): IEvent<HTMLElement> { return this._onRender.event; }

  constructor(
    options: IDecorationOptions,
    private readonly _canvas: HTMLCanvasElement,
    private readonly _ctx: CanvasRenderingContext2D,
    @IBufferService private readonly _bufferService: IBufferService
  ) {
    super();
    this._marker = options.marker;
    this._color = options.overviewRulerItemColor;
    this._marker.onDispose(() => this.dispose());
    this.render();
  }
  public render(): void {
    if (!this._element) {
      this._element = this._canvas;
    }
    this._ctx.lineWidth = 1;
    this._ctx.strokeStyle = this.color;
    this._ctx.strokeRect(
      0,
      this.element.height * (this.marker.line / this._bufferService.buffers.active.lines.length),
      this.element.width,
      window.devicePixelRatio
    );
    this._onRender.fire(this.element);
  }

  public override dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._ctx.clearRect(
      0,
      this.element.height * (this.marker.line / this._bufferService.buffers.active.lines.length),
      this.element.width,
      window.devicePixelRatio
    );
    this.isDisposed = true;
    this._onDispose.fire();
    super.dispose();
  }
}

export class BufferDecoration extends Disposable implements IDecoration {
  private readonly _marker: IMarker;
  private _element: HTMLElement | undefined;

  public isDisposed: boolean = false;

  public get element(): HTMLElement | undefined { return this._element; }
  public get marker(): IMarker { return this._marker; }

  private _onDispose = new EventEmitter<void>();
  public get onDispose(): IEvent<void> { return this._onDispose.event; }

  private _onRender = new EventEmitter<HTMLElement>();
  public get onRender(): IEvent<HTMLElement> { return this._onRender.event; }

  private _altBufferIsActive: boolean = false;

  public x: number;
  public anchor: 'left' | 'right';
  public width: number;
  public height: number;

  constructor(
    private readonly _bufferService: IBufferService,
    options: IDecorationOptions,
    private readonly _container?: HTMLElement
  ) {
    super();
    this.x = options.x ?? 0;
    this._marker = options.marker;
    this._marker.onDispose(() => this.dispose());
    this.anchor = options.anchor || 'left';
    this.width = options.width || 1;
    this.height = options.height || 1;
    this.register(this._bufferService.buffers.onBufferActivate(() => {
      this._altBufferIsActive = this._bufferService.buffer === this._bufferService.buffers.alt;
    }));
  }

  public render(renderService: IRenderService, shouldRecreate?: boolean): void {
    if (!this._element || shouldRecreate) {
      this._createElement(renderService, shouldRecreate);
    }
    if (this._container && this._element && !this._container.contains(this._element)) {
      this._container.append(this._element);
    }
    this._refreshStyle(renderService);
    if (this._element) {
      this._onRender.fire(this._element);
    }
  }

  private _createElement(renderService: IRenderService, shouldRecreate?: boolean): void {
    if (shouldRecreate && this._element && this._container && this._container.contains(this._element)) {
      this._container.removeChild(this._element);
    }
    this._element = document.createElement('div');
    this._element.classList.add('xterm-decoration');
    this._element.style.width = `${this.width * renderService.dimensions.actualCellWidth}px`;
    this._element.style.height = `${this.height * renderService.dimensions.actualCellHeight}px`;
    this._element.style.top = `${(this.marker.line - this._bufferService.buffers.active.ydisp) * renderService.dimensions.actualCellHeight}px`;
    this._element.style.lineHeight = `${renderService.dimensions.actualCellHeight}px`;

    if (this.x && this.x > this._bufferService.cols) {
      // exceeded the container width, so hide
      this._element.style.display = 'none';
    }
    if (this.anchor === 'right') {
      this._element.style.right = this.x ? `${this.x * renderService.dimensions.actualCellWidth}px` : '';
    } else {
      this._element.style.left = this.x ? `${this.x * renderService.dimensions.actualCellWidth}px` : '';
    }
  }

  private _refreshStyle(renderService: IRenderService): void {
    if (!this._element) {
      return;
    }
    const line = this.marker.line - this._bufferService.buffers.active.ydisp;
    if (line < 0 || line > this._bufferService.rows) {
      // outside of viewport
      this._element.style.display = 'none';
    } else {
      this._element.style.top = `${line * renderService.dimensions.actualCellHeight}px`;
      this._element.style.display = this._altBufferIsActive ? 'none' : 'block';
    }
  }

  public override dispose(): void {
    if (this.isDisposed || !this._container) {
      return;
    }
    if (this._element && this._container.contains(this._element)) {
      this._container.removeChild(this._element);
    }
    this.isDisposed = true;
    this._onDispose.fire();
  }
}
