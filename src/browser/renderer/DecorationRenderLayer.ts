/**
 * Copyright (c) 2022 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { addDisposableDomListener } from 'browser/Lifecycle';
import { BaseRenderLayer } from 'browser/renderer/BaseRenderLayer';
import { IRenderDimensions, IRequestRedrawEvent } from 'browser/renderer/Types';
import { IColorSet } from 'browser/Types';
import { CellData } from 'common/buffer/CellData';
import { Marker } from 'common/buffer/Marker';
import { EventEmitter, IEventEmitter } from 'common/EventEmitter';
import { Disposable } from 'common/Lifecycle';
import { IBufferService, IOptionsService } from 'common/services/Services';
import { ICellData } from 'common/Types';
import { IBufferDecorationOptions, IDecoration, IEvent, IGutterDecorationOptions } from 'xterm';

const enum DefaultButton {
  WIDTH = 2,
  HEIGHT = 1,
  COLS = 87,
  MARGIN_RIGHT = 3,
  COLOR = '#4B9CD3'
}
export class DecorationRenderLayer extends BaseRenderLayer {
  constructor(
    container: HTMLElement,
    zIndex: number,
    colors: IColorSet,
    rendererId: number,
    private _onRequestRedraw: IEventEmitter<IRequestRedrawEvent>,
    @IBufferService bufferService: IBufferService,
    @IOptionsService optionsService: IOptionsService
  ) {
    super(container, 'decoration', zIndex, true, colors, rendererId, bufferService, optionsService);
    this.registerDecoration({ startMarker: new Marker(1), shape: 'button' });
    this._onRequestRedraw.fire({ start: this._bufferService.buffer.y, end: this._bufferService.buffer.y });
  }
  public reset(): void {

  }

  public registerDecoration(decorationOptions: IBufferDecorationOptions | IGutterDecorationOptions): IDecoration {
    if ('shape' in decorationOptions) {
      return new BufferDecoration(decorationOptions, this._ctx.canvas);
    }
    throw new Error('Gutter decoration not yet implemented');
  }
}

class BufferDecoration extends Disposable implements IDecoration {
  private static _nextId = 1;

  private _element: HTMLElement | undefined;
  private _id: number = BufferDecoration._nextId++;
  private _line: number;
  public isDisposed: boolean = false;

  public get id(): number { return this._id; }

  public get line(): number { return this._line; }

  public get element(): HTMLElement { return this._element!; }

  private _onDispose = new EventEmitter<void>();
  public get onDispose(): IEvent<void> { return this._onDispose.event; }

  private _onRender = new EventEmitter<HTMLElement>();
  public get onRender(): IEvent<HTMLElement> { return this._onRender.event; }

  constructor(
    decorationOptions: IBufferDecorationOptions,
    container: HTMLElement
  ) {
    super();
    this._line = decorationOptions.startMarker.line;
    if (decorationOptions.shape === 'button') {
      const color = decorationOptions.color || DefaultButton.COLOR;
      this._element = document.createElement('menu');
      this._element.classList.add('button-buffer-decoration');
      this._element.id = 'button-buffer-decoration-' + this._id;
      this._element.style.background = color;
      this._element.style.width = '1px';
      this._element.style.height = '32px';
      this._element.style.borderRadius = '64px';
      this._element.style.border = `4px solid white`;
      this._element.style.zIndex = '6';
      this._element.style.position = 'absolute';
      this._element.style.top = '0px';
      this._element.style.right = '5px';
      addDisposableDomListener(this._element, 'click', e => console.log('circle'));
      container.parentElement!.append(this._element);
      this._onRender.fire(this._element);
    } else {
      throw new Error('only shape that has been implemented so far is button');
    }
  }

  public dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this.isDisposed = true;
    this._line = -1;
    // Emit before super.dispose such that dispose listeners get a change to react
    this._onDispose.fire();
    super.dispose();
  }
}
