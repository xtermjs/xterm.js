/**
 * Copyright (c) 2022 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { BaseRenderLayer } from 'browser/renderer/BaseRenderLayer';
import { IRequestRedrawEvent } from 'browser/renderer/Types';
import { IColorSet } from 'browser/Types';
import { EventEmitter, IEventEmitter } from 'common/EventEmitter';
import { Disposable } from 'common/Lifecycle';
import { IBufferService, IOptionsService } from 'common/services/Services';
import { IBufferDecorationOptions, IDecoration, IEvent, IMarker } from 'xterm';

const enum DefaultButton {
  COLOR = '#5DA5D5'
}
export class DecorationRenderLayer extends BaseRenderLayer {
  private _decorations: IDecoration[] = [];
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
    // this.registerDecoration({ startMarker: new Marker(1), shape: 'button' });
  }

  public onGridChanged(startRow: number, endRow: number): void {
    for (const decoration of this._decorations) {
      (decoration as BufferDecoration).render();
    }
  }

  public reset(): void {

  }

  public registerDecoration(decorationOptions: IBufferDecorationOptions): IDecoration | undefined {
    if (decorationOptions.marker.isDisposed) {
      return undefined;
    }
    return new BufferDecoration(decorationOptions, this._ctx.canvas);
  }
}

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
    private readonly _container: HTMLElement
  ) {
    super();

    this._marker = decorationOptions.marker;
    const color = DefaultButton.COLOR;
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
    if (decorationOptions.anchor === 'right') {
      this._element.style.right = '5px';
    } else {
      this._element.style.left = '5px';
    }
    if (this._container.parentElement && this._element) {
      this._container.parentElement.append(this._element);
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
