/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ICoreService, IOptionsService, IBufferService } from 'common/services/Services';
import { EventEmitter, IEvent } from 'common/EventEmitter';

export class CoreService implements ICoreService {
  private _onData = new EventEmitter<string>();
  public get onData(): IEvent<string> { return this._onData.event; }
  private _onUserInput = new EventEmitter<void>();
  public get onUserInput(): IEvent<void> { return this._onUserInput.event; }

  constructor(
    // TODO: Move this into a service
    private readonly _scrollToBottom: () => void,
    private readonly _bufferService: IBufferService,
    private readonly _optionsService: IOptionsService
  ) {
  }

  public triggerDataEvent(data: string, wasUserInput: boolean = false): void {
    // Prevents all events to pty process if stdin is disabled
    if (this._optionsService.options.disableStdin) {
      return;
    }

    // Input is being sent to the terminal, the terminal should focus the prompt.
    const buffer = this._bufferService.buffer;
    if (buffer.ybase !== buffer.ydisp) {
      this._scrollToBottom();
    }

    // Fire onUserInput so listeners can react as well (eg. clear selection)
    if (wasUserInput) {
      this._onUserInput.fire();
    }

    // Fire onData API
    this._onData.fire(data);
  }
}
