/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ICoreService, ILogService, IOptionsService, IBufferService } from 'common/services/Services';
import { EventEmitter, IEvent } from 'common/EventEmitter';
import { IDecPrivateModes, IModes } from 'common/Types';
import { clone } from 'common/Clone';
import { Disposable } from 'common/Lifecycle';

const DEFAULT_MODES: IModes = Object.freeze({
  insertMode: false
});

const DEFAULT_DEC_PRIVATE_MODES: IDecPrivateModes = Object.freeze({
  applicationCursorKeys: false,
  applicationKeypad: false,
  bracketedPasteMode: false,
  origin: false,
  reverseWraparound: false,
  sendFocus: false,
  wraparound: true // defaults: xterm - true, vt100 - false
});

export class CoreService extends Disposable implements ICoreService {
  public serviceBrand: any;

  public isCursorInitialized: boolean = false;
  public isCursorHidden: boolean = false;
  public modes: IModes;
  public decPrivateModes: IDecPrivateModes;

  // Circular dependency, this must be unset or memory will leak after Terminal.dispose
  private _scrollToBottom: (() => void) | undefined;

  private _onData = this.register(new EventEmitter<string>());
  public get onData(): IEvent<string> { return this._onData.event; }
  private _onUserInput = this.register(new EventEmitter<void>());
  public get onUserInput(): IEvent<void> { return this._onUserInput.event; }
  private _onBinary = this.register(new EventEmitter<string>());
  public get onBinary(): IEvent<string> { return this._onBinary.event; }

  constructor(
    // TODO: Move this into a service
    scrollToBottom: () => void,
    @IBufferService private readonly _bufferService: IBufferService,
    @ILogService private readonly _logService: ILogService,
    @IOptionsService private readonly _optionsService: IOptionsService
  ) {
    super();
    this._scrollToBottom = scrollToBottom;
    this.register({ dispose: () => this._scrollToBottom = undefined });
    this.modes = clone(DEFAULT_MODES);
    this.decPrivateModes = clone(DEFAULT_DEC_PRIVATE_MODES);
  }

  public reset(): void {
    this.modes = clone(DEFAULT_MODES);
    this.decPrivateModes = clone(DEFAULT_DEC_PRIVATE_MODES);
  }

  public triggerDataEvent(data: string, wasUserInput: boolean = false): void {
    // Prevents all events to pty process if stdin is disabled
    if (this._optionsService.options.disableStdin) {
      return;
    }

    // Input is being sent to the terminal, the terminal should focus the prompt.
    const buffer = this._bufferService.buffer;
    if (buffer.ybase !== buffer.ydisp) {
      this._scrollToBottom!();
    }

    // Fire onUserInput so listeners can react as well (eg. clear selection)
    if (wasUserInput) {
      this._onUserInput.fire();
    }

    // Fire onData API
    this._logService.debug(`sending data "${data}"`, () => data.split('').map(e => e.charCodeAt(0)));
    this._onData.fire(data);
  }

  public triggerBinaryEvent(data: string): void {
    if (this._optionsService.options.disableStdin) {
      return;
    }
    this._logService.debug(`sending binary "${data}"`, () => data.split('').map(e => e.charCodeAt(0)));
    this._onBinary.fire(data);
  }
}
