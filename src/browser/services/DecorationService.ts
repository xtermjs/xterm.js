/**
 * Copyright (c) 2022 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IDecorationService, IRenderService } from 'browser/services/Services';
import { EventEmitter, IEvent } from 'common/EventEmitter';
import { Disposable } from 'common/Lifecycle';
import { IBufferService } from 'common/services/Services';
import { IDecorationOptions, IDecoration, IMarker } from 'xterm';

export class DecorationService extends Disposable implements IDecorationService {

  private readonly _decorations: Decoration[] = [];
  private _container: HTMLElement | undefined;
  private _renderService: IRenderService | undefined;
  private _bufferService: IBufferService | undefined;

  constructor(
  ) {
    super();
  }

  public attachToDom(screenElement: HTMLElement, renderService: IRenderService, bufferService: IBufferService): void {
    this._renderService = renderService;
    this._bufferService = bufferService;
    this._container = document.createElement('div');
    this._container.classList.add('xterm-decoration-container');
    screenElement.appendChild(this._container);
    this.refresh();
    this.register(this._renderService.onRenderedBufferChange(() => this.refresh()));
  }

  public registerDecoration(decorationOptions: IDecorationOptions): IDecoration | undefined {
    if (decorationOptions.marker.isDisposed || !this._container) {
      return undefined;
    }
    const decoration = new Decoration(decorationOptions, this._container);
    this._decorations.push(decoration);
    decoration.onDispose(() => this._decorations.splice(this._decorations.indexOf(decoration), 1));
    return decoration;
  }

  public refresh(): void {
    if (!this._bufferService || !this._renderService) {
      return;
    }
    for (const decoration of this._decorations) {
      decoration.render(this._bufferService, this._renderService);
    }
  }

  public dispose(): void {
    for (const decoration of this._decorations) {
      decoration.dispose();
    }
  }
}

class Decoration extends Disposable implements IDecoration {
  private static _nextId = 1;
  private readonly _marker: IMarker;
  private _element: HTMLElement | undefined;
  private readonly _id: number = Decoration._nextId++;
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
    private readonly _container: HTMLElement
  ) {
    super();
    this.x = options.x ?? 0;
    this._marker = options.marker;
    this.anchor = options.anchor || 'left';
    this.width = options.width || 1;
    this.height = options.height || 1;
  }

  public render(bufferService: IBufferService, renderService: IRenderService): void {
    if (!this._element) {
      this._createElement(bufferService, renderService);
    }
    if (this._container && this._element && !this._container.contains(this._element)) {
      this._container.append(this._element);
    }
    this._refreshStyle(bufferService, renderService);
    this._onRender.fire(this._element!);
  }

  private _createElement(bufferService: IBufferService, renderService: IRenderService): void {
    this._element = document.createElement('div');
    this._element.classList.add('xterm-decoration');
    this._element.style.width = `${this.width * renderService.dimensions.scaledCellWidth}px`;
    this._element.style.height = `${this.height * renderService.dimensions.scaledCellHeight}px`;
    this._element.style.top = `${(this.marker.line - bufferService.buffers.active.ydisp) * renderService.dimensions.scaledCellHeight}px`;

    if (this.anchor === 'right') {
      this._element.style.right = this.x ? `${this.x * renderService.dimensions.scaledCellWidth}px` : '';
    } else {
      this._element.style.left = this.x ? `${this.x * renderService.dimensions.scaledCellWidth}px` : '';
    }
    this.register({
      dispose: () => {
        if (this.isDisposed) {
          return;
        }
        this._container.removeChild(this._element!);
        this.isDisposed = true;
        this._marker.dispose();
        // Emit before super.dispose such that dispose listeners get a change to react
        this._onDispose.fire();
        super.dispose();
      }
    });
  }

  private _refreshStyle(bufferService: IBufferService, renderService: IRenderService): void {
    const line = this.marker.line - bufferService.buffers.active.ydisp;
    if (line < 0 || line > bufferService.rows) {
      // outside of viewport
      this._element!.style.display = 'none';
    } else {
      this._element!.style.top = `${line * renderService.dimensions.scaledCellHeight}px`;
      this._element!.style.display = 'block';
    }
  }
}
