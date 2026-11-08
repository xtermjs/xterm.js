/**
 * Copyright (c) 2025 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IKeyboardService } from './Services';
import { evaluateKeyboardEvent } from '../../common/input/Keyboard';
import { KittyKeyboard, KittyKeyboardEventType, KittyKeyboardFlags } from '../../common/input/KittyKeyboard';
import { Win32InputMode } from '../../common/input/Win32InputMode';
import { isMac } from '../../common/Platform';
import { ICoreService, IOptionsService } from '../../common/services/Services';
import { IKeyboardResult, KeyboardResultType } from '../../common/Types';

export class KeyboardService implements IKeyboardService {
  public serviceBrand: undefined;

  private _win32InputMode: Win32InputMode | undefined;
  private _kittyKeyboard: KittyKeyboard | undefined;
  private readonly _clipboardShortcutKeys = new Set<string>();

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
    const key = event.code || (event.key || '').toLowerCase();
    // Browsers may omit releases for Cmd shortcuts or when focus changes.
    if (!event.repeat) {
      this._clipboardShortcutKeys.delete(key);
    }
    // Win32 input mode takes priority (most raw)
    if (this.useWin32InputMode) {
      return this._getWin32InputMode().evaluateKeyboardEvent(event, true);
    }
    if (this.useKitty && (this._isMacClipboardShortcut(event) || this._clipboardShortcutKeys.has(key))) {
      this._clipboardShortcutKeys.add(key);
      return { type: KeyboardResultType.SEND_KEY, cancel: false, key: undefined };
    }
    const kittyFlags = this._coreService.kittyKeyboard.flags;
    return this.useKitty
      ? this._getKittyKeyboard().evaluate(event, kittyFlags, event.repeat ? KittyKeyboardEventType.REPEAT : KittyKeyboardEventType.PRESS, isMac && this._optionsService.rawOptions.macOptionIsMeta)
      : evaluateKeyboardEvent(event, this._coreService.decPrivateModes.applicationCursorKeys, isMac, this._optionsService.rawOptions.macOptionIsMeta);
  }

  public evaluateKeyUp(event: KeyboardEvent): IKeyboardResult | undefined {
    const wasClipboardShortcut = this._clipboardShortcutKeys.delete(event.code || (event.key || '').toLowerCase());
    // Win32 input mode sends key up events
    if (this.useWin32InputMode) {
      return this._getWin32InputMode().evaluateKeyboardEvent(event, false);
    }
    // Match the suppressed press even when Cmd or Shift was released first.
    if (wasClipboardShortcut) {
      return undefined;
    }
    const kittyFlags = this._coreService.kittyKeyboard.flags;
    if (this.useKitty && (kittyFlags & KittyKeyboardFlags.REPORT_EVENT_TYPES)) {
      return this._getKittyKeyboard().evaluate(event, kittyFlags, KittyKeyboardEventType.RELEASE, isMac && this._optionsService.rawOptions.macOptionIsMeta);
    }
    return undefined;
  }

  private _isMacClipboardShortcut(event: KeyboardEvent): boolean {
    // Preserve browser copy/paste on macOS when an application enables Kitty input.
    return isMac && event.metaKey && !event.ctrlKey && !event.altKey &&
      (event.key === 'c' || event.key === 'C' || event.key === 'v' || event.key === 'V');
  }

  public get useKitty(): boolean {
    const kittyFlags = this._coreService.kittyKeyboard.flags;
    return !!(this._optionsService.rawOptions.vtExtensions?.kittyKeyboard && KittyKeyboard.shouldUseProtocol(kittyFlags));
  }

  public get useWin32InputMode(): boolean {
    return !!(this._optionsService.rawOptions.vtExtensions?.win32InputMode && this._coreService.decPrivateModes.win32InputMode);
  }
}
