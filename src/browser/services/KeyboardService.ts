/**
 * Copyright (c) 2025 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IDirectionService, IKeyboardService } from 'browser/services/Services';
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
    @IOptionsService private readonly _optionsService: IOptionsService,
    @IDirectionService private readonly _directionService: IDirectionService
  ) {
  }

  public evaluateKeyDown(event: KeyboardEvent): IKeyboardResult {
    // Win32 input mode takes priority (most raw)
    if (this.useWin32InputMode) {
      return evaluateKeyboardEventWin32(event, true, this._directionService.direction);
    }
    const kittyFlags = this._coreService.kittyKeyboard.flags;
    return this.useKitty
      ? evaluateKeyboardEventKitty(event, kittyFlags, event.repeat ? KittyKeyboardEventType.REPEAT : KittyKeyboardEventType.PRESS, this._directionService.direction)
      : evaluateKeyboardEvent(event, this._coreService.decPrivateModes.applicationCursorKeys, isMac, this._optionsService.rawOptions.macOptionIsMeta, this._directionService.direction);
  }

  public evaluateKeyUp(event: KeyboardEvent): IKeyboardResult | undefined {
    // Win32 input mode sends key up events
    if (this.useWin32InputMode) {
      return evaluateKeyboardEventWin32(event, false, this._directionService.direction);
    }
    const kittyFlags = this._coreService.kittyKeyboard.flags;
    if (this.useKitty && (kittyFlags & KittyKeyboardFlags.REPORT_EVENT_TYPES)) {
      return evaluateKeyboardEventKitty(event, kittyFlags, KittyKeyboardEventType.RELEASE, this._directionService.direction);
    }
    return undefined;
  }

  public get useKitty(): boolean {
    const kittyFlags = this._coreService.kittyKeyboard.flags;
    return !!(this._optionsService.rawOptions.vtExtensions?.kittyKeyboard && shouldUseKittyProtocol(kittyFlags));
  }

  public get useWin32InputMode(): boolean {
    return !!(this._optionsService.rawOptions.vtExtensions?.win32InputMode && this._coreService.decPrivateModes.win32InputMode);
  }
}
