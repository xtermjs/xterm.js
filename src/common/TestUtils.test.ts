/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IBufferService, ICoreService, ILogService, IOptionsService, ITerminalOptions, ICoreMouseService, ICharsetService, UnicodeCharProperties, UnicodeCharWidth, IUnicodeService, IUnicodeVersionProvider, LogLevelEnum, IDecorationService, IInternalDecoration, IOscLinkService } from 'common/services/Services';
import { UnicodeService } from 'common/services/UnicodeService';
import { clone } from 'common/Clone';
import { DEFAULT_OPTIONS } from 'common/services/OptionsService';
import { IBufferSet, IBuffer } from 'common/buffer/Types';
import { BufferSet } from 'common/buffer/BufferSet';
import { IDecPrivateModes, ICoreMouseEvent, CoreMouseEventType, ICharset, IModes, IAttributeData, IOscLinkData, IDisposable } from 'common/Types';
import { UnicodeV6 } from 'common/input/UnicodeV6';
import { IDecorationOptions, IDecoration } from '@xterm/xterm';
import { Emitter, type Event } from 'vs/base/common/event';

export class MockBufferService implements IBufferService {
  public serviceBrand: any;
  public get buffer(): IBuffer { return this.buffers.active; }
  public buffers: IBufferSet = {} as any;
  public onResize: Event<{ cols: number, rows: number }> = new Emitter<{ cols: number, rows: number }>().event;
  public onScroll: Event<number> = new Emitter<number>().event;
  private readonly _onScroll = new Emitter<number>();
  public isUserScrolling: boolean = false;
  constructor(
    public cols: number,
    public rows: number,
    optionsService: IOptionsService = new MockOptionsService()
  ) {
    this.buffers = new BufferSet(optionsService, this);
    // Listen to buffer activation events and automatically fire scroll events
    this.buffers.onBufferActivate(e => {
      this._onScroll.fire(e.activeBuffer.ydisp);
    });
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
  public serviceBrand: any;
  public areMouseEventsActive: boolean = false;
  public activeEncoding: string = '';
  public activeProtocol: string = '';
  public addEncoding(name: string): void { }
  public addProtocol(name: string): void { }
  public reset(): void { }
  public triggerMouseEvent(event: ICoreMouseEvent): boolean { return false; }
  public onProtocolChange: Event<CoreMouseEventType> = new Emitter<CoreMouseEventType>().event;
  public explainEvents(events: CoreMouseEventType): { [event: string]: boolean } {
    throw new Error('Method not implemented.');
  }
  public consumeWheelEvent(ev: WheelEvent, cellHeight: number, dpr: number): number {
    return 1;
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
  public isCursorInitialized: boolean = true;
  public isCursorHidden: boolean = false;
  public isFocused: boolean = false;
  public modes: IModes = {
    insertMode: false
  };
  public decPrivateModes: IDecPrivateModes = {
    applicationCursorKeys: false,
    applicationKeypad: false,
    bracketedPasteMode: false,
    cursorBlink: undefined,
    cursorStyle: undefined,
    origin: false,
    reverseWraparound: false,
    sendFocus: false,
    wraparound: true
  };
  public onData: Event<string> = new Emitter<string>().event;
  public onUserInput: Event<void> = new Emitter<void>().event;
  public onBinary: Event<string> = new Emitter<string>().event;
  public onRequestScrollToBottom: Event<void> = new Emitter<void>().event;
  public reset(): void { }
  public triggerDataEvent(data: string, wasUserInput?: boolean): void { }
  public triggerBinaryEvent(data: string): void { }
}

export class MockLogService implements ILogService {
  public serviceBrand: any;
  public logLevel = LogLevelEnum.DEBUG;
  public trace(message: any, ...optionalParams: any[]): void { }
  public debug(message: any, ...optionalParams: any[]): void { }
  public info(message: any, ...optionalParams: any[]): void { }
  public warn(message: any, ...optionalParams: any[]): void { }
  public error(message: any, ...optionalParams: any[]): void { }
}

export class MockOptionsService implements IOptionsService {
  public serviceBrand: any;
  public readonly rawOptions: Required<ITerminalOptions> = clone(DEFAULT_OPTIONS);
  public options: Required<ITerminalOptions> = this.rawOptions;
  public onOptionChange: Event<keyof ITerminalOptions> = new Emitter<keyof ITerminalOptions>().event;
  constructor(testOptions?: Partial<ITerminalOptions>) {
    if (testOptions) {
      for (const key of Object.keys(testOptions)) {
        this.rawOptions[key] = testOptions[key];
      }
    }
  }
  // eslint-disable-next-line @typescript-eslint/naming-convention
  public onSpecificOptionChange<T extends keyof ITerminalOptions>(key: T, listener: (arg1: ITerminalOptions[T]) => any): IDisposable {
    return this.onOptionChange(eventKey => {
      if (eventKey === key) {
        listener(this.rawOptions[key]);
      }
    });
  }
  // eslint-disable-next-line @typescript-eslint/naming-convention
  public onMultipleOptionChange(keys: (keyof ITerminalOptions)[], listener: () => any): IDisposable {
    return this.onOptionChange(eventKey => {
      if (keys.indexOf(eventKey) !== -1) {
        listener();
      }
    });
  }
  public setOptions(options: ITerminalOptions): void {
    for (const key of Object.keys(options)) {
      this.options[key] = options[key];
    }
  }
}

export class MockOscLinkService implements IOscLinkService {
  public serviceBrand: any;
  public registerLink(linkData: IOscLinkData): number {
    return 1;
  }
  public getLinkData(linkId: number): IOscLinkData | undefined {
    return undefined;
  }
  public addLineToLink(linkId: number, y: number): void {
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
  public onChange: Event<string> = new Emitter<string>().event;
  public wcwidth = (codepoint: number): UnicodeCharWidth => this._provider.wcwidth(codepoint);
  public charProperties(codepoint: number, preceding: UnicodeCharProperties): UnicodeCharProperties {
    let width = this.wcwidth(codepoint);
    let shouldJoin = width === 0 && preceding !== 0;
    if (shouldJoin) {
      const oldWidth = UnicodeService.extractWidth(preceding);
      if (oldWidth === 0) {
        shouldJoin = false;
      } else if (oldWidth > width) {
        width = oldWidth;
      }
    }
    return UnicodeService.createPropertyValue(0, width, shouldJoin);
  }
  public getStringCellWidth(s: string): number {
    throw new Error('Method not implemented.');
  }
}

export class MockDecorationService implements IDecorationService {
  public serviceBrand: any;
  public get decorations(): IterableIterator<IInternalDecoration> { return [].values(); }
  public onDecorationRegistered = new Emitter<IInternalDecoration>().event;
  public onDecorationRemoved = new Emitter<IInternalDecoration>().event;
  public registerDecoration(decorationOptions: IDecorationOptions): IDecoration | undefined { return undefined; }
  public reset(): void { }
  public forEachDecorationAtCell(x: number, line: number, layer: 'bottom' | 'top' | undefined, callback: (decoration: IInternalDecoration) => void): void { }
  public dispose(): void { }
}
