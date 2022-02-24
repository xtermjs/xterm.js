/**
 * Copyright (c) 2022 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IDecorationService, IRenderService } from 'browser/services/Services';
import { EventEmitter, IEvent } from 'common/EventEmitter';
import { Disposable } from 'common/Lifecycle';
import { IBufferService, IInstantiationService } from 'common/services/Services';
import { IDecorationOptions, IDecoration, IMarker } from 'xterm';

export class DecorationService extends Disposable implements IDecorationService {

  private readonly _decorations: Decoration[] = [];
  private _container: HTMLElement | undefined;
  private _screenElement: HTMLElement | undefined;
  private _renderService: IRenderService | undefined;
  private _animationFrame: number | undefined;

  constructor(@IInstantiationService private readonly _instantiationService: IInstantiationService) { super(); }

  public attachToDom(screenElement: HTMLElement, renderService: IRenderService): void {
    this._renderService = renderService;
    this._screenElement = screenElement;
    this._container = document.createElement('div');
    this._container.classList.add('xterm-decoration-container');
    screenElement.appendChild(this._container);
    this.register(this._renderService.onRenderedBufferChange(() => this.refresh()));
    this.register(this._renderService.onDimensionsChange(() => this.refresh(true)));
  }

  public registerDecoration(decorationOptions: IDecorationOptions): IDecoration | undefined {
    if (decorationOptions.marker.isDisposed || !this._container) {
      return undefined;
    }
    const decoration = this._instantiationService.createInstance(Decoration, decorationOptions, this._container);
    this._decorations.push(decoration);
    decoration.onDispose(() => this._decorations.splice(this._decorations.indexOf(decoration), 1));
    this._queueRefresh();
    return decoration;
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
    if (!this._renderService) {
      return;
    }
    for (const decoration of this._decorations) {
      decoration.render(this._renderService, shouldRecreate);
    }
  }

  public dispose(): void {
    for (const decoration of this._decorations) {
      decoration.dispose();
    }
    if (this._screenElement && this._container && this._screenElement.contains(this._container)) {
      this._screenElement.removeChild(this._container);
    }
  }
}
export class Decoration extends Disposable implements IDecoration {
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
