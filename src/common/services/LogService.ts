/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ILogService, IOptionsService } from 'common/services/Services';

interface IConsole {
  log(message?: any, ...optionalParams: any[]): void;
  error(message?: any, ...optionalParams: any[]): void;
  info(message?: any, ...optionalParams: any[]): void;
  trace(message?: any, ...optionalParams: any[]): void;
  warn(message?: any, ...optionalParams: any[]): void;
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
  _serviceBrand: any;

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

  debug(message: string, ...optionalParams: any[]): void {
    if (this._logLevel <= LogLevel.DEBUG) {
      console.log.call(console, LOG_PREFIX + message, ...optionalParams);
    }
  }

  info(message: string, ...optionalParams: any[]): void {
    if (this._logLevel <= LogLevel.INFO) {
      console.info.call(console, LOG_PREFIX + message, ...optionalParams);
    }
  }

  warn(message: string, ...optionalParams: any[]): void {
    if (this._logLevel <= LogLevel.WARN) {
      console.warn.call(console, LOG_PREFIX + message, ...optionalParams);
    }
  }

  error(message: string, ...optionalParams: any[]): void {
    if (this._logLevel <= LogLevel.ERROR) {
      console.error.call(console, LOG_PREFIX + message, ...optionalParams);
    }
  }
}
