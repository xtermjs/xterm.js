/**
 * Copyright (c) 2014-2020 The xterm.js authors. All rights reserved.
 * Copyright (c) 2012-2013, Christopher Jeffrey (MIT License)
 * @license MIT
 *
 * Originally forked from (with the author's permission):
 *   Fabrice Bellard's javascript vt100 for jslinux:
 *   http://bellard.org/jslinux/
 *   Copyright (c) 2011 Fabrice Bellard
 *   The original design remains. The terminal itself
 *   has been extended to include xterm CSI codes, among
 *   other features.
 *
 * Terminal Emulation References:
 *   http://vt100.net/
 *   http://invisible-island.net/xterm/ctlseqs/ctlseqs.txt
 *   http://invisible-island.net/xterm/ctlseqs/ctlseqs.html
 *   http://invisible-island.net/vttest/
 *   http://www.inwap.com/pdp10/ansicode.txt
 *   http://linux.die.net/man/4/console_codes
 *   http://linux.die.net/man/7/urxvt
 */

import { Disposable } from 'common/Lifecycle';
import { IInstantiationService, IOptionsService, IBufferService, ILogService, ICharsetService, ICoreService, ICoreMouseService, IUnicodeService, IDirtyRowService } from 'common/services/Services';
import { InstantiationService } from 'common/services/InstantiationService';
import { LogService } from 'common/services/LogService';
import { BufferService } from 'common/services/BufferService';
import { OptionsService } from 'common/services/OptionsService';
import { ITerminalOptions, IDisposable } from './Types';
import { CoreService } from 'common/services/CoreService';
import { EventEmitter, IEvent } from 'common/EventEmitter';
import { CoreMouseService } from 'common/services/CoreMouseService';
import { DirtyRowService } from 'common/services/DirtyRowService';
import { UnicodeService } from 'common/services/UnicodeService';
import { CharsetService } from 'common/services/CharsetService';
import { updateWindowsModeWrappedState } from 'common/WindowsMode';
import { IFunctionIdentifier, IParams } from 'common/parser/Types';
import { IBufferSet } from 'common/buffer/Types';

export abstract class CoreTerminal extends Disposable {
  protected readonly _instantiationService: IInstantiationService;
  protected readonly _bufferService: IBufferService;
  protected readonly _logService: ILogService;
  protected readonly _coreService: ICoreService;
  protected readonly _charsetService: ICharsetService;
  protected readonly _coreMouseService: ICoreMouseService;
  protected readonly _dirtyRowService: IDirtyRowService;

  public readonly unicodeService: IUnicodeService;
  public readonly optionsService: IOptionsService;

  private _windowsMode: IDisposable | undefined;

  private _onBinary = new EventEmitter<string>();
  public get onBinary(): IEvent<string> { return this._onBinary.event; }
  private _onData = new EventEmitter<string>();
  public get onData(): IEvent<string> { return this._onData.event; }
  protected _onLineFeed = new EventEmitter<void>();
  public get onLineFeed(): IEvent<void> { return this._onLineFeed.event; }

  public get cols(): number { return this._bufferService.cols; }
  public get rows(): number { return this._bufferService.rows; }
  public get buffers(): IBufferSet { return this._bufferService.buffers; }

  constructor(
    options: ITerminalOptions
  ) {
    super();

    // Setup and initialize services
    this._instantiationService = new InstantiationService();
    this.optionsService = new OptionsService(options);
    this._instantiationService.setService(IOptionsService, this.optionsService);
    this._bufferService = this._instantiationService.createInstance(BufferService);
    this._instantiationService.setService(IBufferService, this._bufferService);
    this._logService = this._instantiationService.createInstance(LogService);
    this._instantiationService.setService(ILogService, this._logService);
    this._coreService = this._instantiationService.createInstance(CoreService, () => this.scrollToBottom());
    this._instantiationService.setService(ICoreService, this._coreService);
    this._coreMouseService = this._instantiationService.createInstance(CoreMouseService);
    this._instantiationService.setService(ICoreMouseService, this._coreMouseService);
    this._dirtyRowService = this._instantiationService.createInstance(DirtyRowService);
    this._instantiationService.setService(IDirtyRowService, this._dirtyRowService);
    this.unicodeService = this._instantiationService.createInstance(UnicodeService);
    this._instantiationService.setService(IUnicodeService, this.unicodeService);
    this._charsetService = this._instantiationService.createInstance(CharsetService);
    this._instantiationService.setService(ICharsetService, this._charsetService);

    // Setup listeners
    this._coreService.onData(e => this._onData.fire(e));
    this._coreService.onBinary(e => this._onBinary.fire(e));
    this.optionsService.onOptionChange(key => this._updateOptions(key));
  }

  public dispose(): void {
    if (this._isDisposed) {
      return;
    }
    super.dispose();
    this._windowsMode?.dispose();
    this._windowsMode = undefined;
  }

  protected _setup(): void {
    if (this.optionsService.options.windowsMode) {
      this._enableWindowsMode();
    }
  }

  protected _updateOptions(key: string): void {
    // TODO: These listeners should be owned by individual components
    switch (key) {
      case 'scrollback':
        this.buffers.resize(this.cols, this.rows);
        break;
      case 'windowsMode':
        if (this.optionsService.options.windowsMode) {
          this._enableWindowsMode();
        } else {
          this._windowsMode?.dispose();
          this._windowsMode = undefined;
        }
        break;
    }
  }

  protected _enableWindowsMode(): void {
    if (!this._windowsMode) {
      const disposables: IDisposable[] = [];
      disposables.push(this.onLineFeed(updateWindowsModeWrappedState.bind(null, this._bufferService)));
      disposables.push(this.addCsiHandler({ final: 'H' }, () => {
        updateWindowsModeWrappedState(this._bufferService);
        return false;
      }));
      this._windowsMode = {
        dispose: () => {
          disposables.forEach(d => d.dispose());
        }
      };
    }
  }

  public abstract scrollToBottom(): void;
  public abstract addCsiHandler(id: IFunctionIdentifier, callback: (params: IParams) => boolean): IDisposable;
}
