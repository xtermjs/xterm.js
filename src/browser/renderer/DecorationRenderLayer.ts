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
  private _cell: ICellData = new CellData();
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
    this.onFocus();
  }
  public reset(): void {

  }

  public override onFocus(): void {
    this.registerDecoration({ type: 'IBufferDecorationOptions', startMarker: new Marker(1), shape: 'button'  });
    this._onRequestRedraw.fire({ start: this._bufferService.buffer.y, end: this._bufferService.buffer.y });
  }

  public override resize(dim: IRenderDimensions): void {
    super.resize(dim);
    this._clearCells(this._bufferService.cols - DefaultButton.MARGIN_RIGHT, 1, 1, 1);
    this.registerDecoration({ type: 'IBufferDecorationOptions', startMarker: new Marker(1), shape: 'button' });
    this._onRequestRedraw.fire({ start: this._bufferService.buffer.y, end: this._bufferService.buffer.y });
  }

  public registerDecoration(decorationOptions: IBufferDecorationOptions | IGutterDecorationOptions): IDecoration {
    if (decorationOptions.type === 'IBufferDecorationOptions') {
      const color = decorationOptions.color || DefaultButton.COLOR;
      const bufferDecoration = new BufferDecoration(decorationOptions.startMarker.line, color, this._ctx.canvas);
      if ('shape' in decorationOptions && decorationOptions.shape === 'button') {
        this._ctx.save();
        const x = 'position' in decorationOptions && decorationOptions.position ? decorationOptions.position : this._bufferService.cols - ((this._bufferService.cols/DefaultButton.COLS) * DefaultButton.MARGIN_RIGHT);
        this._ctx.restore();
        return bufferDecoration;
      }
      throw new Error('Border box type not yet implemented');
    } throw new Error('Gutter decoration not yet implemented');
  }
}

function getRelativeClickPosition(canvas: HTMLCanvasElement, event: MouseEvent): { x: number, y: number } {
  const rect = canvas.getBoundingClientRect();
  const y = event.clientY - rect.top;
  const x = event.clientX - rect.left;
  return { x, y };
}

export class BufferDecoration extends Disposable implements IDecoration {
  private static _nextId = 1;

  private _element: HTMLElement | undefined;
  private _id: number = BufferDecoration._nextId++;
  public isDisposed: boolean = false;

  public get id(): number { return this._id; }

  public get element(): HTMLElement { return this.element!; }

  private _onDispose = new EventEmitter<void>();
  public get onDispose(): IEvent<void> { return this._onDispose.event; }

  private _onRender = new EventEmitter<HTMLElement>();
  public get onRender(): IEvent<HTMLElement> { return this._onRender.event; }

  constructor(
    public line: number,
    color: string,
    container: HTMLElement
  ) {
    super();
    this._element = document.createElement('menu');
    this._element.classList.add('decoration');
    this._element.id = 'decoration' + this._id;
    this._element.style.background = color;
    this._element.style.width = '1px';
    this._element.style.height = '32px';
    this._element.style.borderRadius = '64px';
    this._element.style.border = `4px solid white`;
    this._element.style.zIndex = '6';
    this._element.style.position = 'absolute';
    addDisposableDomListener(this._element, 'click', e =>  console.log('circle'));
    container.parentElement!.append(this._element);
  }

  public dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this.isDisposed = true;
    this.line = -1;
    // Emit before super.dispose such that dispose listeners get a change to react
    this._onDispose.fire();
    super.dispose();
  }
}
