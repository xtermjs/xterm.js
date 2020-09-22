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
import { BufferService, MINIMUM_COLS, MINIMUM_ROWS } from 'common/services/BufferService';
import { OptionsService } from 'common/services/OptionsService';
import { ITerminalOptions, IDisposable, IBufferLine, IAttributeData, ICoreTerminal } from 'common/Types';
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

export abstract class CoreTerminal extends Disposable implements ICoreTerminal {
  protected readonly _instantiationService: IInstantiationService;
  protected readonly _bufferService: IBufferService;
  protected readonly _logService: ILogService;
  protected readonly _coreService: ICoreService;
  protected readonly _charsetService: ICharsetService;
  protected readonly _coreMouseService: ICoreMouseService;
  protected readonly _dirtyRowService: IDirtyRowService;

  public readonly unicodeService: IUnicodeService;
  public readonly optionsService: IOptionsService;

  protected _inputHandler: InputHandler;
  private _writeBuffer: WriteBuffer;
  private _windowsMode: IDisposable | undefined;
  /** An IBufferline to clone/copy from for new blank lines */
  private _cachedBlankLine: IBufferLine | undefined;

  private _onBinary = new EventEmitter<string>();
  public get onBinary(): IEvent<string> { return this._onBinary.event; }
  private _onData = new EventEmitter<string>();
  public get onData(): IEvent<string> { return this._onData.event; }
  protected _onLineFeed = new EventEmitter<void>();
  public get onLineFeed(): IEvent<void> { return this._onLineFeed.event; }
  private _onResize = new EventEmitter<{ cols: number, rows: number }>();
  public get onResize(): IEvent<{ cols: number, rows: number }> { return this._onResize.event; }
  protected _onScroll = new EventEmitter<number>();
  public get onScroll(): IEvent<number> { return this._onScroll.event; }

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
    this._bufferService = this.register(this._instantiationService.createInstance(BufferService));
    this._instantiationService.setService(IBufferService, this._bufferService);
    this._logService = this._instantiationService.createInstance(LogService);
    this._instantiationService.setService(ILogService, this._logService);
    this._coreService = this.register(this._instantiationService.createInstance(CoreService, () => this.scrollToBottom()));
    this._instantiationService.setService(ICoreService, this._coreService);
    this._coreMouseService = this._instantiationService.createInstance(CoreMouseService);
    this._instantiationService.setService(ICoreMouseService, this._coreMouseService);
    this._dirtyRowService = this._instantiationService.createInstance(DirtyRowService);
    this._instantiationService.setService(IDirtyRowService, this._dirtyRowService);
    this.unicodeService = this._instantiationService.createInstance(UnicodeService);
    this._instantiationService.setService(IUnicodeService, this.unicodeService);
    this._charsetService = this._instantiationService.createInstance(CharsetService);
    this._instantiationService.setService(ICharsetService, this._charsetService);

    // Register input handler and handle/forward events
    this._inputHandler = new InputHandler(this._bufferService, this._charsetService, this._coreService, this._dirtyRowService, this._logService, this.optionsService, this._coreMouseService, this.unicodeService);
    this.register(forwardEvent(this._inputHandler.onLineFeed, this._onLineFeed));
    this.register(this._inputHandler);

    // Setup listeners
    this.register(forwardEvent(this._bufferService.onResize, this._onResize));
    this.register(forwardEvent(this._coreService.onData, this._onData));
    this.register(forwardEvent(this._coreService.onBinary, this._onBinary));
    this.register(this.optionsService.onOptionChange(key => this._updateOptions(key)));

    // Setup WriteBuffer
    this._writeBuffer = new WriteBuffer(data => this._inputHandler.parse(data));
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

  public writeSync(data: string | Uint8Array): void {
    this._writeBuffer.writeSync(data);
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
    const buffer = this._bufferService.buffer;

    let newLine: IBufferLine | undefined;
    newLine = this._cachedBlankLine;
    if (!newLine || newLine.length !== this.cols || newLine.getFg(0) !== eraseAttr.fg || newLine.getBg(0) !== eraseAttr.bg) {
      newLine = buffer.getBlankLine(eraseAttr, isWrapped);
      this._cachedBlankLine = newLine;
    }
    newLine.isWrapped = isWrapped;

    const topRow = buffer.ybase + buffer.scrollTop;
    const bottomRow = buffer.ybase + buffer.scrollBottom;

    if (buffer.scrollTop === 0) {
      // Determine whether the buffer is going to be trimmed after insertion.
      const willBufferBeTrimmed = buffer.lines.isFull;

      // Insert the line using the fastest method
      if (bottomRow === buffer.lines.length - 1) {
        if (willBufferBeTrimmed) {
          buffer.lines.recycle().copyFrom(newLine);
        } else {
          buffer.lines.push(newLine.clone());
        }
      } else {
        buffer.lines.splice(bottomRow + 1, 0, newLine.clone());
      }

      // Only adjust ybase and ydisp when the buffer is not trimmed
      if (!willBufferBeTrimmed) {
        buffer.ybase++;
        // Only scroll the ydisp with ybase if the user has not scrolled up
        if (!this._bufferService.isUserScrolling) {
          buffer.ydisp++;
        }
      } else {
        // When the buffer is full and the user has scrolled up, keep the text
        // stable unless ydisp is right at the top
        if (this._bufferService.isUserScrolling) {
          buffer.ydisp = Math.max(buffer.ydisp - 1, 0);
        }
      }
    } else {
      // scrollTop is non-zero which means no line will be going to the
      // scrollback, instead we can just shift them in-place.
      const scrollRegionHeight = bottomRow - topRow + 1 /* as it's zero-based */;
      buffer.lines.shiftElements(topRow + 1, scrollRegionHeight - 1, -1);
      buffer.lines.set(bottomRow, newLine.clone());
    }

    // Move the viewport to the bottom of the buffer unless the user is
    // scrolling.
    if (!this._bufferService.isUserScrolling) {
      buffer.ydisp = buffer.ybase;
    }

    // Flag rows that need updating
    this._dirtyRowService.markRangeDirty(buffer.scrollTop, buffer.scrollBottom);

    this._onScroll.fire(buffer.ydisp);
  }

  /**
   * Scroll the display of the terminal
   * @param disp The number of lines to scroll down (negative scroll up).
   * @param suppressScrollEvent Don't emit the scroll event as scrollLines. This is used
   * to avoid unwanted events being handled by the viewport when the event was triggered from the
   * viewport originally.
   */
  public scrollLines(disp: number, suppressScrollEvent?: boolean): void {
    const buffer = this._bufferService.buffer;
    if (disp < 0) {
      if (buffer.ydisp === 0) {
        return;
      }
      this._bufferService.isUserScrolling = true;
    } else if (disp + buffer.ydisp >= buffer.ybase) {
      this._bufferService.isUserScrolling = false;
    }

    const oldYdisp = buffer.ydisp;
    buffer.ydisp = Math.max(Math.min(buffer.ydisp + disp, buffer.ybase), 0);

    // No change occurred, don't trigger scroll/refresh
    if (oldYdisp === buffer.ydisp) {
      return;
    }

    if (!suppressScrollEvent) {
      this._onScroll.fire(buffer.ydisp);
    }
  }

  /**
   * Scroll the display of the terminal by a number of pages.
   * @param pageCount The number of pages to scroll (negative scrolls up).
   */
  public scrollPages(pageCount: number): void {
    this.scrollLines(pageCount * (this.rows - 1));
  }

  /**
   * Scrolls the display of the terminal to the top.
   */
  public scrollToTop(): void {
    this.scrollLines(-this._bufferService.buffer.ydisp);
  }

  /**
   * Scrolls the display of the terminal to the bottom.
   */
  public scrollToBottom(): void {
    this.scrollLines(this._bufferService.buffer.ybase - this._bufferService.buffer.ydisp);
  }

  public scrollToLine(line: number): void {
    const scrollAmount = line - this._bufferService.buffer.ydisp;
    if (scrollAmount !== 0) {
      this.scrollLines(scrollAmount);
    }
  }

  /** Add handler for ESC escape sequence. See xterm.d.ts for details. */
  public addEscHandler(id: IFunctionIdentifier, callback: () => boolean): IDisposable {
    return this._inputHandler.addEscHandler(id, callback);
  }

  /** Add handler for DCS escape sequence. See xterm.d.ts for details. */
  public addDcsHandler(id: IFunctionIdentifier, callback: (data: string, param: IParams) => boolean): IDisposable {
    return this._inputHandler.addDcsHandler(id, callback);
  }

  /** Add handler for CSI escape sequence. See xterm.d.ts for details. */
  public addCsiHandler(id: IFunctionIdentifier, callback: (params: IParams) => boolean): IDisposable {
    return this._inputHandler.addCsiHandler(id, callback);
  }

  /** Add handler for OSC escape sequence. See xterm.d.ts for details. */
  public addOscHandler(ident: number, callback: (data: string) => boolean): IDisposable {
    return this._inputHandler.addOscHandler(ident, callback);
  }

  protected _setup(): void {
    if (this.optionsService.options.windowsMode) {
      this._enableWindowsMode();
    }
  }

  public reset(): void {
    this._inputHandler.reset();
    this._bufferService.reset();
    this._charsetService.reset();
    this._coreService.reset();
    this._coreMouseService.reset();
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
          for (const d of disposables) {
            d.dispose();
          }
        }
      };
    }
  }
}
