/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { addDisposableDomListener } from 'browser/Lifecycle';
import { IDecorationService, IRenderService } from 'browser/services/Services';
import { IEvent, EventEmitter } from 'common/EventEmitter';
import { Disposable } from 'common/Lifecycle';
import { IBufferService } from 'common/services/Services';
import { IMarker } from 'common/Types';
import { IDecoration, IDecorationOptions } from 'xterm';

export interface IDecorationRenderer {
  refreshDecorations(shouldRecreate?: boolean): void;
  renderDecoration(decoration: IDecoration, decorationOptions: IDecorationOptions): void;
}

export class BufferDecorationRenderer extends Disposable implements IDecorationRenderer {
  private _decorationContainer: HTMLElement;
  private readonly _decorations: BufferDecoration[] = [];
  private _altBufferIsActive: boolean = false;

  constructor(
    @IBufferService private readonly _bufferService: IBufferService,
    @IRenderService private readonly _renderService: IRenderService,
    private readonly _decorationService: IDecorationService,
    private readonly _screenElement: HTMLElement) {
    super();
    this._decorationContainer = document.createElement('div');
    this._decorationContainer.classList.add('xterm-decoration-container');
    this._screenElement.appendChild(this._decorationContainer);
    this.register(this._renderService.onRenderedBufferChange(() => this.refreshDecorations()));
    this.register(this._renderService.onDimensionsChange(() => this.refreshDecorations()));
    this.register(addDisposableDomListener(window, 'resize', () => this.refreshDecorations()));
    this.register(this._bufferService.buffers.onBufferActivate(() => {
      this._altBufferIsActive = this._bufferService.buffer === this._bufferService.buffers.alt;
    }));
    this.register(this._decorationService.onDecorationRegistered(options => this.renderDecoration(options)));
  }
  public refreshDecorations(shouldRecreate?: boolean): void {
    if (!this._renderService) {
      return;
    }
    for (const decoration of this._decorations) {
      decoration.render(this._decorationContainer, this._renderService, shouldRecreate);
    }
  }

  public renderDecoration(decorationOptions: IDecorationOptions): void {
    const decoration = new BufferDecoration(this._bufferService, decorationOptions);
    if (this._decorationContainer && decoration.element && !this._decorationContainer.contains(decoration.element)) {
      this._decorationContainer.append(decoration.element);
    }
    (decoration as BufferDecoration).render(this._decorationContainer, this._renderService, true);
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
}
export class BufferDecoration extends Disposable implements IDecoration {
  private readonly _marker: IMarker;
  private _element: HTMLElement | undefined;
  private _container: HTMLElement | undefined;
  private _altBufferIsActive: boolean = false;

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
    private readonly _bufferService: IBufferService,
    options: IDecorationOptions
  ) {
    super();
    this.x = options.x ?? 0;
    this._marker = options.marker;
    this._marker.onDispose(() => this.dispose());
    this.anchor = options.anchor || 'left';
    this.width = options.width || 1;
    this.height = options.height || 1;
  }

  public render(container: HTMLElement, renderService: IRenderService, shouldRecreate?: boolean): void {
    this._container = container;
    if (!this._element || shouldRecreate) {
      this._createElement(renderService, shouldRecreate);
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

