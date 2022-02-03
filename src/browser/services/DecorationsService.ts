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
import { IBufferDecorationOptions, IDecoration, IMarker } from 'xterm';

export interface IDecorationsService extends IDisposable {
  registerDecoration(decorationOptions: IBufferDecorationOptions): IDecoration | undefined;
  refresh(): void;
  dispose(): void;
}

const enum DefaultButton {
  COLOR = '#5DA5D5'
}

export class DecorationsService extends Disposable implements IDecorationsService {
  private _decorations: BufferDecoration[] = [];
  private _animationFrame: number | undefined;
  constructor(private readonly _screenElement: HTMLElement, @IBufferService private readonly _bufferService: IBufferService, @IRenderService private readonly _renderService: IRenderService) {
    super();
  }
  public registerDecoration(decorationOptions: IBufferDecorationOptions): IDecoration | undefined {
    if (decorationOptions.marker.isDisposed) {
      return undefined;
    }
    this._resolveDimensions(decorationOptions);
    const bufferDecoration = new BufferDecoration(decorationOptions, this._screenElement, this._renderService);
    this._decorations.push(bufferDecoration);
    return bufferDecoration;
  }

  public refresh(): void {
    if (this._animationFrame) {
      return;
    }

    this._animationFrame = window.requestAnimationFrame(() => this._refresh());
  }

  private _refresh(): void {
    for (const decoration of this._decorations) {
      const adjustedLine = decoration.marker.line - this._bufferService.buffers.active.ydisp;
      if (adjustedLine  < 0 || adjustedLine > this._bufferService.rows) {
        console.log('hide', decoration.id, decoration.marker.line,this._bufferService.buffers.active.ydisp, this._bufferService.rows);
        decoration.element.style.display = 'none';
      } else {
        console.log('make visible', decoration.id, adjustedLine*this._renderService.dimensions.scaledCharHeight);
        decoration.element.style.top = `${(adjustedLine)*this._renderService.dimensions.scaledCellHeight}px`;
        decoration.element.style.display = 'block';
      }
    }
    this._animationFrame = undefined;
  }

  private _resolveDimensions(decorationOptions: IBufferDecorationOptions): void {
    if (this._renderService.dimensions.scaledCellWidth) {
      decorationOptions.width = decorationOptions.width ? decorationOptions.width * this._renderService.dimensions.scaledCellWidth : this._renderService.dimensions.scaledCellWidth;
    } else {
      throw new Error('unknown cell width');
    }

    if (this._renderService.dimensions.scaledCellHeight) {
      decorationOptions.height = decorationOptions.height ? decorationOptions.height * this._renderService.dimensions.scaledCellHeight : this._renderService.dimensions.scaledCellHeight;
    } else {
      throw new Error('unknown cell height');
    }
  }

  public dispose(): void {
    if (this._animationFrame) {
      window.cancelAnimationFrame(this._animationFrame);
      this._animationFrame = undefined;
    }
  }
}

export const IDecorationsService = createDecorator<IDecorationsService>('DecorationsService');
class BufferDecoration extends Disposable implements IDecoration {
  private static _nextId = 1;
  private _marker: IMarker;
  private _element: HTMLElement | undefined;
  private _id: number = BufferDecoration._nextId++;
  public isDisposed: boolean = false;

  public get id(): number { return this._id; }
  public get element(): HTMLElement { return this._element!; }
  public get marker(): IMarker { return this._marker; }

  private _onDispose = new EventEmitter<void>();
  public get onDispose(): IEvent<void> { return this._onDispose.event; }

  private _onRender = new EventEmitter<HTMLElement>();
  public get onRender(): IEvent<HTMLElement> { return this._onRender.event; }

  constructor(
    private readonly _decorationOptions: IBufferDecorationOptions,
    private readonly _screenElement: HTMLElement,
    private readonly _renderService: IRenderService
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
    this.isDisposed = true;
    this._marker.dispose();
    // Emit before super.dispose such that dispose listeners get a change to react
    this._onDispose.fire();
    super.dispose();
  }

  private _createElement(): void {
    this._element = document.createElement('div');
    this._element.classList.add('xterm-decoration');
    this._element.style.width = `${this._decorationOptions.width}px`;
    this._element.style.height = `${this._decorationOptions.height}px`;
    this._element.style.top = `${this._marker.line * this._renderService.dimensions.scaledCellHeight}px`;
    this._element.style.zIndex = '6';
    this._element.style.position = 'absolute';
    if (this._decorationOptions.x && this._decorationOptions.x < 0) {
      throw new Error(`cannot create a decoration with a negative x offset: ${this._decorationOptions.x}`);
    }
    if (this._decorationOptions.anchor === 'right') {
      this._element.style.right = this._decorationOptions.x ? `${this._decorationOptions.x * this._renderService.dimensions.scaledCellWidth}px` : '';
    } else {
      this._element.style.left = this._decorationOptions.x ? `${this._decorationOptions.x * this._renderService.dimensions.scaledCellWidth}px` : '';
    }
  }

  private _render(): void {
    if (this._screenElement && this._element) {
      this._screenElement.append(this._element);
      this._onRender.fire(this._element);
    }
  }
}
