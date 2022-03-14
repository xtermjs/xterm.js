/**
 * Copyright (c) 2022 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { EventEmitter } from 'common/EventEmitter';
import { Disposable } from 'common/Lifecycle';
import { IDecorationService, IInternalDecoration } from 'common/services/Services';
import { IDecorationOptions, IDecoration, IMarker, IEvent } from 'xterm';

export class DecorationService extends Disposable implements IDecorationService {
  public serviceBrand: any;

  private readonly _decorations: IInternalDecoration[] = [];

  private _onDecorationRegistered = this.register(new EventEmitter<IInternalDecoration>());
  public get onDecorationRegistered(): IEvent<IInternalDecoration> { return this._onDecorationRegistered.event; }
  private _onDecorationRemoved = this.register(new EventEmitter<IInternalDecoration>());
  public get onDecorationRemoved(): IEvent<IInternalDecoration> { return this._onDecorationRemoved.event; }

  public get decorations(): IterableIterator<IInternalDecoration> { return this._decorations.values(); }

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
      this._onDecorationRegistered.fire(decoration);
    }
    return decoration;
  }

  public dispose(): void {
    for (const decoration of this._decorations) {
      this._onDecorationRemoved.fire(decoration);
      decoration.dispose();
    }
    this._decorations.length = 0;
  }
}

class Decoration extends Disposable implements IInternalDecoration {
  public readonly marker: IMarker;
  public element: HTMLElement | undefined;
  public isDisposed: boolean = false;

  public readonly onRenderEmitter = this.register(new EventEmitter<HTMLElement>());
  public readonly onRender = this.onRenderEmitter.event;
  private _onDispose = this.register(new EventEmitter<void>());
  public readonly onDispose = this._onDispose.event;

  constructor(
    public readonly options: IDecorationOptions
  ) {
    super();
    this.marker = options.marker;
    // TODO: Make sure dispose doesn't need to do anything else?
  }
}
