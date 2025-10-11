/**
 * Copyright (c) 2014 The xterm.js authors. All rights reserved.
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

import { DEFAULT_ATTR_DATA } from 'common/buffer/BufferLine';
import { IBuffer } from 'common/buffer/Types';
import { CoreTerminal } from 'common/CoreTerminal';
import { IMarker, ITerminalOptions } from 'common/Types';
import { Emitter, Event } from 'vs/base/common/event';

export class Terminal extends CoreTerminal {
  private readonly _onBell = this._register(new Emitter<void>());
  public readonly onBell = this._onBell.event;
  private readonly _onCursorMove = this._register(new Emitter<void>());
  public readonly onCursorMove = this._onCursorMove.event;
  private readonly _onTitleChange = this._register(new Emitter<string>());
  public readonly onTitleChange = this._onTitleChange.event;
  private readonly _onA11yCharEmitter = this._register(new Emitter<string>());
  public readonly onA11yChar = this._onA11yCharEmitter.event;
  private readonly _onA11yTabEmitter = this._register(new Emitter<number>());
  public readonly onA11yTab = this._onA11yTabEmitter.event;

  constructor(
    options: ITerminalOptions = {}
  ) {
    super(options);

    this._setup();

    // Setup InputHandler listeners
    this._register(this._inputHandler.onRequestBell(() => this.bell()));
    this._register(this._inputHandler.onRequestReset(() => this.reset()));
    this._register(Event.forward(this._inputHandler.onCursorMove, this._onCursorMove));
    this._register(Event.forward(this._inputHandler.onTitleChange, this._onTitleChange));
    this._register(Event.forward(this._inputHandler.onA11yChar, this._onA11yCharEmitter));
    this._register(Event.forward(this._inputHandler.onA11yTab, this._onA11yTabEmitter));
  }

  /**
   * Convenience property to active buffer.
   */
  public get buffer(): IBuffer {
    return this.buffers.active;
  }

  // TODO: Support paste here?

  public get markers(): IMarker[] {
    return this.buffer.markers;
  }

  public addMarker(cursorYOffset: number): IMarker | undefined {
    // Disallow markers on the alt buffer
    if (this.buffer !== this.buffers.normal) {
      return;
    }

    return this.buffer.addMarker(this.buffer.ybase + this.buffer.y + cursorYOffset);
  }

  public bell(): void {
    this._onBell.fire();
  }

  public input(data: string, wasUserInput: boolean = true): void {
    this.coreService.triggerDataEvent(data, wasUserInput);
  }

  /**
   * Resizes the terminal.
   *
   * @param x The number of columns to resize to.
   * @param y The number of rows to resize to.
   */
  public resize(x: number, y: number): void {
    if (x === this.cols && y === this.rows) {
      return;
    }

    super.resize(x, y);
  }

  /**
   * Clear the entire buffer, making the prompt line the new first line.
   */
  public clear(): void {
    if (this.buffer.ybase === 0 && this.buffer.y === 0) {
      // Don't clear if it's already clear
      return;
    }
    this.buffer.lines.set(0, this.buffer.lines.get(this.buffer.ybase + this.buffer.y)!);
    this.buffer.lines.length = 1;
    this.buffer.ydisp = 0;
    this.buffer.ybase = 0;
    this.buffer.y = 0;
    for (let i = 1; i < this.rows; i++) {
      this.buffer.lines.push(this.buffer.getBlankLine(DEFAULT_ATTR_DATA));
    }
    this._onScroll.fire({ position: this.buffer.ydisp });
  }

  /**
   * Reset terminal.
   * Note: Calling this directly from JS is synchronous but does not clear
   * input buffers and does not reset the parser, thus the terminal will
   * continue to apply pending input data.
   * If you need in band reset (synchronous with input data) consider
   * using DECSTR (soft reset, CSI ! p) or RIS instead (hard reset, ESC c).
   */
  public reset(): void {
    /**
     * Since _setup handles a full terminal creation, we have to carry forward
     * a few things that should not reset.
     */
    this.options.rows = this.rows;
    this.options.cols = this.cols;

    this._setup();
    super.reset();
  }
}
