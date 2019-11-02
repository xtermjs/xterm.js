/**
 * Copyright (c) 2014 The xterm.js authors. All rights reserved.
 * Copyright (c) 2012-2013, Christopher Jeffrey (MIT License)
 * @license MIT
 */

import { IInputHandler, IInputHandlingTerminal } from './Types';
import { C0, C1 } from 'common/data/EscapeSequences';
import { CHARSETS, DEFAULT_CHARSET } from 'common/data/Charsets';
import { wcwidth } from 'common/CharWidth';
import { EscapeSequenceParser } from 'common/parser/EscapeSequenceParser';
import { Disposable } from 'common/Lifecycle';
import { concat } from 'common/TypedArrayUtils';
import { StringToUtf32, stringFromCodePoint, utf32ToString, Utf8ToUtf32 } from 'common/input/TextDecoder';
import { DEFAULT_ATTR_DATA } from 'common/buffer/BufferLine';
import { EventEmitter, IEvent } from 'common/EventEmitter';
import { IParsingState, IDcsHandler, IEscapeSequenceParser, IParams, IFunctionIdentifier } from 'common/parser/Types';
import { NULL_CELL_CODE, NULL_CELL_WIDTH, Attributes, FgFlags, BgFlags, Content } from 'common/buffer/Constants';
import { CellData } from 'common/buffer/CellData';
import { AttributeData } from 'common/buffer/AttributeData';
import { IAttributeData, IDisposable } from 'common/Types';
import { ICoreService, IBufferService, IOptionsService, ILogService, IDirtyRowService, ICoreMouseService } from 'common/services/Services';
import { OscHandler } from 'common/parser/OscParser';
import { DcsHandler } from 'common/parser/DcsParser';

/**
 * Map collect to glevel. Used in `selectCharset`.
 */
const GLEVEL: {[key: string]: number} = {'(': 0, ')': 1, '*': 2, '+': 3, '-': 1, '.': 2};

/**
 * Max length of the UTF32 input buffer. Real memory consumption is 4 times higher.
 */
const MAX_PARSEBUFFER_LENGTH = 131072;


/**
 * DCS subparser implementations
 */

/**
 * DCS $ q Pt ST
 *   DECRQSS (https://vt100.net/docs/vt510-rm/DECRQSS.html)
 *   Request Status String (DECRQSS), VT420 and up.
 *   Response: DECRPSS (https://vt100.net/docs/vt510-rm/DECRPSS.html)
 */
class DECRQSS implements IDcsHandler {
  private _data: Uint32Array = new Uint32Array(0);

  constructor(
    private _bufferService: IBufferService,
    private _coreService: ICoreService,
    private _logService: ILogService,
    private _optionsService: IOptionsService
  ) { }

  hook(params: IParams): void {
    this._data = new Uint32Array(0);
  }

  put(data: Uint32Array, start: number, end: number): void {
    this._data = concat(this._data, data.subarray(start, end));
  }

  unhook(success: boolean): void {
    if (!success) {
      this._data = new Uint32Array(0);
      return;
    }
    const data = utf32ToString(this._data);
    this._data = new Uint32Array(0);
    switch (data) {
      // valid: DCS 1 $ r Pt ST (xterm)
      case '"q': // DECSCA
        return this._coreService.triggerDataEvent(`${C0.ESC}P1$r0"q${C0.ESC}\\`);
      case '"p': // DECSCL
        return this._coreService.triggerDataEvent(`${C0.ESC}P1$r61"p${C0.ESC}\\`);
      case 'r': // DECSTBM
        const pt = '' + (this._bufferService.buffer.scrollTop + 1) +
                ';' + (this._bufferService.buffer.scrollBottom + 1) + 'r';
        return this._coreService.triggerDataEvent(`${C0.ESC}P1$r${pt}${C0.ESC}\\`);
      case 'm': // SGR
        // TODO: report real settings instead of 0m
        return this._coreService.triggerDataEvent(`${C0.ESC}P1$r0m${C0.ESC}\\`);
      case ' q': // DECSCUSR
        const STYLES: {[key: string]: number} = {'block': 2, 'underline': 4, 'bar': 6};
        let style = STYLES[this._optionsService.options.cursorStyle];
        style -= this._optionsService.options.cursorBlink ? 1 : 0;
        return this._coreService.triggerDataEvent(`${C0.ESC}P1$r${style} q${C0.ESC}\\`);
      default:
        // invalid: DCS 0 $ r Pt ST (xterm)
        this._logService.debug('Unknown DCS $q %s', data);
        this._coreService.triggerDataEvent(`${C0.ESC}P0$r${C0.ESC}\\`);
    }
  }
}

/**
 * DCS Ps; Ps| Pt ST
 *   DECUDK (https://vt100.net/docs/vt510-rm/DECUDK.html)
 *   not supported
 */

/**
 * DCS + q Pt ST (xterm)
 *   Request Terminfo String
 *   not implemented
 */

/**
 * DCS + p Pt ST (xterm)
 *   Set Terminfo Data
 *   not supported
 */



/**
 * The terminal's standard implementation of IInputHandler, this handles all
 * input from the Parser.
 *
 * Refer to http://invisible-island.net/xterm/ctlseqs/ctlseqs.html to understand
 * each function's header comment.
 */
export class InputHandler extends Disposable implements IInputHandler {
  private _parseBuffer: Uint32Array = new Uint32Array(4096);
  private _stringDecoder: StringToUtf32 = new StringToUtf32();
  private _utf8Decoder: Utf8ToUtf32 = new Utf8ToUtf32();
  private _workCell: CellData = new CellData();

  private _onCursorMove = new EventEmitter<void>();
  public get onCursorMove(): IEvent<void> { return this._onCursorMove.event; }
  private _onLineFeed = new EventEmitter<void>();
  public get onLineFeed(): IEvent<void> { return this._onLineFeed.event; }
  private _onScroll = new EventEmitter<number>();
  public get onScroll(): IEvent<number> { return this._onScroll.event; }

  constructor(
    protected _terminal: IInputHandlingTerminal,
    private readonly _bufferService: IBufferService,
    private readonly _coreService: ICoreService,
    private readonly _dirtyRowService: IDirtyRowService,
    private readonly _logService: ILogService,
    private readonly _optionsService: IOptionsService,
    private readonly _coreMouseService: ICoreMouseService,
    private readonly _parser: IEscapeSequenceParser = new EscapeSequenceParser())
  {
    super();

    this.register(this._parser);

    /**
     * custom fallback handlers
     */
    this._parser.setCsiHandlerFallback((ident, params) => {
      this._logService.debug('Unknown CSI code: ', { identifier: this._parser.identToString(ident), params: params.toArray() });
    });
    this._parser.setEscHandlerFallback(ident => {
      this._logService.debug('Unknown ESC code: ', { identifier: this._parser.identToString(ident) });
    });
    this._parser.setExecuteHandlerFallback(code => {
      this._logService.debug('Unknown EXECUTE code: ', { code });
    });
    this._parser.setOscHandlerFallback((identifier, action, data) => {
      this._logService.debug('Unknown OSC code: ', { identifier, action, data });
    });
    this._parser.setDcsHandlerFallback((ident, action, payload) => {
      if (action === 'HOOK') {
        payload = payload.toArray();
      }
      this._logService.debug('Unknown DCS code: ', { identifier: this._parser.identToString(ident), action, payload });
    });

    /**
     * print handler
     */
    this._parser.setPrintHandler((data, start, end) => this.print(data, start, end));

    /**
     * CSI handler
     */
    this._parser.setCsiHandler({final: '@'}, params => this.insertChars(params));
    this._parser.setCsiHandler({intermediates: ' ', final: '@'}, params => this.scrollLeft(params));
    this._parser.setCsiHandler({final: 'A'}, params => this.cursorUp(params));
    this._parser.setCsiHandler({intermediates: ' ', final: 'A'}, params => this.scrollRight(params));
    this._parser.setCsiHandler({final: 'B'}, params => this.cursorDown(params));
    this._parser.setCsiHandler({final: 'C'}, params => this.cursorForward(params));
    this._parser.setCsiHandler({final: 'D'}, params => this.cursorBackward(params));
    this._parser.setCsiHandler({final: 'E'}, params => this.cursorNextLine(params));
    this._parser.setCsiHandler({final: 'F'}, params => this.cursorPrecedingLine(params));
    this._parser.setCsiHandler({final: 'G'}, params => this.cursorCharAbsolute(params));
    this._parser.setCsiHandler({final: 'H'}, params => this.cursorPosition(params));
    this._parser.setCsiHandler({final: 'I'}, params => this.cursorForwardTab(params));
    this._parser.setCsiHandler({final: 'J'}, params => this.eraseInDisplay(params));
    this._parser.setCsiHandler({prefix: '?', final: 'J'}, params => this.eraseInDisplay(params));
    this._parser.setCsiHandler({final: 'K'}, params => this.eraseInLine(params));
    this._parser.setCsiHandler({prefix: '?', final: 'K'}, params => this.eraseInLine(params));
    this._parser.setCsiHandler({final: 'L'}, params => this.insertLines(params));
    this._parser.setCsiHandler({final: 'M'}, params => this.deleteLines(params));
    this._parser.setCsiHandler({final: 'P'}, params => this.deleteChars(params));
    this._parser.setCsiHandler({final: 'S'}, params => this.scrollUp(params));
    this._parser.setCsiHandler({final: 'T'}, params => this.scrollDown(params));
    this._parser.setCsiHandler({final: 'X'}, params => this.eraseChars(params));
    this._parser.setCsiHandler({final: 'Z'}, params => this.cursorBackwardTab(params));
    this._parser.setCsiHandler({final: '`'}, params => this.charPosAbsolute(params));
    this._parser.setCsiHandler({final: 'a'}, params => this.hPositionRelative(params));
    this._parser.setCsiHandler({final: 'b'}, params => this.repeatPrecedingCharacter(params));
    this._parser.setCsiHandler({final: 'c'}, params => this.sendDeviceAttributesPrimary(params));
    this._parser.setCsiHandler({prefix: '>', final: 'c'}, params => this.sendDeviceAttributesSecondary(params));
    this._parser.setCsiHandler({final: 'd'}, params => this.linePosAbsolute(params));
    this._parser.setCsiHandler({final: 'e'}, params => this.vPositionRelative(params));
    this._parser.setCsiHandler({final: 'f'}, params => this.hVPosition(params));
    this._parser.setCsiHandler({final: 'g'}, params => this.tabClear(params));
    this._parser.setCsiHandler({final: 'h'}, params => this.setMode(params));
    this._parser.setCsiHandler({prefix: '?', final: 'h'}, params => this.setModePrivate(params));
    this._parser.setCsiHandler({final: 'l'}, params => this.resetMode(params));
    this._parser.setCsiHandler({prefix: '?', final: 'l'}, params => this.resetModePrivate(params));
    this._parser.setCsiHandler({final: 'm'}, params => this.charAttributes(params));
    this._parser.setCsiHandler({final: 'n'}, params => this.deviceStatus(params));
    this._parser.setCsiHandler({prefix: '?', final: 'n'}, params => this.deviceStatusPrivate(params));
    this._parser.setCsiHandler({intermediates: '!', final: 'p'}, params => this.softReset(params));
    this._parser.setCsiHandler({intermediates: ' ', final: 'q'}, params => this.setCursorStyle(params));
    this._parser.setCsiHandler({final: 'r'}, params => this.setScrollRegion(params));
    this._parser.setCsiHandler({final: 's'}, params => this.saveCursor(params));
    this._parser.setCsiHandler({final: 'u'}, params => this.restoreCursor(params));
    this._parser.setCsiHandler({intermediates: '\'', final: '}'}, params => this.insertColumns(params));
    this._parser.setCsiHandler({intermediates: '\'', final: '~'}, params => this.deleteColumns(params));

    /**
     * execute handler
     */
    this._parser.setExecuteHandler(C0.BEL, () => this.bell());
    this._parser.setExecuteHandler(C0.LF, () => this.lineFeed());
    this._parser.setExecuteHandler(C0.VT, () => this.lineFeed());
    this._parser.setExecuteHandler(C0.FF, () => this.lineFeed());
    this._parser.setExecuteHandler(C0.CR, () => this.carriageReturn());
    this._parser.setExecuteHandler(C0.BS, () => this.backspace());
    this._parser.setExecuteHandler(C0.HT, () => this.tab());
    this._parser.setExecuteHandler(C0.SO, () => this.shiftOut());
    this._parser.setExecuteHandler(C0.SI, () => this.shiftIn());
    // FIXME:   What do to with missing? Old code just added those to print.

    this._parser.setExecuteHandler(C1.IND, () => this.index());
    this._parser.setExecuteHandler(C1.NEL, () => this.nextLine());
    this._parser.setExecuteHandler(C1.HTS, () => this.tabSet());

    /**
     * OSC handler
     */
    //   0 - icon name + title
    this._parser.setOscHandler(0, new OscHandler((data: string) => this.setTitle(data)));
    //   1 - icon name
    //   2 - title
    this._parser.setOscHandler(2, new OscHandler((data: string) => this.setTitle(data)));
    //   3 - set property X in the form "prop=value"
    //   4 - Change Color Number
    //   5 - Change Special Color Number
    //   6 - Enable/disable Special Color Number c
    //   7 - current directory? (not in xterm spec, see https://gitlab.com/gnachman/iterm2/issues/3939)
    //  10 - Change VT100 text foreground color to Pt.
    //  11 - Change VT100 text background color to Pt.
    //  12 - Change text cursor color to Pt.
    //  13 - Change mouse foreground color to Pt.
    //  14 - Change mouse background color to Pt.
    //  15 - Change Tektronix foreground color to Pt.
    //  16 - Change Tektronix background color to Pt.
    //  17 - Change highlight background color to Pt.
    //  18 - Change Tektronix cursor color to Pt.
    //  19 - Change highlight foreground color to Pt.
    //  46 - Change Log File to Pt.
    //  50 - Set Font to Pt.
    //  51 - reserved for Emacs shell.
    //  52 - Manipulate Selection Data.
    // 104 ; c - Reset Color Number c.
    // 105 ; c - Reset Special Color Number c.
    // 106 ; c; f - Enable/disable Special Color Number c.
    // 110 - Reset VT100 text foreground color.
    // 111 - Reset VT100 text background color.
    // 112 - Reset text cursor color.
    // 113 - Reset mouse foreground color.
    // 114 - Reset mouse background color.
    // 115 - Reset Tektronix foreground color.
    // 116 - Reset Tektronix background color.
    // 117 - Reset highlight color.
    // 118 - Reset Tektronix cursor color.
    // 119 - Reset highlight foreground color.

    /**
     * ESC handlers
     */
    this._parser.setEscHandler({final: '7'}, () => this.saveCursor());
    this._parser.setEscHandler({final: '8'}, () => this.restoreCursor());
    this._parser.setEscHandler({final: 'D'}, () => this.index());
    this._parser.setEscHandler({final: 'E'}, () => this.nextLine());
    this._parser.setEscHandler({final: 'H'}, () => this.tabSet());
    this._parser.setEscHandler({final: 'M'}, () => this.reverseIndex());
    this._parser.setEscHandler({final: '='}, () => this.keypadApplicationMode());
    this._parser.setEscHandler({final: '>'}, () => this.keypadNumericMode());
    this._parser.setEscHandler({final: 'c'}, () => this.reset());
    this._parser.setEscHandler({final: 'n'}, () => this.setgLevel(2));
    this._parser.setEscHandler({final: 'o'}, () => this.setgLevel(3));
    this._parser.setEscHandler({final: '|'}, () => this.setgLevel(3));
    this._parser.setEscHandler({final: '}'}, () => this.setgLevel(2));
    this._parser.setEscHandler({final: '~'}, () => this.setgLevel(1));
    this._parser.setEscHandler({intermediates: '%', final: '@'}, () => this.selectDefaultCharset());
    this._parser.setEscHandler({intermediates: '%', final: 'G'}, () => this.selectDefaultCharset());
    for (const flag in CHARSETS) {
      this._parser.setEscHandler({intermediates: '(', final: flag}, () => this.selectCharset('(' + flag));
      this._parser.setEscHandler({intermediates: ')', final: flag}, () => this.selectCharset(')' + flag));
      this._parser.setEscHandler({intermediates: '*', final: flag}, () => this.selectCharset('*' + flag));
      this._parser.setEscHandler({intermediates: '+', final: flag}, () => this.selectCharset('+' + flag));
      this._parser.setEscHandler({intermediates: '-', final: flag}, () => this.selectCharset('-' + flag));
      this._parser.setEscHandler({intermediates: '.', final: flag}, () => this.selectCharset('.' + flag));
      this._parser.setEscHandler({intermediates: '/', final: flag}, () => this.selectCharset('/' + flag)); // TODO: supported?
    }
    this._parser.setEscHandler({intermediates: '#', final: '8'}, () => this.screenAlignmentPattern());

    /**
     * error handler
     */
    this._parser.setErrorHandler((state: IParsingState) => {
      this._logService.error('Parsing error: ', state);
      return state;
    });

    /**
     * DCS handler
     */
    this._parser.setDcsHandler({intermediates: '$', final: 'q'}, new DECRQSS(this._bufferService, this._coreService, this._logService, this._optionsService));
  }

  public dispose(): void {
    super.dispose();
  }

  public parse(data: string | Uint8Array): void {
    let buffer = this._bufferService.buffer;
    const cursorStartX = buffer.x;
    const cursorStartY = buffer.y;

    this._logService.debug('parsing data', data);

    // resize input buffer if needed
    if (this._parseBuffer.length < data.length) {
      if (this._parseBuffer.length < MAX_PARSEBUFFER_LENGTH) {
        this._parseBuffer = new Uint32Array(Math.min(data.length, MAX_PARSEBUFFER_LENGTH));
      }
    }

    // process big data in smaller chunks
    if (data.length > MAX_PARSEBUFFER_LENGTH) {
      for (let i = 0; i < data.length; i += MAX_PARSEBUFFER_LENGTH) {
        const end = i + MAX_PARSEBUFFER_LENGTH < data.length ? i + MAX_PARSEBUFFER_LENGTH : data.length;
        const len = (typeof data === 'string')
          ? this._stringDecoder.decode(data.substring(i, end), this._parseBuffer)
          : this._utf8Decoder.decode(data.subarray(i, end), this._parseBuffer);
        this._parser.parse(this._parseBuffer, len);
      }
    } else {
      const len = (typeof data === 'string')
        ? this._stringDecoder.decode(data, this._parseBuffer)
        : this._utf8Decoder.decode(data, this._parseBuffer);
      this._parser.parse(this._parseBuffer, len);
    }

    buffer = this._bufferService.buffer;
    if (buffer.x !== cursorStartX || buffer.y !== cursorStartY) {
      this._onCursorMove.fire();
    }
    this._terminal.refresh(this._dirtyRowService.start, this._dirtyRowService.end);
  }

  public print(data: Uint32Array, start: number, end: number): void {
    let code: number;
    let chWidth: number;
    const buffer = this._bufferService.buffer;
    const charset = this._terminal.charset;
    const screenReaderMode = this._optionsService.options.screenReaderMode;
    const cols = this._bufferService.cols;
    const wraparoundMode = this._terminal.wraparoundMode;
    const insertMode = this._terminal.insertMode;
    const curAttr = this._terminal.curAttrData;
    let bufferRow = buffer.lines.get(buffer.y + buffer.ybase);

    this._dirtyRowService.markDirty(buffer.y);
    for (let pos = start; pos < end; ++pos) {
      code = data[pos];

      // calculate print space
      // expensive call, therefore we save width in line buffer
      chWidth = wcwidth(code);

      // get charset replacement character
      // charset is only defined for ASCII, therefore we only
      // search for an replacement char if code < 127
      if (code < 127 && charset) {
        const ch = charset[String.fromCharCode(code)];
        if (ch) {
          code = ch.charCodeAt(0);
        }
      }

      if (screenReaderMode) {
        this._terminal.onA11yCharEmitter.fire(stringFromCodePoint(code));
      }

      // insert combining char at last cursor position
      // FIXME: needs handling after cursor jumps
      // buffer.x should never be 0 for a combining char
      // since they always follow a cell consuming char
      // therefore we can test for buffer.x to avoid overflow left
      if (!chWidth && buffer.x) {
        if (!bufferRow.getWidth(buffer.x - 1)) {
          // found empty cell after fullwidth, need to go 2 cells back
          // it is save to step 2 cells back here
          // since an empty cell is only set by fullwidth chars
          bufferRow.addCodepointToCell(buffer.x - 2, code);
        } else {
          bufferRow.addCodepointToCell(buffer.x - 1, code);
        }
        continue;
      }

      // goto next line if ch would overflow
      // TODO: needs a global min terminal width of 2
      // FIXME: additionally ensure chWidth fits into a line
      //   -->  maybe forbid cols<xy at higher level as it would
      //        introduce a bad runtime penalty here
      if (buffer.x + chWidth - 1 >= cols) {
        // autowrap - DECAWM
        // automatically wraps to the beginning of the next line
        if (wraparoundMode) {
          buffer.x = 0;
          buffer.y++;
          if (buffer.y === buffer.scrollBottom + 1) {
            buffer.y--;
            this._terminal.scroll(true);
          } else {
            if (buffer.y >= this._bufferService.rows) {
              buffer.y = this._bufferService.rows - 1;
            }
            // The line already exists (eg. the initial viewport), mark it as a
            // wrapped line
            buffer.lines.get(buffer.y).isWrapped = true;
          }
          // row changed, get it again
          bufferRow = buffer.lines.get(buffer.y + buffer.ybase);
        } else {
          buffer.x = cols - 1;
          if (chWidth === 2) {
            // FIXME: check for xterm behavior
            // What to do here? We got a wide char that does not fit into last cell
            continue;
          }
        }
      }

      // insert mode: move characters to right
      if (insertMode) {
        // right shift cells according to the width
        bufferRow.insertCells(buffer.x, chWidth, buffer.getNullCell(curAttr));
        // test last cell - since the last cell has only room for
        // a halfwidth char any fullwidth shifted there is lost
        // and will be set to empty cell
        if (bufferRow.getWidth(cols - 1) === 2) {
          bufferRow.setCellFromCodePoint(cols - 1, NULL_CELL_CODE, NULL_CELL_WIDTH, curAttr.fg, curAttr.bg);
        }
      }

      // write current char to buffer and advance cursor
      bufferRow.setCellFromCodePoint(buffer.x++, code, chWidth, curAttr.fg, curAttr.bg);

      // fullwidth char - also set next cell to placeholder stub and advance cursor
      // for graphemes bigger than fullwidth we can simply loop to zero
      // we already made sure above, that buffer.x + chWidth will not overflow right
      if (chWidth > 0) {
        while (--chWidth) {
          // other than a regular empty cell a cell following a wide char has no width
          bufferRow.setCellFromCodePoint(buffer.x++, 0, 0, curAttr.fg, curAttr.bg);
        }
      }
    }
    // store last char in Parser.precedingCodepoint for REP to work correctly
    // This needs to check whether:
    //  - fullwidth + surrogates: reset
    //  - combining: only base char gets carried on (bug in xterm?)
    if (end) {
      bufferRow.loadCell(buffer.x - 1, this._workCell);
      if (this._workCell.getWidth() === 2 || this._workCell.getCode() > 0xFFFF) {
        this._parser.precedingCodepoint = 0;
      } else if (this._workCell.isCombined()) {
        this._parser.precedingCodepoint = this._workCell.getChars().charCodeAt(0);
      } else {
        this._parser.precedingCodepoint = this._workCell.content;
      }
    }
    this._dirtyRowService.markDirty(buffer.y);
  }

  /**
   * Forward addCsiHandler from parser.
   */
  public addCsiHandler(id: IFunctionIdentifier, callback: (params: IParams) => boolean): IDisposable {
    return this._parser.addCsiHandler(id, callback);
  }

  /**
   * Forward addDcsHandler from parser.
   */
  public addDcsHandler(id: IFunctionIdentifier, callback: (data: string, param: IParams) => boolean): IDisposable {
    return this._parser.addDcsHandler(id, new DcsHandler(callback));
  }

  /**
   * Forward addEscHandler from parser.
   */
  public addEscHandler(id: IFunctionIdentifier, callback: () => boolean): IDisposable {
    return this._parser.addEscHandler(id, callback);
  }

  /**
   * Forward addOscHandler from parser.
   */
  public addOscHandler(ident: number, callback: (data: string) => boolean): IDisposable {
    return this._parser.addOscHandler(ident, new OscHandler(callback));
  }

  /**
   * BEL
   * Bell (Ctrl-G).
   */
  public bell(): void {
    this._terminal.bell();
  }

  /**
   * LF
   * Line Feed or New Line (NL).  (LF  is Ctrl-J).
   */
  public lineFeed(): void {
    // make buffer local for faster access
    const buffer = this._bufferService.buffer;

    if (this._optionsService.options.convertEol) {
      buffer.x = 0;
    }
    buffer.y++;
    if (buffer.y === buffer.scrollBottom + 1) {
      buffer.y--;
      this._terminal.scroll();
    } else if (buffer.y >= this._bufferService.rows) {
      buffer.y = this._bufferService.rows - 1;
    }
    // If the end of the line is hit, prevent this action from wrapping around to the next line.
    if (buffer.x >= this._bufferService.cols) {
      buffer.x--;
    }

    this._onLineFeed.fire();
  }

  /**
   * CR
   * Carriage Return (Ctrl-M).
   */
  public carriageReturn(): void {
    this._bufferService.buffer.x = 0;
  }

  /**
   * BS
   * Backspace (Ctrl-H).
   */
  public backspace(): void {
    this._restrictCursor();
    if (this._bufferService.buffer.x > 0) {
      this._bufferService.buffer.x--;
    }
  }

  /**
   * TAB
   * Horizontal Tab (HT) (Ctrl-I).
   */
  public tab(): void {
    if (this._bufferService.buffer.x >= this._bufferService.cols) {
      return;
    }
    const originalX = this._bufferService.buffer.x;
    this._bufferService.buffer.x = this._bufferService.buffer.nextStop();
    if (this._optionsService.options.screenReaderMode) {
      this._terminal.onA11yTabEmitter.fire(this._bufferService.buffer.x - originalX);
    }
  }

  /**
   * SO
   * Shift Out (Ctrl-N) -> Switch to Alternate Character Set.  This invokes the
   * G1 character set.
   */
  public shiftOut(): void {
    this._terminal.setgLevel(1);
  }

  /**
   * SI
   * Shift In (Ctrl-O) -> Switch to Standard Character Set.  This invokes the G0
   * character set (the default).
   */
  public shiftIn(): void {
    this._terminal.setgLevel(0);
  }

  /**
   * Restrict cursor to viewport size / scroll margin (origin mode).
   */
  private _restrictCursor(): void {
    this._bufferService.buffer.x = Math.min(this._bufferService.cols - 1, Math.max(0, this._bufferService.buffer.x));
    this._bufferService.buffer.y = this._terminal.originMode
      ? Math.min(this._bufferService.buffer.scrollBottom, Math.max(this._bufferService.buffer.scrollTop, this._bufferService.buffer.y))
      : Math.min(this._bufferService.rows - 1, Math.max(0, this._bufferService.buffer.y));
  }

  /**
   * Set absolute cursor position.
   */
  private _setCursor(x: number, y: number): void {
    if (this._terminal.originMode) {
      this._bufferService.buffer.x = x;
      this._bufferService.buffer.y = this._bufferService.buffer.scrollTop + y;
    } else {
      this._bufferService.buffer.x = x;
      this._bufferService.buffer.y = y;
    }
    this._restrictCursor();
  }

  /**
   * Set relative cursor position.
   */
  private _moveCursor(x: number, y: number): void {
    // for relative changes we have to make sure we are within 0 .. cols/rows - 1
    // before calculating the new position
    this._restrictCursor();
    this._setCursor(this._bufferService.buffer.x + x, this._bufferService.buffer.y + y);
  }

  /**
   * CSI Ps A
   * Cursor Up Ps Times (default = 1) (CUU).
   */
  public cursorUp(params: IParams): void {
    // stop at scrollTop
    const diffToTop = this._bufferService.buffer.y - this._bufferService.buffer.scrollTop;
    if (diffToTop >= 0) {
      this._moveCursor(0, -Math.min(diffToTop, params.params[0] || 1));
    } else {
      this._moveCursor(0, -(params.params[0] || 1));
    }
  }

  /**
   * CSI Ps B
   * Cursor Down Ps Times (default = 1) (CUD).
   */
  public cursorDown(params: IParams): void {
    // stop at scrollBottom
    const diffToBottom = this._bufferService.buffer.scrollBottom - this._bufferService.buffer.y;
    if (diffToBottom >= 0) {
      this._moveCursor(0, Math.min(diffToBottom, params.params[0] || 1));
    } else {
      this._moveCursor(0, params.params[0] || 1);
    }
  }

  /**
   * CSI Ps C
   * Cursor Forward Ps Times (default = 1) (CUF).
   */
  public cursorForward(params: IParams): void {
    this._moveCursor(params.params[0] || 1, 0);
  }

  /**
   * CSI Ps D
   * Cursor Backward Ps Times (default = 1) (CUB).
   */
  public cursorBackward(params: IParams): void {
    this._moveCursor(-(params.params[0] || 1), 0);
  }

  /**
   * CSI Ps E
   * Cursor Next Line Ps Times (default = 1) (CNL).
   * Other than cursorDown (CUD) also set the cursor to first column.
   */
  public cursorNextLine(params: IParams): void {
    this.cursorDown(params);
    this._bufferService.buffer.x = 0;
  }

  /**
   * CSI Ps F
   * Cursor Previous Line Ps Times (default = 1) (CPL).
   * Other than cursorUp (CUU) also set the cursor to first column.
   */
  public cursorPrecedingLine(params: IParams): void {
    this.cursorUp(params);
    this._bufferService.buffer.x = 0;
  }

  /**
   * CSI Ps G
   * Cursor Character Absolute  [column] (default = [row,1]) (CHA).
   */
  public cursorCharAbsolute(params: IParams): void {
    this._setCursor((params.params[0] || 1) - 1, this._bufferService.buffer.y);
  }

  /**
   * CSI Ps ; Ps H
   * Cursor Position [row;column] (default = [1,1]) (CUP).
   */
  public cursorPosition(params: IParams): void {
    this._setCursor(
      // col
      (params.length >= 2) ? (params.params[1] || 1) - 1 : 0,
      // row
      (params.params[0] || 1) - 1);
  }

  /**
   * CSI Pm `  Character Position Absolute
   *   [column] (default = [row,1]) (HPA).
   * Currently same functionality as CHA.
   */
  public charPosAbsolute(params: IParams): void {
    this._setCursor((params.params[0] || 1) - 1, this._bufferService.buffer.y);
  }

  /**
   * CSI Pm a  Character Position Relative
   *   [columns] (default = [row,col+1]) (HPR)
   * Currently same functionality as CUF.
   */
  public hPositionRelative(params: IParams): void {
    this._moveCursor(params.params[0] || 1, 0);
  }

  /**
   * CSI Pm d  Vertical Position Absolute (VPA)
   *   [row] (default = [1,column])
   */
  public linePosAbsolute(params: IParams): void {
    this._setCursor(this._bufferService.buffer.x, (params.params[0] || 1) - 1);
  }

  /**
   * CSI Pm e  Vertical Position Relative (VPR)
   *   [rows] (default = [row+1,column])
   * reuse CSI Ps B ?
   */
  public vPositionRelative(params: IParams): void {
    this._moveCursor(0, params.params[0] || 1);
  }

  /**
   * CSI Ps ; Ps f
   *   Horizontal and Vertical Position [row;column] (default =
   *   [1,1]) (HVP).
   *   Same as CUP.
   */
  public hVPosition(params: IParams): void {
    this.cursorPosition(params);
  }

  /**
   * CSI Ps g  Tab Clear (TBC).
   *     Ps = 0  -> Clear Current Column (default).
   *     Ps = 3  -> Clear All.
   * Potentially:
   *   Ps = 2  -> Clear Stops on Line.
   *   http://vt100.net/annarbor/aaa-ug/section6.html
   */
  public tabClear(params: IParams): void {
    const param = params.params[0];
    if (param === 0) {
      delete this._bufferService.buffer.tabs[this._bufferService.buffer.x];
    } else if (param === 3) {
      this._bufferService.buffer.tabs = {};
    }
  }

  /**
   * CSI Ps I
   *   Cursor Forward Tabulation Ps tab stops (default = 1) (CHT).
   */
  public cursorForwardTab(params: IParams): void {
    if (this._bufferService.buffer.x >= this._bufferService.cols) {
      return;
    }
    let param = params.params[0] || 1;
    while (param--) {
      this._bufferService.buffer.x = this._bufferService.buffer.nextStop();
    }
  }

  /**
   * CSI Ps Z  Cursor Backward Tabulation Ps tab stops (default = 1) (CBT).
   */
  public cursorBackwardTab(params: IParams): void {
    if (this._bufferService.buffer.x >= this._bufferService.cols) {
      return;
    }
    let param = params.params[0] || 1;

    // make buffer local for faster access
    const buffer = this._bufferService.buffer;

    while (param--) {
      buffer.x = buffer.prevStop();
    }
  }


  /**
   * Helper method to erase cells in a terminal row.
   * The cell gets replaced with the eraseChar of the terminal.
   * @param y row index
   * @param start first cell index to be erased
   * @param end   end - 1 is last erased cell
   */
  private _eraseInBufferLine(y: number, start: number, end: number, clearWrap: boolean = false): void {
    const line = this._bufferService.buffer.lines.get(this._bufferService.buffer.ybase + y);
    line.replaceCells(
      start,
      end,
      this._bufferService.buffer.getNullCell(this._terminal.eraseAttrData())
    );
    if (clearWrap) {
      line.isWrapped = false;
    }
  }

  /**
   * Helper method to reset cells in a terminal row.
   * The cell gets replaced with the eraseChar of the terminal and the isWrapped property is set to false.
   * @param y row index
   */
  private _resetBufferLine(y: number): void {
    const line = this._bufferService.buffer.lines.get(this._bufferService.buffer.ybase + y);
    line.fill(this._bufferService.buffer.getNullCell(this._terminal.eraseAttrData()));
    line.isWrapped = false;
  }

  /**
   * CSI Ps J  Erase in Display (ED).
   *     Ps = 0  -> Erase Below (default).
   *     Ps = 1  -> Erase Above.
   *     Ps = 2  -> Erase All.
   *     Ps = 3  -> Erase Saved Lines (xterm).
   * CSI ? Ps J
   *   Erase in Display (DECSED).
   *     Ps = 0  -> Selective Erase Below (default).
   *     Ps = 1  -> Selective Erase Above.
   *     Ps = 2  -> Selective Erase All.
   */
  public eraseInDisplay(params: IParams): void {
    this._restrictCursor();
    let j;
    switch (params.params[0]) {
      case 0:
        j = this._bufferService.buffer.y;
        this._dirtyRowService.markDirty(j);
        this._eraseInBufferLine(j++, this._bufferService.buffer.x, this._bufferService.cols, this._bufferService.buffer.x === 0);
        for (; j < this._bufferService.rows; j++) {
          this._resetBufferLine(j);
        }
        this._dirtyRowService.markDirty(j);
        break;
      case 1:
        j = this._bufferService.buffer.y;
        this._dirtyRowService.markDirty(j);
        // Deleted front part of line and everything before. This line will no longer be wrapped.
        this._eraseInBufferLine(j, 0, this._bufferService.buffer.x + 1, true);
        if (this._bufferService.buffer.x + 1 >= this._bufferService.cols) {
          // Deleted entire previous line. This next line can no longer be wrapped.
          this._bufferService.buffer.lines.get(j + 1).isWrapped = false;
        }
        while (j--) {
          this._resetBufferLine(j);
        }
        this._dirtyRowService.markDirty(0);
        break;
      case 2:
        j = this._bufferService.rows;
        this._dirtyRowService.markDirty(j - 1);
        while (j--) {
          this._resetBufferLine(j);
        }
        this._dirtyRowService.markDirty(0);
        break;
      case 3:
        // Clear scrollback (everything not in viewport)
        const scrollBackSize = this._bufferService.buffer.lines.length - this._bufferService.rows;
        if (scrollBackSize > 0) {
          this._bufferService.buffer.lines.trimStart(scrollBackSize);
          this._bufferService.buffer.ybase = Math.max(this._bufferService.buffer.ybase - scrollBackSize, 0);
          this._bufferService.buffer.ydisp = Math.max(this._bufferService.buffer.ydisp - scrollBackSize, 0);
          // Force a scroll event to refresh viewport
          this._onScroll.fire(0);
        }
        break;
    }
  }

  /**
   * CSI Ps K  Erase in Line (EL).
   *     Ps = 0  -> Erase to Right (default).
   *     Ps = 1  -> Erase to Left.
   *     Ps = 2  -> Erase All.
   * CSI ? Ps K
   *   Erase in Line (DECSEL).
   *     Ps = 0  -> Selective Erase to Right (default).
   *     Ps = 1  -> Selective Erase to Left.
   *     Ps = 2  -> Selective Erase All.
   */
  public eraseInLine(params: IParams): void {
    this._restrictCursor();
    switch (params.params[0]) {
      case 0:
        this._eraseInBufferLine(this._bufferService.buffer.y, this._bufferService.buffer.x, this._bufferService.cols);
        break;
      case 1:
        this._eraseInBufferLine(this._bufferService.buffer.y, 0, this._bufferService.buffer.x + 1);
        break;
      case 2:
        this._eraseInBufferLine(this._bufferService.buffer.y, 0, this._bufferService.cols);
        break;
    }
    this._dirtyRowService.markDirty(this._bufferService.buffer.y);
  }

  /**
   * CSI Ps L
   * Insert Ps Line(s) (default = 1) (IL).
   */
  public insertLines(params: IParams): void {
    this._restrictCursor();
    let param = params.params[0] || 1;

    // make buffer local for faster access
    const buffer = this._bufferService.buffer;

    if (buffer.y > buffer.scrollBottom || buffer.y < buffer.scrollTop) {
      return;
    }

    const row: number = buffer.y + buffer.ybase;

    const scrollBottomRowsOffset = this._bufferService.rows - 1 - buffer.scrollBottom;
    const scrollBottomAbsolute = this._bufferService.rows - 1 + buffer.ybase - scrollBottomRowsOffset + 1;
    while (param--) {
      // test: echo -e '\e[44m\e[1L\e[0m'
      // blankLine(true) - xterm/linux behavior
      buffer.lines.splice(scrollBottomAbsolute - 1, 1);
      buffer.lines.splice(row, 0, buffer.getBlankLine(this._terminal.eraseAttrData()));
    }

    this._dirtyRowService.markRangeDirty(buffer.y, buffer.scrollBottom);
    buffer.x = 0; // see https://vt100.net/docs/vt220-rm/chapter4.html - vt220 only?
  }

  /**
   * CSI Ps M
   * Delete Ps Line(s) (default = 1) (DL).
   */
  public deleteLines(params: IParams): void {
    this._restrictCursor();
    let param = params.params[0] || 1;

    // make buffer local for faster access
    const buffer = this._bufferService.buffer;

    if (buffer.y > buffer.scrollBottom || buffer.y < buffer.scrollTop) {
      return;
    }

    const row: number = buffer.y + buffer.ybase;

    let j: number;
    j = this._bufferService.rows - 1 - buffer.scrollBottom;
    j = this._bufferService.rows - 1 + buffer.ybase - j;
    while (param--) {
      // test: echo -e '\e[44m\e[1M\e[0m'
      // blankLine(true) - xterm/linux behavior
      buffer.lines.splice(row, 1);
      buffer.lines.splice(j, 0, buffer.getBlankLine(this._terminal.eraseAttrData()));
    }

    this._dirtyRowService.markRangeDirty(buffer.y, buffer.scrollBottom);
    buffer.x = 0; // see https://vt100.net/docs/vt220-rm/chapter4.html - vt220 only?
  }

  /**
   * CSI Ps @
   * Insert Ps (Blank) Character(s) (default = 1) (ICH).
   */
  public insertChars(params: IParams): void {
    this._restrictCursor();
    const line = this._bufferService.buffer.lines.get(this._bufferService.buffer.y + this._bufferService.buffer.ybase);
    if (line) {
      line.insertCells(
        this._bufferService.buffer.x,
        params.params[0] || 1,
        this._bufferService.buffer.getNullCell(this._terminal.eraseAttrData())
      );
      this._dirtyRowService.markDirty(this._bufferService.buffer.y);
    }
  }

  /**
   * CSI Ps P
   * Delete Ps Character(s) (default = 1) (DCH).
   */
  public deleteChars(params: IParams): void {
    this._restrictCursor();
    const line = this._bufferService.buffer.lines.get(this._bufferService.buffer.y + this._bufferService.buffer.ybase);
    if (line) {
      line.deleteCells(
        this._bufferService.buffer.x,
        params.params[0] || 1,
        this._bufferService.buffer.getNullCell(this._terminal.eraseAttrData())
      );
      this._dirtyRowService.markDirty(this._bufferService.buffer.y);
    }
  }

  /**
   * CSI Ps S  Scroll up Ps lines (default = 1) (SU).
   */
  public scrollUp(params: IParams): void {
    let param = params.params[0] || 1;

    // make buffer local for faster access
    const buffer = this._bufferService.buffer;

    while (param--) {
      buffer.lines.splice(buffer.ybase + buffer.scrollTop, 1);
      buffer.lines.splice(buffer.ybase + buffer.scrollBottom, 0, buffer.getBlankLine(this._terminal.eraseAttrData()));
    }
    this._dirtyRowService.markRangeDirty(buffer.scrollTop, buffer.scrollBottom);
  }

  /**
   * CSI Ps T  Scroll down Ps lines (default = 1) (SD).
   */
  public scrollDown(params: IParams): void {
    let param = params.params[0] || 1;

    // make buffer local for faster access
    const buffer = this._bufferService.buffer;

    while (param--) {
      buffer.lines.splice(buffer.ybase + buffer.scrollBottom, 1);
      buffer.lines.splice(buffer.ybase + buffer.scrollTop, 0, buffer.getBlankLine(DEFAULT_ATTR_DATA));
    }
    this._dirtyRowService.markRangeDirty(buffer.scrollTop, buffer.scrollBottom);
  }

  /**
   * CSI Ps SP @  Scroll left Ps columns (default = 1) (SL) ECMA-48
   *
   * Notation: (Pn)
   * Representation: CSI Pn 02/00 04/00
   * Parameter default value: Pn = 1
   * SL causes the data in the presentation component to be moved by n character positions
   * if the line orientation is horizontal, or by n line positions if the line orientation
   * is vertical, such that the data appear to move to the left; where n equals the value of Pn.
   * The active presentation position is not affected by this control function.
   *
   * Supported:
   *   - always left shift (no line orientation setting respected)
   */
  public scrollLeft(params: IParams): void {
    const buffer = this._bufferService.buffer;
    if (buffer.y > buffer.scrollBottom || buffer.y < buffer.scrollTop) {
      return;
    }
    const param = params.params[0] || 1;
    for (let y = buffer.scrollTop; y <= buffer.scrollBottom; ++y) {
      const line = buffer.lines.get(buffer.ybase + y);
      line.deleteCells(0, param, buffer.getNullCell(this._terminal.eraseAttrData()));
      line.isWrapped = false;
    }
    this._dirtyRowService.markRangeDirty(buffer.scrollTop, buffer.scrollBottom);
  }

  /**
   * CSI Ps SP A  Scroll right Ps columns (default = 1) (SR) ECMA-48
   *
   * Notation: (Pn)
   * Representation: CSI Pn 02/00 04/01
   * Parameter default value: Pn = 1
   * SR causes the data in the presentation component to be moved by n character positions
   * if the line orientation is horizontal, or by n line positions if the line orientation
   * is vertical, such that the data appear to move to the right; where n equals the value of Pn.
   * The active presentation position is not affected by this control function.
   *
   * Supported:
   *   - always right shift (no line orientation setting respected)
   */
  public scrollRight(params: IParams): void {
    const buffer = this._bufferService.buffer;
    if (buffer.y > buffer.scrollBottom || buffer.y < buffer.scrollTop) {
      return;
    }
    const param = params.params[0] || 1;
    for (let y = buffer.scrollTop; y <= buffer.scrollBottom; ++y) {
      const line = buffer.lines.get(buffer.ybase + y);
      line.insertCells(0, param, buffer.getNullCell(this._terminal.eraseAttrData()));
      line.isWrapped = false;
    }
    this._dirtyRowService.markRangeDirty(buffer.scrollTop, buffer.scrollBottom);
  }

  /**
   * CSI Pm ' }
   * Insert Ps Column(s) (default = 1) (DECIC), VT420 and up.
   */
  public insertColumns(params: IParams): void {
    const buffer = this._bufferService.buffer;
    if (buffer.y > buffer.scrollBottom || buffer.y < buffer.scrollTop) {
      return;
    }
    const param = params.params[0] || 1;
    for (let y = buffer.scrollTop; y <= buffer.scrollBottom; ++y) {
      const line = this._bufferService.buffer.lines.get(buffer.ybase + y);
      line.insertCells(buffer.x, param, buffer.getNullCell(this._terminal.eraseAttrData()));
      line.isWrapped = false;
    }
    this._dirtyRowService.markRangeDirty(buffer.scrollTop, buffer.scrollBottom);
  }

  /**
   * CSI Pm ' ~
   * Delete Ps Column(s) (default = 1) (DECDC), VT420 and up.
   */
  public deleteColumns(params: IParams): void {
    const buffer = this._bufferService.buffer;
    if (buffer.y > buffer.scrollBottom || buffer.y < buffer.scrollTop) {
      return;
    }
    const param = params.params[0] || 1;
    for (let y = buffer.scrollTop; y <= buffer.scrollBottom; ++y) {
      const line = buffer.lines.get(buffer.ybase + y);
      line.deleteCells(buffer.x, param, buffer.getNullCell(this._terminal.eraseAttrData()));
      line.isWrapped = false;
    }
    this._dirtyRowService.markRangeDirty(buffer.scrollTop, buffer.scrollBottom);
  }

  /**
   * CSI Ps X
   * Erase Ps Character(s) (default = 1) (ECH).
   */
  public eraseChars(params: IParams): void {
    this._restrictCursor();
    const line = this._bufferService.buffer.lines.get(this._bufferService.buffer.y + this._bufferService.buffer.ybase);
    if (line) {
      line.replaceCells(
        this._bufferService.buffer.x,
        this._bufferService.buffer.x + (params.params[0] || 1),
        this._bufferService.buffer.getNullCell(this._terminal.eraseAttrData())
      );
      this._dirtyRowService.markDirty(this._bufferService.buffer.y);
    }
  }

  /**
   * CSI Ps b  Repeat the preceding graphic character Ps times (REP).
   * From ECMA 48 (@see http://www.ecma-international.org/publications/files/ECMA-ST/Ecma-048.pdf)
   *    Notation: (Pn)
   *    Representation: CSI Pn 06/02
   *    Parameter default value: Pn = 1
   *    REP is used to indicate that the preceding character in the data stream,
   *    if it is a graphic character (represented by one or more bit combinations) including SPACE,
   *    is to be repeated n times, where n equals the value of Pn.
   *    If the character preceding REP is a control function or part of a control function,
   *    the effect of REP is not defined by this Standard.
   *
   * Since we propagate the terminal as xterm-256color we have to follow xterm's behavior:
   *    - fullwidth + surrogate chars are ignored
   *    - for combining chars only the base char gets repeated
   *    - text attrs are applied normally
   *    - wrap around is respected
   *    - any valid sequence resets the carried forward char
   *
   * Note: To get reset on a valid sequence working correctly without much runtime penalty,
   * the preceding codepoint is stored on the parser in `this.print` and reset during `parser.parse`.
   */
  public repeatPrecedingCharacter(params: IParams): void {
    if (!this._parser.precedingCodepoint) {
      return;
    }
    // call print to insert the chars and handle correct wrapping
    const length = params.params[0] || 1;
    const data = new Uint32Array(length);
    for (let i = 0; i < length; ++i) {
      data[i] = this._parser.precedingCodepoint;
    }
    this.print(data, 0, data.length);
  }

  /**
   * CSI Ps c  Send Device Attributes (Primary DA).
   *     Ps = 0  or omitted -> request attributes from terminal.  The
   *     response depends on the decTerminalID resource setting.
   *     -> CSI ? 1 ; 2 c  (``VT100 with Advanced Video Option'')
   *     -> CSI ? 1 ; 0 c  (``VT101 with No Options'')
   *     -> CSI ? 6 c  (``VT102'')
   *     -> CSI ? 6 0 ; 1 ; 2 ; 6 ; 8 ; 9 ; 1 5 ; c  (``VT220'')
   *   The VT100-style response parameters do not mean anything by
   *   themselves.  VT220 parameters do, telling the host what fea-
   *   tures the terminal supports:
   *     Ps = 1  -> 132-columns.
   *     Ps = 2  -> Printer.
   *     Ps = 6  -> Selective erase.
   *     Ps = 8  -> User-defined keys.
   *     Ps = 9  -> National replacement character sets.
   *     Ps = 1 5  -> Technical characters.
   *     Ps = 2 2  -> ANSI color, e.g., VT525.
   *     Ps = 2 9  -> ANSI text locator (i.e., DEC Locator mode).
   * CSI > Ps c
   *   Send Device Attributes (Secondary DA).
   *     Ps = 0  or omitted -> request the terminal's identification
   *     code.  The response depends on the decTerminalID resource set-
   *     ting.  It should apply only to VT220 and up, but xterm extends
   *     this to VT100.
   *     -> CSI  > Pp ; Pv ; Pc c
   *   where Pp denotes the terminal type
   *     Pp = 0  -> ``VT100''.
   *     Pp = 1  -> ``VT220''.
   *   and Pv is the firmware version (for xterm, this was originally
   *   the XFree86 patch number, starting with 95).  In a DEC termi-
   *   nal, Pc indicates the ROM cartridge registration number and is
   *   always zero.
   * More information:
   *   xterm/charproc.c - line 2012, for more information.
   *   vim responds with ^[[?0c or ^[[?1c after the terminal's response (?)
   */
  public sendDeviceAttributesPrimary(params: IParams): void {
    if (params.params[0] > 0) {
      return;
    }
    if (this._terminal.is('xterm') || this._terminal.is('rxvt-unicode') || this._terminal.is('screen')) {
      this._coreService.triggerDataEvent(C0.ESC + '[?1;2c');
    } else if (this._terminal.is('linux')) {
      this._coreService.triggerDataEvent(C0.ESC + '[?6c');
    }
  }
  public sendDeviceAttributesSecondary(params: IParams): void {
    if (params.params[0] > 0) {
      return;
    }
    // xterm and urxvt
    // seem to spit this
    // out around ~370 times (?).
    if (this._terminal.is('xterm')) {
      this._coreService.triggerDataEvent(C0.ESC + '[>0;276;0c');
    } else if (this._terminal.is('rxvt-unicode')) {
      this._coreService.triggerDataEvent(C0.ESC + '[>85;95;0c');
    } else if (this._terminal.is('linux')) {
      // not supported by linux console.
      // linux console echoes parameters.
      this._coreService.triggerDataEvent(params.params[0] + 'c');
    } else if (this._terminal.is('screen')) {
      this._coreService.triggerDataEvent(C0.ESC + '[>83;40003;0c');
    }
  }

  /**
   * CSI Pm h  Set Mode (SM).
   *     Ps = 2  -> Keyboard Action Mode (AM).
   *     Ps = 4  -> Insert Mode (IRM).
   *     Ps = 1 2  -> Send/receive (SRM).
   *     Ps = 2 0  -> Automatic Newline (LNM).
   * CSI ? Pm h
   *   DEC Private Mode Set (DECSET).
   *     Ps = 1  -> Application Cursor Keys (DECCKM).
   *     Ps = 2  -> Designate USASCII for character sets G0-G3
   *     (DECANM), and set VT100 mode.
   *     Ps = 3  -> 132 Column Mode (DECCOLM).
   *     Ps = 4  -> Smooth (Slow) Scroll (DECSCLM).
   *     Ps = 5  -> Reverse Video (DECSCNM).
   *     Ps = 6  -> Origin Mode (DECOM).
   *     Ps = 7  -> Wraparound Mode (DECAWM).
   *     Ps = 8  -> Auto-repeat Keys (DECARM).
   *     Ps = 9  -> Send Mouse X & Y on button press.  See the sec-
   *     tion Mouse Tracking.
   *     Ps = 1 0  -> Show toolbar (rxvt).
   *     Ps = 1 2  -> Start Blinking Cursor (att610).
   *     Ps = 1 8  -> Print form feed (DECPFF).
   *     Ps = 1 9  -> Set print extent to full screen (DECPEX).
   *     Ps = 2 5  -> Show Cursor (DECTCEM).
   *     Ps = 3 0  -> Show scrollbar (rxvt).
   *     Ps = 3 5  -> Enable font-shifting functions (rxvt).
   *     Ps = 3 8  -> Enter Tektronix Mode (DECTEK).
   *     Ps = 4 0  -> Allow 80 -> 132 Mode.
   *     Ps = 4 1  -> more(1) fix (see curses resource).
   *     Ps = 4 2  -> Enable Nation Replacement Character sets (DECN-
   *     RCM).
   *     Ps = 4 4  -> Turn On Margin Bell.
   *     Ps = 4 5  -> Reverse-wraparound Mode.
   *     Ps = 4 6  -> Start Logging.  This is normally disabled by a
   *     compile-time option.
   *     Ps = 4 7  -> Use Alternate Screen Buffer.  (This may be dis-
   *     abled by the titeInhibit resource).
   *     Ps = 6 6  -> Application keypad (DECNKM).
   *     Ps = 6 7  -> Backarrow key sends backspace (DECBKM).
   *     Ps = 1 0 0 0  -> Send Mouse X & Y on button press and
   *     release.  See the section Mouse Tracking.
   *     Ps = 1 0 0 1  -> Use Hilite Mouse Tracking.
   *     Ps = 1 0 0 2  -> Use Cell Motion Mouse Tracking.
   *     Ps = 1 0 0 3  -> Use All Motion Mouse Tracking.
   *     Ps = 1 0 0 4  -> Send FocusIn/FocusOut events.
   *     Ps = 1 0 0 5  -> Enable Extended Mouse Mode.
   *     Ps = 1 0 1 0  -> Scroll to bottom on tty output (rxvt).
   *     Ps = 1 0 1 1  -> Scroll to bottom on key press (rxvt).
   *     Ps = 1 0 3 4  -> Interpret "meta" key, sets eighth bit.
   *     (enables the eightBitInput resource).
   *     Ps = 1 0 3 5  -> Enable special modifiers for Alt and Num-
   *     Lock keys.  (This enables the numLock resource).
   *     Ps = 1 0 3 6  -> Send ESC   when Meta modifies a key.  (This
   *     enables the metaSendsEscape resource).
   *     Ps = 1 0 3 7  -> Send DEL from the editing-keypad Delete
   *     key.
   *     Ps = 1 0 3 9  -> Send ESC  when Alt modifies a key.  (This
   *     enables the altSendsEscape resource).
   *     Ps = 1 0 4 0  -> Keep selection even if not highlighted.
   *     (This enables the keepSelection resource).
   *     Ps = 1 0 4 1  -> Use the CLIPBOARD selection.  (This enables
   *     the selectToClipboard resource).
   *     Ps = 1 0 4 2  -> Enable Urgency window manager hint when
   *     Control-G is received.  (This enables the bellIsUrgent
   *     resource).
   *     Ps = 1 0 4 3  -> Enable raising of the window when Control-G
   *     is received.  (enables the popOnBell resource).
   *     Ps = 1 0 4 7  -> Use Alternate Screen Buffer.  (This may be
   *     disabled by the titeInhibit resource).
   *     Ps = 1 0 4 8  -> Save cursor as in DECSC.  (This may be dis-
   *     abled by the titeInhibit resource).
   *     Ps = 1 0 4 9  -> Save cursor as in DECSC and use Alternate
   *     Screen Buffer, clearing it first.  (This may be disabled by
   *     the titeInhibit resource).  This combines the effects of the 1
   *     0 4 7  and 1 0 4 8  modes.  Use this with terminfo-based
   *     applications rather than the 4 7  mode.
   *     Ps = 1 0 5 0  -> Set terminfo/termcap function-key mode.
   *     Ps = 1 0 5 1  -> Set Sun function-key mode.
   *     Ps = 1 0 5 2  -> Set HP function-key mode.
   *     Ps = 1 0 5 3  -> Set SCO function-key mode.
   *     Ps = 1 0 6 0  -> Set legacy keyboard emulation (X11R6).
   *     Ps = 1 0 6 1  -> Set VT220 keyboard emulation.
   *     Ps = 2 0 0 4  -> Set bracketed paste mode.
   * Modes:
   *   http: *vt100.net/docs/vt220-rm/chapter4.html
   */
  public setMode(params: IParams): void {
    for (let i = 0; i < params.length; i++) {
      switch (params.params[i]) {
        case 4:
          this._terminal.insertMode = true;
          break;
        case 20:
          // this._t.convertEol = true;
          break;
      }
    }
  }
  public setModePrivate(params: IParams): void {
    for (let i = 0; i < params.length; i++) {
      switch (params.params[i]) {
        case 1:
          this._coreService.decPrivateModes.applicationCursorKeys = true;
          break;
        case 2:
          this._terminal.setgCharset(0, DEFAULT_CHARSET);
          this._terminal.setgCharset(1, DEFAULT_CHARSET);
          this._terminal.setgCharset(2, DEFAULT_CHARSET);
          this._terminal.setgCharset(3, DEFAULT_CHARSET);
          // set VT100 mode here
          break;
        case 3: // 132 col mode
          // TODO: move DECCOLM into compat addon
          this._terminal.savedCols = this._bufferService.cols;
          this._terminal.resize(132, this._bufferService.rows);
          this._terminal.reset();
          break;
        case 6:
          this._terminal.originMode = true;
          this._setCursor(0, 0);
          break;
        case 7:
          this._terminal.wraparoundMode = true;
          break;
        case 12:
          // this.cursorBlink = true;
          break;
        case 66:
          this._logService.debug('Serial port requested application keypad.');
          this._terminal.applicationKeypad = true;
          if (this._terminal.viewport) {
            this._terminal.viewport.syncScrollArea();
          }
          break;
        case 9: // X10 Mouse
          // no release, no motion, no wheel, no modifiers.
          this._coreMouseService.activeProtocol = 'X10';
          break;
        case 1000: // vt200 mouse
          // no motion.
          this._coreMouseService.activeProtocol = 'VT200';
          break;
        case 1002: // button event mouse
          this._coreMouseService.activeProtocol = 'DRAG';
          break;
        case 1003: // any event mouse
          // any event - sends motion events,
          // even if there is no button held down.
          this._coreMouseService.activeProtocol = 'ANY';
          break;
        case 1004: // send focusin/focusout events
          // focusin: ^[[I
          // focusout: ^[[O
          this._terminal.sendFocus = true;
          break;
        case 1005: // utf8 ext mode mouse - removed in #2507
          this._logService.debug('DECSET 1005 not supported (see #2507)');
          break;
        case 1006: // sgr ext mode mouse
          this._coreMouseService.activeEncoding = 'SGR';
          break;
        case 1015: // urxvt ext mode mouse - removed in #2507
          this._logService.debug('DECSET 1015 not supported (see #2507)');
          break;
        case 25: // show cursor
          this._terminal.cursorHidden = false;
          break;
        case 1048: // alt screen cursor
          this.saveCursor();
          break;
        case 1049: // alt screen buffer cursor
          this.saveCursor();
          // FALL-THROUGH
        case 47: // alt screen buffer
        case 1047: // alt screen buffer
          this._bufferService.buffers.activateAltBuffer(this._terminal.eraseAttrData());
          this._terminal.refresh(0, this._bufferService.rows - 1);
          if (this._terminal.viewport) {
            this._terminal.viewport.syncScrollArea();
          }
          this._terminal.showCursor();
          break;
        case 2004: // bracketed paste mode (https://cirw.in/blog/bracketed-paste)
          this._terminal.bracketedPasteMode = true;
          break;
      }
    }
  }


  /**
   * CSI Pm l  Reset Mode (RM).
   *     Ps = 2  -> Keyboard Action Mode (AM).
   *     Ps = 4  -> Replace Mode (IRM).
   *     Ps = 1 2  -> Send/receive (SRM).
   *     Ps = 2 0  -> Normal Linefeed (LNM).
   * CSI ? Pm l
   *   DEC Private Mode Reset (DECRST).
   *     Ps = 1  -> Normal Cursor Keys (DECCKM).
   *     Ps = 2  -> Designate VT52 mode (DECANM).
   *     Ps = 3  -> 80 Column Mode (DECCOLM).
   *     Ps = 4  -> Jump (Fast) Scroll (DECSCLM).
   *     Ps = 5  -> Normal Video (DECSCNM).
   *     Ps = 6  -> Normal Cursor Mode (DECOM).
   *     Ps = 7  -> No Wraparound Mode (DECAWM).
   *     Ps = 8  -> No Auto-repeat Keys (DECARM).
   *     Ps = 9  -> Don't send Mouse X & Y on button press.
   *     Ps = 1 0  -> Hide toolbar (rxvt).
   *     Ps = 1 2  -> Stop Blinking Cursor (att610).
   *     Ps = 1 8  -> Don't print form feed (DECPFF).
   *     Ps = 1 9  -> Limit print to scrolling region (DECPEX).
   *     Ps = 2 5  -> Hide Cursor (DECTCEM).
   *     Ps = 3 0  -> Don't show scrollbar (rxvt).
   *     Ps = 3 5  -> Disable font-shifting functions (rxvt).
   *     Ps = 4 0  -> Disallow 80 -> 132 Mode.
   *     Ps = 4 1  -> No more(1) fix (see curses resource).
   *     Ps = 4 2  -> Disable Nation Replacement Character sets (DEC-
   *     NRCM).
   *     Ps = 4 4  -> Turn Off Margin Bell.
   *     Ps = 4 5  -> No Reverse-wraparound Mode.
   *     Ps = 4 6  -> Stop Logging.  (This is normally disabled by a
   *     compile-time option).
   *     Ps = 4 7  -> Use Normal Screen Buffer.
   *     Ps = 6 6  -> Numeric keypad (DECNKM).
   *     Ps = 6 7  -> Backarrow key sends delete (DECBKM).
   *     Ps = 1 0 0 0  -> Don't send Mouse X & Y on button press and
   *     release.  See the section Mouse Tracking.
   *     Ps = 1 0 0 1  -> Don't use Hilite Mouse Tracking.
   *     Ps = 1 0 0 2  -> Don't use Cell Motion Mouse Tracking.
   *     Ps = 1 0 0 3  -> Don't use All Motion Mouse Tracking.
   *     Ps = 1 0 0 4  -> Don't send FocusIn/FocusOut events.
   *     Ps = 1 0 0 5  -> Disable Extended Mouse Mode.
   *     Ps = 1 0 1 0  -> Don't scroll to bottom on tty output
   *     (rxvt).
   *     Ps = 1 0 1 1  -> Don't scroll to bottom on key press (rxvt).
   *     Ps = 1 0 3 4  -> Don't interpret "meta" key.  (This disables
   *     the eightBitInput resource).
   *     Ps = 1 0 3 5  -> Disable special modifiers for Alt and Num-
   *     Lock keys.  (This disables the numLock resource).
   *     Ps = 1 0 3 6  -> Don't send ESC  when Meta modifies a key.
   *     (This disables the metaSendsEscape resource).
   *     Ps = 1 0 3 7  -> Send VT220 Remove from the editing-keypad
   *     Delete key.
   *     Ps = 1 0 3 9  -> Don't send ESC  when Alt modifies a key.
   *     (This disables the altSendsEscape resource).
   *     Ps = 1 0 4 0  -> Do not keep selection when not highlighted.
   *     (This disables the keepSelection resource).
   *     Ps = 1 0 4 1  -> Use the PRIMARY selection.  (This disables
   *     the selectToClipboard resource).
   *     Ps = 1 0 4 2  -> Disable Urgency window manager hint when
   *     Control-G is received.  (This disables the bellIsUrgent
   *     resource).
   *     Ps = 1 0 4 3  -> Disable raising of the window when Control-
   *     G is received.  (This disables the popOnBell resource).
   *     Ps = 1 0 4 7  -> Use Normal Screen Buffer, clearing screen
   *     first if in the Alternate Screen.  (This may be disabled by
   *     the titeInhibit resource).
   *     Ps = 1 0 4 8  -> Restore cursor as in DECRC.  (This may be
   *     disabled by the titeInhibit resource).
   *     Ps = 1 0 4 9  -> Use Normal Screen Buffer and restore cursor
   *     as in DECRC.  (This may be disabled by the titeInhibit
   *     resource).  This combines the effects of the 1 0 4 7  and 1 0
   *     4 8  modes.  Use this with terminfo-based applications rather
   *     than the 4 7  mode.
   *     Ps = 1 0 5 0  -> Reset terminfo/termcap function-key mode.
   *     Ps = 1 0 5 1  -> Reset Sun function-key mode.
   *     Ps = 1 0 5 2  -> Reset HP function-key mode.
   *     Ps = 1 0 5 3  -> Reset SCO function-key mode.
   *     Ps = 1 0 6 0  -> Reset legacy keyboard emulation (X11R6).
   *     Ps = 1 0 6 1  -> Reset keyboard emulation to Sun/PC style.
   *     Ps = 2 0 0 4  -> Reset bracketed paste mode.
   */
  public resetMode(params: IParams): void {
    for (let i = 0; i < params.length; i++) {
      switch (params.params[i]) {
        case 4:
          this._terminal.insertMode = false;
          break;
        case 20:
          // this._t.convertEol = false;
          break;
      }
    }
  }
  public resetModePrivate(params: IParams): void {
    for (let i = 0; i < params.length; i++) {
      switch (params.params[i]) {
        case 1:
          this._coreService.decPrivateModes.applicationCursorKeys = false;
          break;
        case 3:
          // TODO: move DECCOLM into compat addon
          // Note: This impl currently does not enforce col 80, instead reverts
          // to previous terminal width before entering DECCOLM 132
          if (this._bufferService.cols === 132 && this._terminal.savedCols) {
            this._terminal.resize(this._terminal.savedCols, this._bufferService.rows);
          }
          delete this._terminal.savedCols;
          this._terminal.reset();
          break;
        case 6:
          this._terminal.originMode = false;
          this._setCursor(0, 0);
          break;
        case 7:
          this._terminal.wraparoundMode = false;
          break;
        case 12:
          // this.cursorBlink = false;
          break;
        case 66:
          this._logService.debug('Switching back to normal keypad.');
          this._terminal.applicationKeypad = false;
          if (this._terminal.viewport) {
            this._terminal.viewport.syncScrollArea();
          }
          break;
        case 9: // X10 Mouse
        case 1000: // vt200 mouse
        case 1002: // button event mouse
        case 1003: // any event mouse
          this._coreMouseService.activeProtocol = 'NONE';
          break;
        case 1004: // send focusin/focusout events
          this._terminal.sendFocus = false;
          break;
        case 1005: // utf8 ext mode mouse - removed in #2507
          this._logService.debug('DECRST 1005 not supported (see #2507)');
          break;
        case 1006: // sgr ext mode mouse
          this._coreMouseService.activeEncoding = 'DEFAULT';
          break;
        case 1015: // urxvt ext mode mouse - removed in #2507
        this._logService.debug('DECRST 1015 not supported (see #2507)');
          break;
        case 25: // hide cursor
          this._terminal.cursorHidden = true;
          break;
        case 1048: // alt screen cursor
          this.restoreCursor();
          break;
        case 1049: // alt screen buffer cursor
           // FALL-THROUGH
        case 47: // normal screen buffer
        case 1047: // normal screen buffer - clearing it first
          // Ensure the selection manager has the correct buffer
          this._bufferService.buffers.activateNormalBuffer();
          if (params.params[i] === 1049) {
            this.restoreCursor();
          }
          this._terminal.refresh(0, this._bufferService.rows - 1);
          if (this._terminal.viewport) {
            this._terminal.viewport.syncScrollArea();
          }
          this._terminal.showCursor();
          break;
        case 2004: // bracketed paste mode (https://cirw.in/blog/bracketed-paste)
          this._terminal.bracketedPasteMode = false;
          break;
      }
    }
  }

  /**
   * Helper to extract and apply color params/subparams.
   * Returns advance for params index.
   */
  private _extractColor(params: IParams, pos: number, attr: IAttributeData): number {
    // normalize params
    // meaning: [target, CM, ign, val, val, val]
    // RGB    : [ 38/48,  2, ign,   r,   g,   b]
    // P256   : [ 38/48,  5, ign,   v, ign, ign]
    const accu = [0, 0, -1, 0, 0, 0];

    // alignment placeholder for non color space sequences
    let cSpace = 0;

    // return advance we took in params
    let advance = 0;

    do {
      accu[advance + cSpace] = params.params[pos + advance];
      if (params.hasSubParams(pos + advance)) {
        const subparams = params.getSubParams(pos + advance);
        let i = 0;
        do {
          if (accu[1] === 5) {
            cSpace = 1;
          }
          accu[advance + i + 1 + cSpace] = subparams[i];
        } while (++i < subparams.length && i + advance + 1 + cSpace < accu.length);
        break;
      }
      // exit early if can decide color mode with semicolons
      if ((accu[1] === 5 && advance + cSpace >= 2)
          || (accu[1] === 2 && advance + cSpace >= 5)) {
        break;
      }
      // offset colorSpace slot for semicolon mode
      if (accu[1]) {
        cSpace = 1;
      }
    } while (++advance + pos < params.length && advance + cSpace < accu.length);

    // set default values to 0
    for (let i = 2; i < accu.length; ++i) {
      if (accu[i] === -1) {
        accu[i] = 0;
      }
    }

    // apply colors
    if (accu[0] === 38) {
      if (accu[1] === 2) {
        attr.fg |= Attributes.CM_RGB;
        attr.fg &= ~Attributes.RGB_MASK;
        attr.fg |= AttributeData.fromColorRGB([accu[3], accu[4], accu[5]]);
      } else if (accu[1] === 5) {
        attr.fg &= ~(Attributes.CM_MASK | Attributes.PCOLOR_MASK);
        attr.fg |= Attributes.CM_P256 | (accu[3] & 0xff);
      }
    } else if (accu[0] === 48) {
      if (accu[1] === 2) {
        attr.bg |= Attributes.CM_RGB;
        attr.bg &= ~Attributes.RGB_MASK;
        attr.bg |= AttributeData.fromColorRGB([accu[3], accu[4], accu[5]]);
      } else if (accu[1] === 5) {
        attr.bg &= ~(Attributes.CM_MASK | Attributes.PCOLOR_MASK);
        attr.bg |= Attributes.CM_P256 | (accu[3] & 0xff);
      }
    }

    return advance;
  }

  /**
   * CSI Pm m  Character Attributes (SGR).
   *     Ps = 0  -> Normal (default).
   *     Ps = 1  -> Bold.
   *     Ps = 2  -> Faint, decreased intensity (ISO 6429).
   *     Ps = 4  -> Underlined.
   *     Ps = 5  -> Blink (appears as Bold).
   *     Ps = 7  -> Inverse.
   *     Ps = 8  -> Invisible, i.e., hidden (VT300).
   *     Ps = 2 2  -> Normal (neither bold nor faint).
   *     Ps = 2 4  -> Not underlined.
   *     Ps = 2 5  -> Steady (not blinking).
   *     Ps = 2 7  -> Positive (not inverse).
   *     Ps = 2 8  -> Visible, i.e., not hidden (VT300).
   *     Ps = 3 0  -> Set foreground color to Black.
   *     Ps = 3 1  -> Set foreground color to Red.
   *     Ps = 3 2  -> Set foreground color to Green.
   *     Ps = 3 3  -> Set foreground color to Yellow.
   *     Ps = 3 4  -> Set foreground color to Blue.
   *     Ps = 3 5  -> Set foreground color to Magenta.
   *     Ps = 3 6  -> Set foreground color to Cyan.
   *     Ps = 3 7  -> Set foreground color to White.
   *     Ps = 3 9  -> Set foreground color to default (original).
   *     Ps = 4 0  -> Set background color to Black.
   *     Ps = 4 1  -> Set background color to Red.
   *     Ps = 4 2  -> Set background color to Green.
   *     Ps = 4 3  -> Set background color to Yellow.
   *     Ps = 4 4  -> Set background color to Blue.
   *     Ps = 4 5  -> Set background color to Magenta.
   *     Ps = 4 6  -> Set background color to Cyan.
   *     Ps = 4 7  -> Set background color to White.
   *     Ps = 4 9  -> Set background color to default (original).
   *
   *   If 16-color support is compiled, the following apply.  Assume
   *   that xterm's resources are set so that the ISO color codes are
   *   the first 8 of a set of 16.  Then the aixterm colors are the
   *   bright versions of the ISO colors:
   *     Ps = 9 0  -> Set foreground color to Black.
   *     Ps = 9 1  -> Set foreground color to Red.
   *     Ps = 9 2  -> Set foreground color to Green.
   *     Ps = 9 3  -> Set foreground color to Yellow.
   *     Ps = 9 4  -> Set foreground color to Blue.
   *     Ps = 9 5  -> Set foreground color to Magenta.
   *     Ps = 9 6  -> Set foreground color to Cyan.
   *     Ps = 9 7  -> Set foreground color to White.
   *     Ps = 1 0 0  -> Set background color to Black.
   *     Ps = 1 0 1  -> Set background color to Red.
   *     Ps = 1 0 2  -> Set background color to Green.
   *     Ps = 1 0 3  -> Set background color to Yellow.
   *     Ps = 1 0 4  -> Set background color to Blue.
   *     Ps = 1 0 5  -> Set background color to Magenta.
   *     Ps = 1 0 6  -> Set background color to Cyan.
   *     Ps = 1 0 7  -> Set background color to White.
   *
   *   If xterm is compiled with the 16-color support disabled, it
   *   supports the following, from rxvt:
   *     Ps = 1 0 0  -> Set foreground and background color to
   *     default.
   *
   *   If 88- or 256-color support is compiled, the following apply.
   *     Ps = 3 8  ; 5  ; Ps -> Set foreground color to the second
   *     Ps.
   *     Ps = 4 8  ; 5  ; Ps -> Set background color to the second
   *     Ps.
   */
  public charAttributes(params: IParams): void {
    // Optimize a single SGR0.
    if (params.length === 1 && params.params[0] === 0) {
      this._terminal.curAttrData.fg = DEFAULT_ATTR_DATA.fg;
      this._terminal.curAttrData.bg = DEFAULT_ATTR_DATA.bg;
      return;
    }

    const l = params.length;
    let p;
    const attr = this._terminal.curAttrData;

    for (let i = 0; i < l; i++) {
      p = params.params[i];
      if (p >= 30 && p <= 37) {
        // fg color 8
        attr.fg &= ~(Attributes.CM_MASK | Attributes.PCOLOR_MASK);
        attr.fg |= Attributes.CM_P16 | (p - 30);
      } else if (p >= 40 && p <= 47) {
        // bg color 8
        attr.bg &= ~(Attributes.CM_MASK | Attributes.PCOLOR_MASK);
        attr.bg |= Attributes.CM_P16 | (p - 40);
      } else if (p >= 90 && p <= 97) {
        // fg color 16
        attr.fg &= ~(Attributes.CM_MASK | Attributes.PCOLOR_MASK);
        attr.fg |= Attributes.CM_P16 | (p - 90) | 8;
      } else if (p >= 100 && p <= 107) {
        // bg color 16
        attr.bg &= ~(Attributes.CM_MASK | Attributes.PCOLOR_MASK);
        attr.bg |= Attributes.CM_P16 | (p - 100) | 8;
      } else if (p === 0) {
        // default
        attr.fg = DEFAULT_ATTR_DATA.fg;
        attr.bg = DEFAULT_ATTR_DATA.bg;
      } else if (p === 1) {
        // bold text
        attr.fg |= FgFlags.BOLD;
      } else if (p === 3) {
        // italic text
        attr.bg |= BgFlags.ITALIC;
      } else if (p === 4) {
        // underlined text
        attr.fg |= FgFlags.UNDERLINE;
      } else if (p === 5) {
        // blink
        attr.fg |= FgFlags.BLINK;
      } else if (p === 7) {
        // inverse and positive
        // test with: echo -e '\e[31m\e[42mhello\e[7mworld\e[27mhi\e[m'
        attr.fg |= FgFlags.INVERSE;
      } else if (p === 8) {
        // invisible
        attr.fg |= FgFlags.INVISIBLE;
      } else if (p === 2) {
        // dimmed text
        attr.bg |= BgFlags.DIM;
      } else if (p === 22) {
        // not bold nor faint
        attr.fg &= ~FgFlags.BOLD;
        attr.bg &= ~BgFlags.DIM;
      } else if (p === 23) {
        // not italic
        attr.bg &= ~BgFlags.ITALIC;
      } else if (p === 24) {
        // not underlined
        attr.fg &= ~FgFlags.UNDERLINE;
      } else if (p === 25) {
        // not blink
        attr.fg &= ~FgFlags.BLINK;
      } else if (p === 27) {
        // not inverse
        attr.fg &= ~FgFlags.INVERSE;
      } else if (p === 28) {
        // not invisible
        attr.fg &= ~FgFlags.INVISIBLE;
      } else if (p === 39) {
        // reset fg
        attr.fg &= ~(Attributes.CM_MASK | Attributes.RGB_MASK);
        attr.fg |= DEFAULT_ATTR_DATA.fg & (Attributes.PCOLOR_MASK | Attributes.RGB_MASK);
      } else if (p === 49) {
        // reset bg
        attr.bg &= ~(Attributes.CM_MASK | Attributes.RGB_MASK);
        attr.bg |= DEFAULT_ATTR_DATA.bg & (Attributes.PCOLOR_MASK | Attributes.RGB_MASK);
      } else if (p === 38 || p === 48) {
        // fg color 256 and RGB
        i += this._extractColor(params, i, attr);
      } else if (p === 100) {
        // reset fg/bg
        attr.fg &= ~(Attributes.CM_MASK | Attributes.RGB_MASK);
        attr.fg |= DEFAULT_ATTR_DATA.fg & (Attributes.PCOLOR_MASK | Attributes.RGB_MASK);
        attr.bg &= ~(Attributes.CM_MASK | Attributes.RGB_MASK);
        attr.bg |= DEFAULT_ATTR_DATA.bg & (Attributes.PCOLOR_MASK | Attributes.RGB_MASK);
      } else {
        this._logService.debug('Unknown SGR attribute: %d.', p);
      }
    }
  }

  /**
   * CSI Ps n  Device Status Report (DSR).
   *     Ps = 5  -> Status Report.  Result (``OK'') is
   *   CSI 0 n
   *     Ps = 6  -> Report Cursor Position (CPR) [row;column].
   *   Result is
   *   CSI r ; c R
   * CSI ? Ps n
   *   Device Status Report (DSR, DEC-specific).
   *     Ps = 6  -> Report Cursor Position (CPR) [row;column] as CSI
   *     ? r ; c R (assumes page is zero).
   *     Ps = 1 5  -> Report Printer status as CSI ? 1 0  n  (ready).
   *     or CSI ? 1 1  n  (not ready).
   *     Ps = 2 5  -> Report UDK status as CSI ? 2 0  n  (unlocked)
   *     or CSI ? 2 1  n  (locked).
   *     Ps = 2 6  -> Report Keyboard status as
   *   CSI ? 2 7  ;  1  ;  0  ;  0  n  (North American).
   *   The last two parameters apply to VT400 & up, and denote key-
   *   board ready and LK01 respectively.
   *     Ps = 5 3  -> Report Locator status as
   *   CSI ? 5 3  n  Locator available, if compiled-in, or
   *   CSI ? 5 0  n  No Locator, if not.
   */
  public deviceStatus(params: IParams): void {
    switch (params.params[0]) {
      case 5:
        // status report
        this._coreService.triggerDataEvent(`${C0.ESC}[0n`);
        break;
      case 6:
        // cursor position
        const y = this._bufferService.buffer.y + 1;
        const x = this._bufferService.buffer.x + 1;
        this._coreService.triggerDataEvent(`${C0.ESC}[${y};${x}R`);
        break;
    }
  }

  public deviceStatusPrivate(params: IParams): void {
    // modern xterm doesnt seem to
    // respond to any of these except ?6, 6, and 5
    switch (params.params[0]) {
      case 6:
        // cursor position
        const y = this._bufferService.buffer.y + 1;
        const x = this._bufferService.buffer.x + 1;
        this._coreService.triggerDataEvent(`${C0.ESC}[?${y};${x}R`);
        break;
      case 15:
        // no printer
        // this.handler(C0.ESC + '[?11n');
        break;
      case 25:
        // dont support user defined keys
        // this.handler(C0.ESC + '[?21n');
        break;
      case 26:
        // north american keyboard
        // this.handler(C0.ESC + '[?27;1;0;0n');
        break;
      case 53:
        // no dec locator/mouse
        // this.handler(C0.ESC + '[?50n');
        break;
    }
  }

  /**
   * CSI ! p   Soft terminal reset (DECSTR).
   * http://vt100.net/docs/vt220-rm/table4-10.html
   */
  public softReset(params: IParams): void {
    this._terminal.cursorHidden = false;
    this._terminal.insertMode = false;
    this._terminal.originMode = false;
    this._terminal.wraparoundMode = true;  // defaults: xterm - true, vt100 - false
    this._terminal.applicationKeypad = false; // ?
    if (this._terminal.viewport) {
      this._terminal.viewport.syncScrollArea();
    }
    this._coreService.decPrivateModes.applicationCursorKeys = false;
    this._bufferService.buffer.scrollTop = 0;
    this._bufferService.buffer.scrollBottom = this._bufferService.rows - 1;
    this._terminal.curAttrData = DEFAULT_ATTR_DATA.clone();
    this._bufferService.buffer.x = this._bufferService.buffer.y = 0; // ?
    this._terminal.charset = null;
    this._terminal.glevel = 0; // ??
    this._terminal.charsets = [null]; // ??
  }

  /**
   * CSI Ps SP q  Set cursor style (DECSCUSR, VT520).
   *   Ps = 0  -> blinking block.
   *   Ps = 1  -> blinking block (default).
   *   Ps = 2  -> steady block.
   *   Ps = 3  -> blinking underline.
   *   Ps = 4  -> steady underline.
   *   Ps = 5  -> blinking bar (xterm).
   *   Ps = 6  -> steady bar (xterm).
   */
  public setCursorStyle(params: IParams): void {
    const param = params.params[0] || 1;
    switch (param) {
      case 1:
      case 2:
        this._optionsService.options.cursorStyle = 'block';
        break;
      case 3:
      case 4:
        this._optionsService.options.cursorStyle = 'underline';
        break;
      case 5:
      case 6:
        this._optionsService.options.cursorStyle = 'bar';
        break;
    }
    const isBlinking = param % 2 === 1;
    this._optionsService.options.cursorBlink = isBlinking;
  }

  /**
   * CSI Ps ; Ps r
   *   Set Scrolling Region [top;bottom] (default = full size of win-
   *   dow) (DECSTBM).
   */
  public setScrollRegion(params: IParams): void {
    const top = params.params[0] || 1;
    let bottom: number;

    if (params.length < 2 || (bottom = params.params[1]) >  this._bufferService.rows || bottom === 0) {
      bottom = this._bufferService.rows;
    }

    if (bottom > top) {
      this._bufferService.buffer.scrollTop = top - 1;
      this._bufferService.buffer.scrollBottom = bottom - 1;
      this._setCursor(0, 0);
    }
  }


  /**
   * CSI s
   * ESC 7
   *   Save cursor (ANSI.SYS).
   */
  public saveCursor(params?: IParams): void {
    this._bufferService.buffer.savedX = this._bufferService.buffer.x;
    this._bufferService.buffer.savedY = this._bufferService.buffer.ybase + this._bufferService.buffer.y;
    this._bufferService.buffer.savedCurAttrData.fg = this._terminal.curAttrData.fg;
    this._bufferService.buffer.savedCurAttrData.bg = this._terminal.curAttrData.bg;
    this._bufferService.buffer.savedCharset = this._terminal.charset;
  }


  /**
   * CSI u
   * ESC 8
   *   Restore cursor (ANSI.SYS).
   */
  public restoreCursor(params?: IParams): void {
    this._bufferService.buffer.x = this._bufferService.buffer.savedX || 0;
    this._bufferService.buffer.y = Math.max(this._bufferService.buffer.savedY - this._bufferService.buffer.ybase, 0);
    this._terminal.curAttrData.fg = this._bufferService.buffer.savedCurAttrData.fg;
    this._terminal.curAttrData.bg = this._bufferService.buffer.savedCurAttrData.bg;
    this._terminal.charset = (this as any)._savedCharset;
    if (this._bufferService.buffer.savedCharset) {
      this._terminal.charset = this._bufferService.buffer.savedCharset;
    }
    this._restrictCursor();
  }


  /**
   * OSC 0; <data> ST (set icon name + window title)
   * OSC 2; <data> ST (set window title)
   *   Proxy to set window title. Icon name is not supported.
   */
  public setTitle(data: string): void {
    this._terminal.handleTitle(data);
  }

  /**
   * ESC E
   * C1.NEL
   *   DEC mnemonic: NEL (https://vt100.net/docs/vt510-rm/NEL)
   *   Moves cursor to first position on next line.
   */
  public nextLine(): void {
    this._bufferService.buffer.x = 0;
    this.index();
  }

  /**
   * ESC =
   *   DEC mnemonic: DECKPAM (https://vt100.net/docs/vt510-rm/DECKPAM.html)
   *   Enables the numeric keypad to send application sequences to the host.
   */
  public keypadApplicationMode(): void {
    this._logService.debug('Serial port requested application keypad.');
    this._terminal.applicationKeypad = true;
    if (this._terminal.viewport) {
      this._terminal.viewport.syncScrollArea();
    }
  }

  /**
   * ESC >
   *   DEC mnemonic: DECKPNM (https://vt100.net/docs/vt510-rm/DECKPNM.html)
   *   Enables the keypad to send numeric characters to the host.
   */
  public keypadNumericMode(): void {
    this._logService.debug('Switching back to normal keypad.');
    this._terminal.applicationKeypad = false;
    if (this._terminal.viewport) {
      this._terminal.viewport.syncScrollArea();
    }
  }

  /**
   * ESC % @
   * ESC % G
   *   Select default character set. UTF-8 is not supported (string are unicode anyways)
   *   therefore ESC % G does the same.
   */
  public selectDefaultCharset(): void {
    this._terminal.setgLevel(0);
    this._terminal.setgCharset(0, DEFAULT_CHARSET); // US (default)
  }

  /**
   * ESC ( C
   *   Designate G0 Character Set, VT100, ISO 2022.
   * ESC ) C
   *   Designate G1 Character Set (ISO 2022, VT100).
   * ESC * C
   *   Designate G2 Character Set (ISO 2022, VT220).
   * ESC + C
   *   Designate G3 Character Set (ISO 2022, VT220).
   * ESC - C
   *   Designate G1 Character Set (VT300).
   * ESC . C
   *   Designate G2 Character Set (VT300).
   * ESC / C
   *   Designate G3 Character Set (VT300). C = A  -> ISO Latin-1 Supplemental. - Supported?
   */
  public selectCharset(collectAndFlag: string): void {
    if (collectAndFlag.length !== 2) {
      this.selectDefaultCharset();
      return;
    }
    if (collectAndFlag[0] === '/') {
      return;  // TODO: Is this supported?
    }
    this._terminal.setgCharset(GLEVEL[collectAndFlag[0]], CHARSETS[collectAndFlag[1]] || DEFAULT_CHARSET);
    return;
  }

  /**
   * ESC D
   * C1.IND
   *   DEC mnemonic: IND (https://vt100.net/docs/vt510-rm/IND.html)
   *   Moves the cursor down one line in the same column.
   */
  public index(): void {
    this._restrictCursor();
    const buffer = this._bufferService.buffer;
    this._bufferService.buffer.y++;
    if (buffer.y === buffer.scrollBottom + 1) {
      buffer.y--;
      this._terminal.scroll();
    } else if (buffer.y >= this._bufferService.rows) {
      buffer.y = this._bufferService.rows - 1;
    }
    this._restrictCursor();
  }

  /**
   * ESC H
   * C1.HTS
   *   DEC mnemonic: HTS (https://vt100.net/docs/vt510-rm/HTS.html)
   *   Sets a horizontal tab stop at the column position indicated by
   *   the value of the active column when the terminal receives an HTS.
   */
  public tabSet(): void {
    this._bufferService.buffer.tabs[this._bufferService.buffer.x] = true;
  }

  /**
   * ESC M
   * C1.RI
   *   DEC mnemonic: HTS
   *   Moves the cursor up one line in the same column. If the cursor is at the top margin,
   *   the page scrolls down.
   */
  public reverseIndex(): void {
    this._restrictCursor();
    const buffer = this._bufferService.buffer;
    if (buffer.y === buffer.scrollTop) {
      // possibly move the code below to term.reverseScroll();
      // test: echo -ne '\e[1;1H\e[44m\eM\e[0m'
      // blankLine(true) is xterm/linux behavior
      const scrollRegionHeight = buffer.scrollBottom - buffer.scrollTop;
      buffer.lines.shiftElements(buffer.y + buffer.ybase, scrollRegionHeight, 1);
      buffer.lines.set(buffer.y + buffer.ybase, buffer.getBlankLine(this._terminal.eraseAttrData()));
      this._dirtyRowService.markRangeDirty(buffer.scrollTop, buffer.scrollBottom);
    } else {
      buffer.y--;
      this._restrictCursor(); // quickfix to not run out of bounds
    }
  }

  /**
   * ESC c
   *   DEC mnemonic: RIS (https://vt100.net/docs/vt510-rm/RIS.html)
   *   Reset to initial state.
   */
  public reset(): void {
    this._parser.reset();
    this._terminal.reset();  // TODO: save to move from terminal?
  }

  /**
   * ESC n
   * ESC o
   * ESC |
   * ESC }
   * ESC ~
   *   DEC mnemonic: LS (https://vt100.net/docs/vt510-rm/LS.html)
   *   When you use a locking shift, the character set remains in GL or GR until
   *   you use another locking shift. (partly supported)
   */
  public setgLevel(level: number): void {
    this._terminal.setgLevel(level);  // TODO: save to move from terminal?
  }

  /**
   * ESC # 8
   *   DEC mnemonic: DECALN (https://vt100.net/docs/vt510-rm/DECALN.html)
   *   This control function fills the complete screen area with
   *   a test pattern (E) used for adjusting screen alignment.
   *
   * TODO: move DECALN into compat addon
   */
  public screenAlignmentPattern(): void {
    // prepare cell data
    const cell = new CellData();
    cell.content = 1 << Content.WIDTH_SHIFT | 'E'.charCodeAt(0);
    cell.fg = this._terminal.curAttrData.fg;
    cell.bg = this._terminal.curAttrData.bg;

    const buffer = this._bufferService.buffer;

    this._setCursor(0, 0);
    for (let yOffset = 0; yOffset < this._bufferService.rows; ++yOffset) {
      const row = buffer.y + buffer.ybase + yOffset;
      buffer.lines.get(row).fill(cell);
      buffer.lines.get(row).isWrapped = false;
    }
    this._dirtyRowService.markAllDirty();
    this._setCursor(0, 0);
  }
}
