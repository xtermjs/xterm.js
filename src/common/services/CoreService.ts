/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { clone } from 'common/Clone';
import { Disposable } from 'vs/base/common/lifecycle';
import { IDecPrivateModes, IKittyKeyboardState, IModes } from 'common/Types';
import { IBufferService, ICoreService, ILogService, IOptionsService } from 'common/services/Services';
import { Emitter } from 'vs/base/common/event';

const DEFAULT_MODES: IModes = Object.freeze({
  insertMode: false
});

const DEFAULT_DEC_PRIVATE_MODES: IDecPrivateModes = Object.freeze({
  applicationCursorKeys: false,
  applicationKeypad: false,
  bracketedPasteMode: false,
  colorSchemeUpdates: false,
  cursorBlink: undefined,
  cursorStyle: undefined,
  origin: false,
  reverseWraparound: false,
  sendFocus: false,
  synchronizedOutput: false,
  win32InputMode: false,
  wraparound: true // defaults: xterm - true, vt100 - false
});

const DEFAULT_KITTY_KEYBOARD_STATE = (): IKittyKeyboardState => ({
  flags: 0,
  mainFlags: 0,
  altFlags: 0,
  mainStack: [],
  altStack: []
});

export class CoreService extends Disposable implements ICoreService {
  public serviceBrand: any;

  public isCursorInitialized: boolean;
  public isCursorHidden: boolean = false;
  public modes: IModes;
  public decPrivateModes: IDecPrivateModes;
  public kittyKeyboard: IKittyKeyboardState;

  private readonly _onData = this._register(new Emitter<string>());
  public readonly onData = this._onData.event;
  private readonly _onUserInput = this._register(new Emitter<void>());
  public readonly onUserInput = this._onUserInput.event;
  private readonly _onBinary = this._register(new Emitter<string>());
  public readonly onBinary = this._onBinary.event;
  private readonly _onRequestScrollToBottom = this._register(new Emitter<void>());
  public readonly onRequestScrollToBottom = this._onRequestScrollToBottom.event;

  constructor(
    @IBufferService private readonly _bufferService: IBufferService,
    @ILogService private readonly _logService: ILogService,
    @IOptionsService private readonly _optionsService: IOptionsService
  ) {
    super();
    this.isCursorInitialized = _optionsService.rawOptions.showCursorImmediately ?? false;
    this.modes = clone(DEFAULT_MODES);
    this.decPrivateModes = clone(DEFAULT_DEC_PRIVATE_MODES);
    this.kittyKeyboard = DEFAULT_KITTY_KEYBOARD_STATE();
  }

  public reset(): void {
    this.modes = clone(DEFAULT_MODES);
    this.decPrivateModes = clone(DEFAULT_DEC_PRIVATE_MODES);
    this.kittyKeyboard = DEFAULT_KITTY_KEYBOARD_STATE();
  }

  public triggerDataEvent(data: string, wasUserInput: boolean = false): void {
    // Prevents all events to pty process if stdin is disabled
    if (this._optionsService.rawOptions.disableStdin) {
      return;
    }

    // Input is being sent to the terminal, the terminal should focus the prompt.
    const buffer = this._bufferService.buffer;
    if (wasUserInput && this._optionsService.rawOptions.scrollOnUserInput && buffer.ybase !== buffer.ydisp) {
      this._onRequestScrollToBottom.fire();
    }

    // Fire onUserInput so listeners can react as well (eg. clear selection)
    if (wasUserInput) {
      this._onUserInput.fire();
    }

    // Fire onData API
    this._logService.debug(`sending data "${data}"`);
    this._logService.trace(`sending data (codes)`, () => data.split('').map(e => e.charCodeAt(0)));
    this._onData.fire(data);
  }

  public triggerBinaryEvent(data: string): void {
    if (this._optionsService.rawOptions.disableStdin) {
      return;
    }
    this._logService.debug(`sending binary "${data}"`);
    this._logService.trace(`sending binary (codes)`, () => data.split('').map(e => e.charCodeAt(0)));
    this._onBinary.fire(data);
  }
}
