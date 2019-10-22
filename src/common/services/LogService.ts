/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ILogService, IOptionsService } from 'common/services/Services';

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


export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  OFF = 4
}

const optionsKeyToLogLevel: { [key: string]: LogLevel } = {
  debug: LogLevel.DEBUG,
  info: LogLevel.INFO,
  warn: LogLevel.WARN,
  error: LogLevel.ERROR,
  off: LogLevel.OFF
};

const LOG_PREFIX = 'xterm.js: ';

export class LogService implements ILogService {
  serviceBrand: any;

  private _logLevel!: LogLevel;

  constructor(
    @IOptionsService private readonly _optionsService: IOptionsService
  ) {
    this._updateLogLevel();
    this._optionsService.onOptionChange(key => {
      if (key === 'logLevel') {
        this._updateLogLevel();
      }
    });
  }

  private _updateLogLevel(): void {
    this._logLevel = optionsKeyToLogLevel[this._optionsService.options.logLevel];
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

  debug(message: string, ...optionalParams: any[]): void {
    if (this._logLevel <= LogLevel.DEBUG) {
      this._log(console.log, message, optionalParams);
    }
  }

  info(message: string, ...optionalParams: any[]): void {
    if (this._logLevel <= LogLevel.INFO) {
      this._log(console.info, message, optionalParams);
    }
  }

  warn(message: string, ...optionalParams: any[]): void {
    if (this._logLevel <= LogLevel.WARN) {
      this._log(console.warn, message, optionalParams);
    }
  }

  error(message: string, ...optionalParams: any[]): void {
    if (this._logLevel <= LogLevel.ERROR) {
      this._log(console.error, message, optionalParams);
    }
  }
}
