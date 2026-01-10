/**
 * Copyright (c) 2025 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IKeyboardService } from 'browser/services/Services';
import { evaluateKeyboardEvent } from 'common/input/Keyboard';
import { evaluateKeyboardEventKitty, KittyKeyboardEventType, KittyKeyboardFlags, shouldUseKittyProtocol } from 'common/input/KittyKeyboard';
import { evaluateKeyboardEventWin32 } from 'common/input/Win32InputMode';
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
    // Win32 input mode takes priority (most raw)
    if (this.useWin32) {
      return evaluateKeyboardEventWin32(event, true);
    }
    const kittyFlags = this._coreService.kittyKeyboard.flags;
    return this.useKitty
      ? evaluateKeyboardEventKitty(event, kittyFlags, event.repeat ? KittyKeyboardEventType.REPEAT : KittyKeyboardEventType.PRESS)
      : evaluateKeyboardEvent(event, this._coreService.decPrivateModes.applicationCursorKeys, isMac, this._optionsService.rawOptions.macOptionIsMeta);
  }

  public evaluateKeyUp(event: KeyboardEvent): IKeyboardResult | undefined {
    // Win32 input mode sends key up events
    if (this.useWin32) {
      return evaluateKeyboardEventWin32(event, false);
    }
    const kittyFlags = this._coreService.kittyKeyboard.flags;
    if (this.useKitty && (kittyFlags & KittyKeyboardFlags.REPORT_EVENT_TYPES)) {
      return evaluateKeyboardEventKitty(event, kittyFlags, KittyKeyboardEventType.RELEASE);
    }
    return undefined;
  }

  public get useKitty(): boolean {
    const kittyFlags = this._coreService.kittyKeyboard.flags;
    return !!(this._optionsService.rawOptions.vtExtensions?.kittyKeyboard && shouldUseKittyProtocol(kittyFlags));
  }

  public get useWin32(): boolean {
    return !!(this._optionsService.rawOptions.vtExtensions?.win32InputMode && this._coreService.decPrivateModes.win32InputMode);
  }
}
