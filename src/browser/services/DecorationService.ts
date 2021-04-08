/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IRenderer, IRenderDimensions, CharacterJoinerHandler } from 'browser/renderer/Types';
import { RenderDebouncer } from 'browser/RenderDebouncer';
import { EventEmitter, IEvent } from 'common/EventEmitter';
import { Disposable } from 'common/Lifecycle';
import { ScreenDprMonitor } from 'browser/ScreenDprMonitor';
import { addDisposableDomListener } from 'browser/Lifecycle';
import { IColorSet } from 'browser/Types';
import { IOptionsService, IBufferService } from 'common/services/Services';
import { ICharSizeService, IDecorationService } from 'browser/services/Services';
import { IDecorationElement, IDecorationHandle } from 'common/Types';

interface IDecorationRegistration {
  handle: IDecorationHandle;
  element: IDecorationElement;
}


export class DecorationService extends Disposable implements IDecorationService {
  public serviceBrand: undefined;

  private _activeDecorations: IDecorationRegistration[] = [];

  constructor() {
    super();
  }

  public addDecoration(element: IDecorationElement): number {
    const registration: IDecorationRegistration = {
      handle: this._activeDecorations.length,
      element: element
    };
    this._activeDecorations[registration.handle] = registration;
    return registration.handle;
  }

  public removeDeoration(handle: IDecorationHandle): boolean {
    for (let index = 0 ; index < this._activeDecorations.length ; index++) {
      const reg = this._activeDecorations[index];
      if (reg.handle === handle) {
        this._activeDecorations.splice(index, 1);
        return true;
      }
    }
    return false;
  }

  public forEachDecoration(callback: (decoration: IDecorationElement) => boolean): void {
    for (const reg of this._activeDecorations) {
      if (callback(reg.element)) {
        return;
      }
    }
  }

  public clearDecorations(): number {
    const count = this._activeDecorations.length;
    this._activeDecorations = [];
    return count;
  }
}
