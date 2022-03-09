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

export class DecorationService extends Disposable implements IDecorationService {

  private _container: HTMLElement | undefined;
  private _screenElement: HTMLElement | undefined;
  private _viewportElement: HTMLElement | undefined;
  private _renderService: IRenderService | undefined;
  private _animationFrame: number | undefined;

  private readonly _bufferDecorations: BufferDecoration[] = [];
  private _scrollDecorations: ScrollbarDecoration[] = [];

  private _scrollbarDecorationCanvas: CanvasRenderingContext2D | null = null;
  private _scrollbarDecorationNode: HTMLCanvasElement | undefined;

  constructor(@IInstantiationService private readonly _instantiationService: IInstantiationService, @IBufferService private readonly _bufferService: IBufferService) { super(); }

  public attachToDom(scrollbarDecorationNode: HTMLCanvasElement, screenElement: HTMLElement, viewportElement: HTMLElement, renderService: IRenderService): void {
    this._renderService = renderService;
    this._screenElement = screenElement;
    this._viewportElement = viewportElement;
    this._scrollbarDecorationNode = scrollbarDecorationNode;
    this._container = document.createElement('div');
    this._container.classList.add('xterm-decoration-container');
    screenElement.appendChild(this._container);
    this.register(this._renderService.onRenderedBufferChange(() => this._refresh()));
    this.register(this._renderService.onDimensionsChange(() => this._refresh(true)));
    this.register(addDisposableDomListener(window, 'resize', () => this._refreshScollbarDecorations()));
  }

  public registerDecoration(decorationOptions: IDecorationOptions): IDecoration | undefined {
    if (decorationOptions.marker.isDisposed || !this._container || !this._scrollbarDecorationNode) {
      return undefined;
    }
    if (decorationOptions.scrollbarDecorationColor) {
      return this._registerScrollbarDecoration(decorationOptions.marker, decorationOptions.scrollbarDecorationColor);
    }
    return this._registerBufferDecoration(decorationOptions);
  }

  public dispose(): void {
    for (const bufferDecoration of this._bufferDecorations) {
      bufferDecoration.dispose();
    }
    if (this._screenElement && this._container && this._screenElement.contains(this._container)) {
      this._screenElement.removeChild(this._container);
    }
    for (const scrollbarDecoration of this._scrollDecorations) {
      scrollbarDecoration.dispose();
    }
    this._scrollDecorations = [];
    this._scrollbarDecorationNode?.remove();
  }

  private _refresh(shouldRecreate?: boolean): void {
    this._refreshBufferDecorations(shouldRecreate);
    this._refreshScollbarDecorations();
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

  private _registerBufferDecoration(decorationOptions: IDecorationOptions): IDecoration | undefined {
    if (!this._container) {
      return;
    }
    const bufferDecoration = this._instantiationService.createInstance(BufferDecoration, decorationOptions, this._container);
    this._bufferDecorations.push(bufferDecoration);
    bufferDecoration.onDispose(() => this._bufferDecorations.splice(this._bufferDecorations.indexOf(bufferDecoration), 1));
    this._queueRefresh();
    return bufferDecoration;
  }

  private _registerScrollbarDecoration(marker: IMarker, color: string): IDecoration | undefined {
    if (!this._scrollbarDecorationNode || !this._viewportElement) {
      return;
    }
    if (!this._scrollbarDecorationCanvas) {
      this._scrollbarDecorationCanvas = this._scrollbarDecorationNode.getContext('2d');
      this._refreshScollbarDecorations();
    }
    const scrollbarDecoration = new ScrollbarDecoration({ marker, scrollbarDecorationColor: color }, this._scrollbarDecorationNode, this._scrollbarDecorationCanvas!, this._bufferService);
    this._scrollDecorations.push(scrollbarDecoration);
    return scrollbarDecoration;
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
    this._scrollbarDecorationNode.style.width = `${ScrollbarConstants.WIDTH}px`;
    this._scrollbarDecorationNode.style.height = `${this._viewportElement.clientHeight}px`;
    this._scrollbarDecorationNode.width = Math.floor(ScrollbarConstants.WIDTH * window.devicePixelRatio);
    this._scrollbarDecorationNode.height = Math.floor(this._viewportElement.clientHeight * window.devicePixelRatio);
    this._scrollbarDecorationCanvas.clearRect(0, 0, this._scrollbarDecorationCanvas.canvas.width, this._scrollbarDecorationCanvas.canvas.height);
    for (const decoration of this._scrollDecorations) {
      decoration.render();
    }
  }

}
export class ScrollbarDecoration extends Disposable implements IDecoration {
  private readonly _marker: IMarker;
  private _canvas: HTMLCanvasElement | undefined;
  private _color: string | undefined;

  public isDisposed: boolean = false;

  public get element(): HTMLCanvasElement { return this._canvas!; }
  public get marker(): IMarker { return this._marker; }
  public get color(): string { return this._color!; }

  private _onDispose = new EventEmitter<void>();
  public get onDispose(): IEvent<void> { return this._onDispose.event; }

  private _onRender = new EventEmitter<HTMLElement>();
  public get onRender(): IEvent<HTMLElement> { return this._onRender.event; }

  constructor(
    options: IDecorationOptions,
    canvas: HTMLCanvasElement,
    private readonly _ctx: CanvasRenderingContext2D,
    private readonly _bufferService: IBufferService
  ) {
    super();
    this._marker = options.marker;
    this._canvas = canvas;
    this._color = options.scrollbarDecorationColor;
    this._marker.onDispose(() => this.dispose());
    this.render();
  }
  public render(): void {
    this._ctx.lineWidth = 1;
    this._ctx.strokeStyle = this.color;
    this._ctx.strokeRect(
      0,
      this.element.height * (this.marker.line / this._bufferService.buffers.active.lines.length),
      this.element.width,
      window.devicePixelRatio
    );
  }

  public override dispose(): void {
    this._ctx.clearRect(0, 0, this._ctx.canvas.width, this._ctx.canvas.height);

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
