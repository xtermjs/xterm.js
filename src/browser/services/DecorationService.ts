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
  private _screenElement: HTMLElement | undefined;

  constructor(
    @IBufferService private readonly _bufferService: IBufferService,
    @IRenderService private readonly _renderService: IRenderService,
    @IInstantiationService private readonly _instantiationService: IInstantiationService
  ) {
    super();
    this.register(this._renderService.onRenderedBufferChange(() => this.refresh()));
  }

  public attachToDom(screenElement: HTMLElement): void {
    this._screenElement = screenElement;
  }

  public registerDecoration(decorationOptions: IDecorationOptions): IDecoration | undefined {
    if (decorationOptions.marker.isDisposed || !this._screenElement) {
      return undefined;
    }
    const decoration = this._instantiationService.createInstance(Decoration, decorationOptions, this._screenElement);
    this._decorations.push(decoration);
    decoration.onDispose(() => this._decorations.splice(this._decorations.indexOf(decoration), 1));
    return decoration;
  }

  public refresh(): void {
    for (const decoration of this._decorations) {
      if (!decoration.element) {
        continue;
      }
      const line = decoration.marker.line - this._bufferService.buffers.active.ydisp;
      if (line < 0 || line > this._bufferService.rows) {
        // outside of viewport
        decoration.element.style.display = 'none';
      } else {
        decoration.element.style.top = `${line * this._renderService.dimensions.scaledCellHeight}px`;
        decoration.element.style.display = 'block';
      }
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

  constructor(
    private readonly _decorationOptions: IDecorationOptions,
    private readonly _screenElement: HTMLElement,
    @IBufferService private readonly _bufferService: IBufferService,
    @IRenderService private readonly _renderService: IRenderService
  ) {
    super();
    this._marker = _decorationOptions.marker;
    if (this._marker.line - this._bufferService.buffers.active.ydisp >= 0 && this._marker.line - this._bufferService.buffers.active.ydisp < this._bufferService.rows) {
      this._render();
    }
    this.register({
      dispose: () => {
        if (this.isDisposed || !this.element) {
          return;
        }
        this._screenElement.removeChild(this.element);
        this.isDisposed = true;
        this._marker.dispose();
        // Emit before super.dispose such that dispose listeners get a change to react
        this._onDispose.fire();
        super.dispose();
      }
    });
  }

  private _createElement(): void {
    this._element = document.createElement('div');
    this._element.classList.add('xterm-decoration');
    this._resolveDimensions();
    this._element.style.width = `${this._decorationOptions.width}px`;
    this._element.style.height = `${this._decorationOptions.height}px`;
    this._element.style.top = `${(this.marker.line - this._bufferService.buffers.active.ydisp) * this._renderService.dimensions.scaledCellHeight}px`;
    if (this._decorationOptions.x && this._decorationOptions.x < 0) {
      throw new Error(`Decoration options x value cannot be negative, but was ${this._decorationOptions.x}.`);
    }

    if (this._decorationOptions.anchor === 'right') {
      this._element.style.right = this._decorationOptions.x ? `${this._decorationOptions.x * this._renderService.dimensions.scaledCellWidth}px` : '';
    } else {
      this._element.style.left = this._decorationOptions.x ? `${this._decorationOptions.x * this._renderService.dimensions.scaledCellWidth}px` : '';
    }
  }

  private _resolveDimensions(): void {
    this._decorationOptions.width = this._decorationOptions.width ? this._decorationOptions.width * this._renderService.dimensions.scaledCellWidth : this._renderService.dimensions.scaledCellWidth;
    this._decorationOptions.height = this._decorationOptions.height ? this._decorationOptions.height * this._renderService.dimensions.scaledCellHeight : this._renderService.dimensions.scaledCellHeight;
  }

  private _render(): void {
    if (!this._element) {
      this._createElement();
    }
    if (this._screenElement && this._element) {
      this._screenElement.append(this._element);
      this._onRender.fire(this._element);
    }
  }
}
