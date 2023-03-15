/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Disposable } from 'common/Lifecycle';
import { ILogService, IOptionsService, LogLevelEnum } from 'common/services/Services';

type LogType = (message?: any, ...optionalParams: any[]) => void;

interface IConsole {
  log: LogType;
  error: LogType;
  info: LogType;
  trace: LogType;
  warn: LogType;
}

// console is available on both node.js and browser contexts but the common
// module doesn't depend on them so we need to explicitly declare it.
declare const console: IConsole;

const optionsKeyToLogLevel: { [key: string]: LogLevelEnum } = {
  debug: LogLevelEnum.DEBUG,
  info: LogLevelEnum.INFO,
  warn: LogLevelEnum.WARN,
  error: LogLevelEnum.ERROR,
  off: LogLevelEnum.OFF
};

const LOG_PREFIX = 'xterm.js: ';

export class LogService extends Disposable implements ILogService {
  public serviceBrand: any;

  public logLevel: LogLevelEnum = LogLevelEnum.OFF;

  constructor(
    @IOptionsService private readonly _optionsService: IOptionsService
  ) {
    super();
    this._updateLogLevel();
    this.register(this._optionsService.onSpecificOptionChange('logLevel', () => this._updateLogLevel()));
  }

  private _updateLogLevel(): void {
    this.logLevel = optionsKeyToLogLevel[this._optionsService.rawOptions.logLevel];
  }

  private _evalLazyOptionalParams(optionalParams: any[]): void {
    for (let i = 0; i < optionalParams.length; i++) {
      if (typeof optionalParams[i] === 'function') {
        optionalParams[i] = optionalParams[i]();
      }
    }
  }

  private _log(type: LogType, message: string, optionalParams: any[]): void {
    this._evalLazyOptionalParams(optionalParams);
    type.call(console, LOG_PREFIX + message, ...optionalParams);
  }

  public debug(message: string, ...optionalParams: any[]): void {
    if (this.logLevel <= LogLevelEnum.DEBUG) {
      this._log(console.log, message, optionalParams);
    }
  }

  public info(message: string, ...optionalParams: any[]): void {
    if (this.logLevel <= LogLevelEnum.INFO) {
      this._log(console.info, message, optionalParams);
    }
  }

  public warn(message: string, ...optionalParams: any[]): void {
    if (this.logLevel <= LogLevelEnum.WARN) {
      this._log(console.warn, message, optionalParams);
    }
  }

  public error(message: string, ...optionalParams: any[]): void {
    if (this.logLevel <= LogLevelEnum.ERROR) {
      this._log(console.error, message, optionalParams);
    }
  }
}
