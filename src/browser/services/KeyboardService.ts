/**
 * Copyright (c) 2025 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IKeyboardService } from 'browser/services/Services';
import { evaluateKeyboardEvent } from 'common/input/Keyboard';
import { KittyKeyboard, KittyKeyboardEventType, KittyKeyboardFlags } from 'common/input/KittyKeyboard';
import { Win32InputMode } from 'common/input/Win32InputMode';
import { isMac } from 'common/Platform';
import { ICoreService, IOptionsService } from 'common/services/Services';
import { IKeyboardResult } from 'common/Types';

export class KeyboardService implements IKeyboardService {
  public serviceBrand: undefined;

  private _win32InputMode: Win32InputMode | undefined;
  private _kittyKeyboard: KittyKeyboard | undefined;

  constructor(
    @ICoreService private readonly _coreService: ICoreService,
    @IOptionsService private readonly _optionsService: IOptionsService
  ) {
  }

  private _getWin32InputMode(): Win32InputMode {
    this._win32InputMode ??= new Win32InputMode();
    return this._win32InputMode;
  }

  private _getKittyKeyboard(): KittyKeyboard {
    this._kittyKeyboard ??= new KittyKeyboard();
    return this._kittyKeyboard;
  }

  public evaluateKeyDown(event: KeyboardEvent): IKeyboardResult {
    // Win32 input mode takes priority (most raw)
    if (this.useWin32InputMode) {
      return this._getWin32InputMode().evaluateKeyboardEvent(event, true);
    }
    const kittyFlags = this._coreService.kittyKeyboard.flags;
    return this.useKitty
      ? this._getKittyKeyboard().evaluate(event, kittyFlags, event.repeat ? KittyKeyboardEventType.REPEAT : KittyKeyboardEventType.PRESS)
      : evaluateKeyboardEvent(event, this._coreService.decPrivateModes.applicationCursorKeys, isMac, this._optionsService.rawOptions.macOptionIsMeta);
  }

  public evaluateKeyUp(event: KeyboardEvent): IKeyboardResult | undefined {
    // Win32 input mode sends key up events
    if (this.useWin32InputMode) {
      return this._getWin32InputMode().evaluateKeyboardEvent(event, false);
    }
    const kittyFlags = this._coreService.kittyKeyboard.flags;
    if (this.useKitty && (kittyFlags & KittyKeyboardFlags.REPORT_EVENT_TYPES)) {
      return this._getKittyKeyboard().evaluate(event, kittyFlags, KittyKeyboardEventType.RELEASE);
    }
    return undefined;
  }

  public get useKitty(): boolean {
    const kittyFlags = this._coreService.kittyKeyboard.flags;
    return !!(this._optionsService.rawOptions.vtExtensions?.kittyKeyboard && KittyKeyboard.shouldUseProtocol(kittyFlags));
  }

  public get useWin32InputMode(): boolean {
    return !!(this._optionsService.rawOptions.vtExtensions?.win32InputMode && this._coreService.decPrivateModes.win32InputMode);
  }
}
