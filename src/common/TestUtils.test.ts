/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IBufferService, ICoreService, ILogService, IOptionsService, ITerminalOptions, IDirtyRowService, ICoreMouseService, ICharsetService, IUnicodeService, IUnicodeVersionProvider, LogLevelEnum } from 'common/services/Services';
import { IEvent, EventEmitter } from 'common/EventEmitter';
import { clone } from 'common/Clone';
import { DEFAULT_OPTIONS } from 'common/services/OptionsService';
import { IBufferSet, IBuffer } from 'common/buffer/Types';
import { BufferSet } from 'common/buffer/BufferSet';
import { IDecPrivateModes, ICoreMouseEvent, CoreMouseEventType, ICharset, IModes, IAttributeData } from 'common/Types';
import { UnicodeV6 } from 'common/input/UnicodeV6';

export class MockBufferService implements IBufferService {
  public serviceBrand: any;
  public get buffer(): IBuffer { return this.buffers.active; }
  public buffers: IBufferSet = {} as any;
  public onResize: IEvent<{ cols: number, rows: number }> = new EventEmitter<{ cols: number, rows: number }>().event;
  public onScroll: IEvent<number> = new EventEmitter<number>().event;
  public isUserScrolling: boolean = false;
  constructor(
    public cols: number,
    public rows: number,
    optionsService: IOptionsService = new MockOptionsService()
  ) {
    this.buffers = new BufferSet(optionsService, this);
  }
  public scrollPages(pageCount: number): void {
    throw new Error('Method not implemented.');
  }
  public scrollToTop(): void {
    throw new Error('Method not implemented.');
  }
  public scrollToLine(line: number): void {
    throw new Error('Method not implemented.');
  }
  public scroll(eraseAttr: IAttributeData, isWrapped: boolean): void {
    throw new Error('Method not implemented.');
  }
  public scrollToBottom(): void {
    throw new Error('Method not implemented.');
  }
  public scrollLines(disp: number, suppressScrollEvent?: boolean): void {
    throw new Error('Method not implemented.');
  }
  public resize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
  }
  public reset(): void { }
}

export class MockCoreMouseService implements ICoreMouseService {
  public areMouseEventsActive: boolean = false;
  public activeEncoding: string = '';
  public activeProtocol: string = '';
  public addEncoding(name: string): void { }
  public addProtocol(name: string): void { }
  public reset(): void { }
  public triggerMouseEvent(event: ICoreMouseEvent): boolean { return false; }
  public onProtocolChange: IEvent<CoreMouseEventType> = new EventEmitter<CoreMouseEventType>().event;
  public explainEvents(events: CoreMouseEventType): { [event: string]: boolean } {
    throw new Error('Method not implemented.');
  }
}

export class MockCharsetService implements ICharsetService {
  public serviceBrand: any;
  public charset: ICharset | undefined;
  public glevel: number = 0;
  public reset(): void { }
  public setgLevel(g: number): void { }
  public setgCharset(g: number, charset: ICharset): void { }
}

export class MockCoreService implements ICoreService {
  public serviceBrand: any;
  public isCursorInitialized: boolean = false;
  public isCursorHidden: boolean = false;
  public isFocused: boolean = false;
  public modes: IModes = {
    insertMode: false
  };
  public decPrivateModes: IDecPrivateModes = {
    applicationCursorKeys: false,
    applicationKeypad: false,
    bracketedPasteMode: false,
    origin: false,
    reverseWraparound: false,
    sendFocus: false,
    wraparound: true
  };
  public onData: IEvent<string> = new EventEmitter<string>().event;
  public onUserInput: IEvent<void> = new EventEmitter<void>().event;
  public onBinary: IEvent<string> = new EventEmitter<string>().event;
  public reset(): void { }
  public triggerDataEvent(data: string, wasUserInput?: boolean): void { }
  public triggerBinaryEvent(data: string): void { }
}

export class MockDirtyRowService implements IDirtyRowService {
  public serviceBrand: any;
  public start: number = 0;
  public end: number = 0;
  public clearRange(): void { }
  public markDirty(y: number): void { }
  public markRangeDirty(y1: number, y2: number): void { }
  public markAllDirty(): void { }
}

export class MockLogService implements ILogService {
  public serviceBrand: any;
  public logLevel = LogLevelEnum.DEBUG;
  public debug(message: any, ...optionalParams: any[]): void { }
  public info(message: any, ...optionalParams: any[]): void { }
  public warn(message: any, ...optionalParams: any[]): void { }
  public error(message: any, ...optionalParams: any[]): void { }
}

export class MockOptionsService implements IOptionsService {
  public serviceBrand: any;
  public options: ITerminalOptions = clone(DEFAULT_OPTIONS);
  public onOptionChange: IEvent<string> = new EventEmitter<string>().event;
  constructor(testOptions?: Partial<ITerminalOptions>) {
    if (testOptions) {
      for (const key of Object.keys(testOptions)) {
        this.options[key] = testOptions[key];
      }
    }
  }
  public setOptions(options: ITerminalOptions): void {
    for (const key of Object.keys(options)) {
      this.options[key] = options[key];
    }
  }
  public setOption<T>(key: string, value: T): void {
    throw new Error('Method not implemented.');
  }
  public getOption<T>(key: string): T {
    throw new Error('Method not implemented.');
  }
}

// defaults to V6 always to keep tests passing
export class MockUnicodeService implements IUnicodeService {
  public serviceBrand: any;
  private _provider = new UnicodeV6();
  public register(provider: IUnicodeVersionProvider): void {
    throw new Error('Method not implemented.');
  }
  public versions: string[] = [];
  public activeVersion: string = '';
  public onChange: IEvent<string> = new EventEmitter<string>().event;
  public wcwidth = (codepoint: number): number => this._provider.wcwidth(codepoint);
  public getStringCellWidth(s: string): number {
    throw new Error('Method not implemented.');
  }
}
