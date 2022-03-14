/**
 * Copyright (c) 2022 The xterm.js authors. All rights reserved.
 * @license MIT
 */


import { EventEmitter } from 'common/EventEmitter';
import { Disposable } from 'common/Lifecycle';
import { IDecorationService } from 'common/services/Services';
import { IDecorationOptions, IDecoration, IMarker, IEvent } from 'xterm';

export class DecorationService extends Disposable implements IDecorationService {
  private _animationFrame: number | undefined;
  private _onDecorationRegistered = this.register(new EventEmitter<IDecorationOptions>());
  public get onDecorationRegistered(): IEvent<IDecorationOptions> { return this._onDecorationRegistered.event; }
  private _onDecorationRemoved = this.register(new EventEmitter<IDecoration>());
  public get onDecorationRemoved(): IEvent<IDecoration> { return this._onDecorationRemoved.event; }
  private _decorations: IDecoration[] = [];

  constructor() {
    super();
  }

  public registerDecoration(options: IDecorationOptions): IDecoration | undefined {
    if (options.marker.isDisposed) {
      return undefined;
    }
    const decoration = new Decoration(options);
    if (decoration) {
      decoration.onDispose(() => {
        if (decoration) {
          this._decorations.splice(this._decorations.indexOf(decoration), 1);
        }
      });
      this._decorations.push(decoration);
      this._onDecorationRegistered.fire(options);
    }
    return decoration;
  }

  public dispose(): void {
    for (const decoration of this._decorations) {
      this._onDecorationRemoved.fire(decoration);
      decoration.dispose();
    }
    this._decorations = [];
  }

  private _queueRefresh(): void {
    if (this._animationFrame !== undefined) {
      return;
    }
    this._animationFrame = window.requestAnimationFrame(() => {
      // this._refresh();
      this._animationFrame = undefined;
    });
  }
}

class Decoration implements IDecoration {
  public marker: IMarker;
  private _onRender = new EventEmitter<HTMLElement>();
  public get onRender(): IEvent<HTMLElement> { return this._onRender.event; }
  private _onDispose = new EventEmitter<void>();
  public get onDispose(): IEvent<void> { return this._onDispose.event; }
  public element: HTMLElement | undefined;
  public isDisposed: boolean = false;
  public dispose(): void {
    throw new Error('Method not implemented.');
  }
  constructor(decorationOptions: IDecorationOptions) {
    this.marker = decorationOptions?.marker;
    this.element = undefined;
  }
}
