/**
 * Copyright (c) 2022 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { EventEmitter, IEvent } from 'common/EventEmitter';
import { Disposable } from 'common/Lifecycle';
import { createDecorator } from 'common/services/ServiceRegistry';
import { IBufferService } from 'common/services/Services';
import { IDisposable } from 'common/Types';
import { IBufferDecorationOptions, IDecoration, IMarker } from 'xterm';

export interface IDecorationsService extends IDisposable {
  registerDecoration(decorationOptions: IBufferDecorationOptions, cellWidth: number, cellHeight: number): IDecoration | undefined;
  refresh(y: number): void;
}

const enum DefaultButton {
  COLOR = '#5DA5D5'
}

export class DecorationsService extends Disposable implements IDecorationsService {
  private _decorations: BufferDecoration[] = [];
  private _cellWidth: number = 0;
  private _cellHeight: number = 0;
  constructor(private readonly _screenElement: HTMLElement, @IBufferService private readonly _bufferService: IBufferService) {
    super();
  }
  public registerDecoration(decorationOptions: IBufferDecorationOptions, cellWidth: number, cellHeight: number): IDecoration | undefined {
    if (decorationOptions.marker.isDisposed) {
      return undefined;
    }
    this._cellWidth = cellWidth;
    this._cellHeight = cellHeight;
    const bufferDecoration = new BufferDecoration(decorationOptions, this._screenElement, this._bufferService.buffers.active.y!);
    this._decorations.push(bufferDecoration);
    return bufferDecoration;
  }

  public refresh(y: number): void {
    for (const decoration of this._decorations) {
        if (decoration.marker.line < y) {
      console.log(decoration.marker.line, y);
      console.log('scrolled', y);
      console.log('y', this._bufferService.buffers.active.y);
      console.log('ybase', this._bufferService.buffers.active.ybase);
      decoration.element.style.bottom = `${(this._bufferService.buffers.active.ybase - decoration.marker.line)*this._cellHeight}px`;
      decoration.element.style.top = '';
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
    decorationOptions: IBufferDecorationOptions,
    private readonly _container: HTMLElement,
    y: number
  ) {
    super();
    this._marker = decorationOptions.marker;
    this._element = document.createElement('div');
    this._element.style.width = `${decorationOptions.width}px`;
    this._element.style.height = `${decorationOptions.height}px`;
    this._element.style.zIndex = '6';
    this._element.style.top = `${this._marker.line*decorationOptions.height!}px`;
    this._element.style.position = 'absolute';
    if (decorationOptions.anchor === 'right') {
      this._element.style.right = decorationOptions.x ? `${decorationOptions.x}px` : '5px';
    } else {
      this._element.style.left = decorationOptions.x ? `${decorationOptions.x}px` : '5px';
    }
    if (this._container && this._element) {
      this._container.append(this._element);
    }
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

  public render(): void {
    if (!this._element) {
      return;
    }
    if (this._container.parentElement && !this._container.parentElement.contains(this._element)) {
      this._container.parentElement.append(this._element);
    }
    this._onRender.fire(this._element);
  }
}
