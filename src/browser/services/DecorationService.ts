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

export class DecorationService extends Disposable implements IDecorationService {

  private _container: HTMLElement | undefined;
  private _screenElement: HTMLElement | undefined;
  private _viewportElement: HTMLElement | undefined;
  private _renderService: IRenderService | undefined;
  private _animationFrame: number | undefined;

  private readonly _bufferDecorations: BufferDecoration[] = [];

  private _scrollbarDecorationCanvas: CanvasRenderingContext2D | null = null;
  private _scrollbarDecorationNode: HTMLCanvasElement | undefined;
  private _scrollbarDecorations:  { marker: IMarker, color?: string}[] = [];

  constructor(@IInstantiationService private readonly _instantiationService: IInstantiationService, @IBufferService private readonly _bufferService: IBufferService) { super(); }

  public attachToDom(scrollbarDecorationNode: HTMLCanvasElement, screenElement: HTMLElement, viewportElement: HTMLElement, renderService: IRenderService): void {
    this._renderService = renderService;
    this._screenElement = screenElement;
    this._viewportElement = viewportElement;
    this._scrollbarDecorationNode = scrollbarDecorationNode;
    this._container = document.createElement('div');
    this._container.classList.add('xterm-decoration-container');
    screenElement.appendChild(this._container);
    this.register(this._renderService.onRenderedBufferChange(() => this.refresh()));
    this.register(this._renderService.onDimensionsChange(() => this.refresh(true)));
    this.register(addDisposableDomListener(window, 'resize', () => this._refreshScollbarDecorations()));
  }

  public registerDecoration(decorationOptions: IDecorationOptions): IDecoration | undefined {
    if (decorationOptions.marker.isDisposed || !this._container || !this._scrollbarDecorationNode) {
      return undefined;
    }
    if (decorationOptions.scrollbarDecorationColor) {
      if (!this._scrollbarDecorationCanvas) {
        this._scrollbarDecorationCanvas = this._scrollbarDecorationNode.getContext('2d');
      }
      this._refreshScollbarDecorations();
      return this._registerScrollbarDecoration(decorationOptions.marker, decorationOptions.scrollbarDecorationColor);
    }
    const bufferDecoration = this._instantiationService.createInstance(BufferDecoration, decorationOptions, this._container);
    this._bufferDecorations.push(bufferDecoration);
    bufferDecoration.onDispose(() => this._bufferDecorations.splice(this._bufferDecorations.indexOf(bufferDecoration), 1));
    this._queueRefresh();
    return bufferDecoration;
  }

  private _queueRefresh(): void {
    if (this._animationFrame !== undefined) {
      return;
    }
    this._animationFrame = window.requestAnimationFrame(() => {
      this.refresh();
      this._animationFrame = undefined;
    });
  }

  public refresh(shouldRecreate?: boolean): void {
    this._refreshBufferDecorations(shouldRecreate);
    this._refreshScollbarDecorations();
  }

  public dispose(): void {
    for (const bufferDecoration of this._bufferDecorations) {
      bufferDecoration.dispose();
    }
    if (this._screenElement && this._container && this._screenElement.contains(this._container)) {
      this._screenElement.removeChild(this._container);
    }
    this._scrollbarDecorations = [];
    this._scrollbarDecorationNode?.remove();
  }

  private _registerScrollbarDecoration(marker: IMarker, color?: string): IDecoration | undefined {
    this._scrollbarDecorations.push({ marker, color });
    return this._addScrollbarDecoration(marker, color);
  }

  private _refreshBufferDecorations(shouldRecreate?: boolean): void {
    if (!this._renderService) {
      return;
    }
    for (const bufferDecoration of this._bufferDecorations) {
      bufferDecoration.render(this._renderService, shouldRecreate);
    }
  }

  private _refreshScollbarDecorations(): void {
    if (!this._scrollbarDecorationCanvas || !this._viewportElement || !this._scrollbarDecorationNode) {
      return;
    }
    this._scrollbarDecorationNode.style.width = '7px';
    this._scrollbarDecorationNode.style.height = `${this._viewportElement.clientHeight}px`;
    this._scrollbarDecorationNode.width = Math.floor(7*window.devicePixelRatio);
    this._scrollbarDecorationNode.height = Math.floor(this._viewportElement.clientHeight*window.devicePixelRatio);
    this._scrollbarDecorationCanvas.clearRect(0, 0, this._scrollbarDecorationCanvas.canvas.width, this._scrollbarDecorationCanvas.canvas.height);
    for (const scrollbarDecoration of this._scrollbarDecorations) {
      this._addScrollbarDecoration(scrollbarDecoration.marker, scrollbarDecoration.color);
    }
  }

  private _addScrollbarDecoration(marker: IMarker, color?: string): IDecoration | undefined {
    if (!this._scrollbarDecorationCanvas || !this._viewportElement?.clientHeight) {
      return;
    }
    this._scrollbarDecorationCanvas.lineWidth = 1;
    if (color) {
      this._scrollbarDecorationCanvas.strokeStyle = color;
    }
    this._scrollbarDecorationCanvas.strokeRect(
      0,
      (marker.line / this._bufferService.buffers.active.lines.length) * Math.floor(this._viewportElement.clientHeight * window.devicePixelRatio),
      Math.floor(7 * window.devicePixelRatio),
      window.devicePixelRatio
    );
    if (this._scrollbarDecorationNode) {
      const scrollbarDecoration = new ScrollbarDecoration({ marker, scrollbarDecorationColor: color }, this._scrollbarDecorationNode);
      scrollbarDecoration.onDispose(() => this._scrollbarDecorationCanvas?.clearRect(0, 0, this._scrollbarDecorationCanvas.canvas.width, this._scrollbarDecorationCanvas.canvas.height));
    }
    return undefined;
  }
}
export class ScrollbarDecoration extends Disposable implements IDecoration {
  private readonly _marker: IMarker;
  private _element: HTMLElement | undefined;

  public isDisposed: boolean = false;

  public get element(): HTMLElement | undefined { return this._element; }
  public get marker(): IMarker { return this._marker; }

  private _onDispose = new EventEmitter<void>();
  public get onDispose(): IEvent<void> { return this._onDispose.event; }

  private _onRender = new EventEmitter<HTMLElement>();
  public get onRender(): IEvent<HTMLElement> { return this._onRender.event; }

  constructor(
    options: IDecorationOptions,
    element: HTMLCanvasElement
  ) {
    super();
    this._marker = options.marker;
    this._element = element;
    this._marker.onDispose(() => this.dispose());
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

  public x: number;
  public anchor: 'left' | 'right';
  public width: number;
  public height: number;

  constructor(
    options: IDecorationOptions,
    private readonly _container: HTMLElement,
    @IBufferService private readonly _bufferService: IBufferService
  ) {
    super();
    this.x = options.x ?? 0;
    this._marker = options.marker;
    this._marker.onDispose(() => this.dispose());
    this.anchor = options.anchor || 'left';
    this.width = options.width || 1;
    this.height = options.height || 1;
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
    if (shouldRecreate && this._element && this._container.contains(this._element)) {
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
      this._element.style.display = this._bufferService.buffer === this._bufferService.buffers.alt ? 'none' : 'block';
    }
  }

  public override dispose(): void {
    if (this.isDisposed) {
      return;
    }
    if (this._element && this._container.contains(this._element)) {
      this._container.removeChild(this._element);
    }
    this.isDisposed = true;
    this._onDispose.fire();
  }
}
