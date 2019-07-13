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

export class LogService implements ILogService {
  private _logLevel!: LogLevel;

  constructor(
    private readonly _optionsService: IOptionsService
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

  debug(message: any, ...optionalParams: any[]): void {
    if (this._logLevel <= LogLevel.DEBUG) {
      console.log.call(console, message, ...optionalParams);
    }
  }

  info(message: any, ...optionalParams: any[]): void {
    if (this._logLevel <= LogLevel.INFO) {
      console.info.call(console, message, ...optionalParams);
    }
  }

  warn(message: any, ...optionalParams: any[]): void {
    if (this._logLevel <= LogLevel.WARN) {
      console.warn.call(console, message, ...optionalParams);
    }
  }

  error(message: any, ...optionalParams: any[]): void {
    if (this._logLevel <= LogLevel.ERROR) {
      console.error.call(console, message, ...optionalParams);
    }
  }
}
