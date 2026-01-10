/**
 * Copyright (c) 2025 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IKeyboardService } from 'browser/services/Services';
import { evaluateKeyboardEvent } from 'common/input/Keyboard';
import { evaluateKeyboardEventKitty, KittyKeyboardEventType, shouldUseKittyProtocol } from 'common/input/KittyKeyboard';
import { isMac } from 'common/Platform';
import { ICoreService, IOptionsService } from 'common/services/Services';
import { IKeyboardResult } from 'common/Types';

export class KeyboardService implements IKeyboardService {
  public serviceBrand: undefined;

  constructor(
    @ICoreService private readonly _coreService: ICoreService,
    @IOptionsService private readonly _optionsService: IOptionsService
  ) {
  }

  public evaluateKeyDown(event: KeyboardEvent): IKeyboardResult {
    const kittyFlags = this._coreService.kittyKeyboard.flags;
    return this.useKitty
      ? evaluateKeyboardEventKitty(event, kittyFlags, event.repeat ? KittyKeyboardEventType.REPEAT : KittyKeyboardEventType.PRESS)
      : evaluateKeyboardEvent(event, this._coreService.decPrivateModes.applicationCursorKeys, isMac, this._optionsService.rawOptions.macOptionIsMeta);
  }

  public evaluateKeyUp(event: KeyboardEvent): IKeyboardResult | undefined {
    const kittyFlags = this._coreService.kittyKeyboard.flags;
    if (this.useKitty && (kittyFlags & 0b10)) { // REPORT_EVENT_TYPES flag
      return evaluateKeyboardEventKitty(event, kittyFlags, KittyKeyboardEventType.RELEASE);
    }
    return undefined;
  }

  public get useKitty(): boolean {
    const kittyFlags = this._coreService.kittyKeyboard.flags;
    return !!(this._optionsService.rawOptions.vtExtensions?.kittyKeyboard && shouldUseKittyProtocol(kittyFlags));
  }
}
