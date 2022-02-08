/**
 * Copyright (c) 2022 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IRenderService } from 'browser/services/Services';
import { EventEmitter, IEvent } from 'common/EventEmitter';
import { Disposable } from 'common/Lifecycle';
import { createDecorator } from 'common/services/ServiceRegistry';
import { IBufferService } from 'common/services/Services';
import { IDisposable } from 'common/Types';
import { IDecorationOptions, IDecoration, IMarker } from 'xterm';

export interface IDecorationService extends IDisposable {
  registerDecoration(decorationOptions: IDecorationOptions): IDecoration | undefined;
  refresh(): void;
  dispose(): void;
}

export class DecorationService extends Disposable implements IDecorationService {

  private _decorations: Decoration[] = [];

  constructor(
    private readonly _screenElement: HTMLElement,
    @IBufferService private readonly _bufferService: IBufferService,
    @IRenderService private readonly _renderService: IRenderService
  ) {
    super();
    this.register(this._renderService.onRenderedBufferChange(() => this.refresh()));
  }

  public registerDecoration(decorationOptions: IDecorationOptions): IDecoration | undefined {
    if (decorationOptions.marker.isDisposed) {
      return undefined;
    }
    const decoration = new Decoration(decorationOptions, this._screenElement, this._renderService, this._bufferService);
    this._decorations.push(decoration);
    return decoration;
  }

  public refresh(): void {
    for (const decoration of this._decorations) {
      if ((decoration.marker.line - this._bufferService.buffers.active.ydisp) < 0 || (decoration.marker.line - this._bufferService.buffers.active.ydisp) > this._bufferService.rows) {
        // outside of viewport
        decoration.element.style.display = 'none';
      } else {
        decoration.element.style.top = `${(decoration.marker.line - this._bufferService.buffers.active.ydisp) * this._renderService.dimensions.scaledCellHeight}px`;
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

export const IDecorationService = createDecorator<IDecorationService>('DecorationService');
class Decoration extends Disposable implements IDecoration {
  private static _nextId = 1;
  private _marker: IMarker;
  private _element: HTMLElement | undefined;
  private _id: number = Decoration._nextId++;
  public isDisposed: boolean = false;

  public get id(): number { return this._id; }
  public get element(): HTMLElement { return this._element!; }
  public get marker(): IMarker { return this._marker; }

  private _onDispose = new EventEmitter<void>();
  public get onDispose(): IEvent<void> { return this._onDispose.event; }

  private _onRender = new EventEmitter<HTMLElement>();
  public get onRender(): IEvent<HTMLElement> { return this._onRender.event; }

  constructor(
    private readonly _decorationOptions: IDecorationOptions,
    private readonly _screenElement: HTMLElement,
    private readonly _renderService: IRenderService,
    private readonly _bufferService: IBufferService
  ) {
    super();
    this._marker = _decorationOptions.marker;
    this._createElement();
    this._render();
  }

  public dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this._screenElement.removeChild(this.element);
    this.isDisposed = true;
    this._marker.dispose();
    // Emit before super.dispose such that dispose listeners get a change to react
    this._onDispose.fire();
    super.dispose();
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
    if (!this._renderService.dimensions.scaledCellWidth || !this._renderService.dimensions.scaledCellHeight) {
      throw new Error(`Cannot resolve dimensions for decoration when scaled cell dimensions are undefined ${this._renderService.dimensions}.`);
    }
    this._decorationOptions.width = this._decorationOptions.width ? this._decorationOptions.width * this._renderService.dimensions.scaledCellWidth : this._renderService.dimensions.scaledCellWidth;
    this._decorationOptions.height = this._decorationOptions.height ? this._decorationOptions.height * this._renderService.dimensions.scaledCellHeight : this._renderService.dimensions.scaledCellHeight;
  }

  private _render(): void {
    if (this._screenElement && this._element) {
      this._screenElement.append(this._element);
      this._onRender.fire(this._element);
    }
  }
}
