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
import { IInstantiationService, IOptionsService, IBufferService, ILogService, ICharsetService, ICoreService, ICoreMouseService, IUnicodeService, IDirtyRowService, LogLevelEnum, ITerminalOptions } from 'common/services/Services';
import { InstantiationService } from 'common/services/InstantiationService';
import { LogService } from 'common/services/LogService';
import { BufferService, MINIMUM_COLS, MINIMUM_ROWS } from 'common/services/BufferService';
import { OptionsService } from 'common/services/OptionsService';
import { IDisposable, IBufferLine, IAttributeData, ICoreTerminal, IKeyboardEvent, IScrollEvent, ScrollSource, ITerminalOptions as IPublicTerminalOptions } from 'common/Types';
import { CoreService } from 'common/services/CoreService';
import { EventEmitter, IEvent, forwardEvent } from 'common/EventEmitter';
import { CoreMouseService } from 'common/services/CoreMouseService';
import { DirtyRowService } from 'common/services/DirtyRowService';
import { UnicodeService } from 'common/services/UnicodeService';
import { CharsetService } from 'common/services/CharsetService';
import { updateWindowsModeWrappedState } from 'common/WindowsMode';
import { IFunctionIdentifier, IParams } from 'common/parser/Types';
import { IBufferSet } from 'common/buffer/Types';
import { InputHandler } from 'common/InputHandler';
import { WriteBuffer } from 'common/input/WriteBuffer';

// Only trigger this warning a single time per session
let hasWriteSyncWarnHappened = false;

export abstract class CoreTerminal extends Disposable implements ICoreTerminal {
  protected readonly _instantiationService: IInstantiationService;
  protected readonly _bufferService: IBufferService;
  protected readonly _logService: ILogService;
  protected readonly _charsetService: ICharsetService;
  protected readonly _dirtyRowService: IDirtyRowService;

  public readonly coreMouseService: ICoreMouseService;
  public readonly coreService: ICoreService;
  public readonly unicodeService: IUnicodeService;
  public readonly optionsService: IOptionsService;

  protected _inputHandler: InputHandler;
  private _writeBuffer: WriteBuffer;
  private _windowsMode: IDisposable | undefined;

  private _onBinary = new EventEmitter<string>();
  public get onBinary(): IEvent<string> { return this._onBinary.event; }
  private _onData = new EventEmitter<string>();
  public get onData(): IEvent<string> { return this._onData.event; }
  protected _onLineFeed = new EventEmitter<void>();
  public get onLineFeed(): IEvent<void> { return this._onLineFeed.event; }
  private _onResize = new EventEmitter<{ cols: number, rows: number }>();
  public get onResize(): IEvent<{ cols: number, rows: number }> { return this._onResize.event; }
  protected _onScroll = new EventEmitter<IScrollEvent, void>();
  /**
   * Internally we track the source of the scroll but this is meaningless outside the library so
   * it's filtered out.
   */
  protected _onScrollApi?: EventEmitter<number, void>;
  public get onScroll(): IEvent<number, void> {
    if (!this._onScrollApi) {
      this._onScrollApi = new EventEmitter<number, void>();
      this.register(this._onScroll.event(ev => {
        this._onScrollApi?.fire(ev.position);
      }));
    }
    return this._onScrollApi.event;
  }

  public get cols(): number { return this._bufferService.cols; }
  public get rows(): number { return this._bufferService.rows; }
  public get buffers(): IBufferSet { return this._bufferService.buffers; }
  public get options(): ITerminalOptions { return this.optionsService.options; }
  public set options(options: ITerminalOptions) {
    for (const key in options) {
      this.optionsService.options[key] = options[key];
    }
  }

  constructor(
    options: Partial<ITerminalOptions>
  ) {
    super();

    // Setup and initialize services
    this._instantiationService = new InstantiationService();
    this.optionsService = new OptionsService(options);
    this._instantiationService.setService(IOptionsService, this.optionsService);
    this._bufferService = this.register(this._instantiationService.createInstance(BufferService));
    this._instantiationService.setService(IBufferService, this._bufferService);
    this._logService = this._instantiationService.createInstance(LogService);
    this._instantiationService.setService(ILogService, this._logService);
    this.coreService = this.register(this._instantiationService.createInstance(CoreService, () => this.scrollToBottom()));
    this._instantiationService.setService(ICoreService, this.coreService);
    this.coreMouseService = this._instantiationService.createInstance(CoreMouseService);
    this._instantiationService.setService(ICoreMouseService, this.coreMouseService);
    this._dirtyRowService = this._instantiationService.createInstance(DirtyRowService);
    this._instantiationService.setService(IDirtyRowService, this._dirtyRowService);
    this.unicodeService = this._instantiationService.createInstance(UnicodeService);
    this._instantiationService.setService(IUnicodeService, this.unicodeService);
    this._charsetService = this._instantiationService.createInstance(CharsetService);
    this._instantiationService.setService(ICharsetService, this._charsetService);

    // Register input handler and handle/forward events
    this._inputHandler = new InputHandler(this._bufferService, this._charsetService, this.coreService, this._dirtyRowService, this._logService, this.optionsService, this.coreMouseService, this.unicodeService);
    this.register(forwardEvent(this._inputHandler.onLineFeed, this._onLineFeed));
    this.register(this._inputHandler);

    // Setup listeners
    this.register(forwardEvent(this._bufferService.onResize, this._onResize));
    this.register(forwardEvent(this.coreService.onData, this._onData));
    this.register(forwardEvent(this.coreService.onBinary, this._onBinary));
    this.register(this.optionsService.onOptionChange(key => this._updateOptions(key)));
    this.register(this._bufferService.onScroll(event => {
      this._onScroll.fire({ position: this._bufferService.buffer.ydisp, source: ScrollSource.TERMINAL });
      this._dirtyRowService.markRangeDirty(this._bufferService.buffer.scrollTop, this._bufferService.buffer.scrollBottom);
    }));
    this.register(this._inputHandler.onScroll(event => {
      this._onScroll.fire({ position: this._bufferService.buffer.ydisp, source: ScrollSource.TERMINAL });
      this._dirtyRowService.markRangeDirty(this._bufferService.buffer.scrollTop, this._bufferService.buffer.scrollBottom);
    }));

    // Setup WriteBuffer
    this._writeBuffer = new WriteBuffer((data, promiseResult) => this._inputHandler.parse(data, promiseResult));
  }

  public dispose(): void {
    if (this._isDisposed) {
      return;
    }
    super.dispose();
    this._windowsMode?.dispose();
    this._windowsMode = undefined;
  }

  public write(data: string | Uint8Array, callback?: () => void): void {
    this._writeBuffer.write(data, callback);
  }

  /**
   * Write data to terminal synchonously.
   *
   * This method is unreliable with async parser handlers, thus should not
   * be used anymore. If you need blocking semantics on data input consider
   * `write` with a callback instead.
   *
   * @deprecated Unreliable, will be removed soon.
   */
  public writeSync(data: string | Uint8Array, maxSubsequentCalls?: number): void {
    if (this._logService.logLevel <= LogLevelEnum.WARN && !hasWriteSyncWarnHappened) {
      this._logService.warn('writeSync is unreliable and will be removed soon.');
      hasWriteSyncWarnHappened = true;
    }
    this._writeBuffer.writeSync(data, maxSubsequentCalls);
  }

  public resize(x: number, y: number): void {
    if (isNaN(x) || isNaN(y)) {
      return;
    }

    x = Math.max(x, MINIMUM_COLS);
    y = Math.max(y, MINIMUM_ROWS);

    this._bufferService.resize(x, y);
  }

  /**
   * Scroll the terminal down 1 row, creating a blank line.
   * @param isWrapped Whether the new line is wrapped from the previous line.
   */
  public scroll(eraseAttr: IAttributeData, isWrapped: boolean = false): void {
    this._bufferService.scroll(eraseAttr, isWrapped);
  }

  /**
   * Scroll the display of the terminal
   * @param disp The number of lines to scroll down (negative scroll up).
   * @param suppressScrollEvent Don't emit the scroll event as scrollLines. This is used
   * to avoid unwanted events being handled by the viewport when the event was triggered from the
   * viewport originally.
   */
  public scrollLines(disp: number, suppressScrollEvent?: boolean, source?: ScrollSource): void {
    this._bufferService.scrollLines(disp, suppressScrollEvent, source);
  }

  /**
   * Scroll the display of the terminal by a number of pages.
   * @param pageCount The number of pages to scroll (negative scrolls up).
   */
  public scrollPages(pageCount: number): void {
    this._bufferService.scrollPages(pageCount);
  }

  /**
   * Scrolls the display of the terminal to the top.
   */
  public scrollToTop(): void {
    this._bufferService.scrollToTop();
  }

  /**
   * Scrolls the display of the terminal to the bottom.
   */
  public scrollToBottom(): void {
    this._bufferService.scrollToBottom();
  }

  public scrollToLine(line: number): void {
    this._bufferService.scrollToLine(line);
  }

  /** Add handler for ESC escape sequence. See xterm.d.ts for details. */
  public registerEscHandler(id: IFunctionIdentifier, callback: () => boolean | Promise<boolean>): IDisposable {
    return this._inputHandler.registerEscHandler(id, callback);
  }

  /** Add handler for DCS escape sequence. See xterm.d.ts for details. */
  public registerDcsHandler(id: IFunctionIdentifier, callback: (data: string, param: IParams) => boolean | Promise<boolean>): IDisposable {
    return this._inputHandler.registerDcsHandler(id, callback);
  }

  /** Add handler for CSI escape sequence. See xterm.d.ts for details. */
  public registerCsiHandler(id: IFunctionIdentifier, callback: (params: IParams) => boolean | Promise<boolean>): IDisposable {
    return this._inputHandler.registerCsiHandler(id, callback);
  }

  /** Add handler for OSC escape sequence. See xterm.d.ts for details. */
  public registerOscHandler(ident: number, callback: (data: string) => boolean | Promise<boolean>): IDisposable {
    return this._inputHandler.registerOscHandler(ident, callback);
  }

  protected _setup(): void {
    if (this.optionsService.rawOptions.windowsMode) {
      this._enableWindowsMode();
    }
  }

  public reset(): void {
    this._inputHandler.reset();
    this._bufferService.reset();
    this._charsetService.reset();
    this.coreService.reset();
    this.coreMouseService.reset();
  }

  protected _updateOptions(key: string): void {
    // TODO: These listeners should be owned by individual components
    switch (key) {
      case 'scrollback':
        this.buffers.resize(this.cols, this.rows);
        break;
      case 'windowsMode':
        if (this.optionsService.rawOptions.windowsMode) {
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
      disposables.push(this.registerCsiHandler({ final: 'H' }, () => {
        updateWindowsModeWrappedState(this._bufferService);
        return false;
      }));
      this._windowsMode = {
        dispose: () => {
          for (const d of disposables) {
            d.dispose();
          }
        }
      };
    }
  }
}
