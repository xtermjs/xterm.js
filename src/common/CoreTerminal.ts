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
import { IInstantiationService, IOptionsService, IBufferService, ILogService } from 'common/services/Services';
import { InstantiationService } from 'common/services/InstantiationService';
import { LogService } from 'common/services/LogService';
import { BufferService } from 'common/services/BufferService';
import { OptionsService } from 'common/services/OptionsService';
import { ITerminalOptions } from './Types';

export class CoreTerminal extends Disposable {
  protected readonly _instantiationService: IInstantiationService;
  protected readonly _bufferService: IBufferService;
  protected readonly _logService: ILogService;

  public readonly optionsService: IOptionsService;

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
  }

  public get cols(): number { return this._bufferService.cols; }
  public get rows(): number { return this._bufferService.rows; }
}
