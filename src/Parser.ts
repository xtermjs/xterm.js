/**
 * Copyright (c) 2014 The xterm.js authors. All rights reserved.
 * Copyright (c) 2012-2013, Christopher Jeffrey (MIT License)
 * @license MIT
 */

import { C0 } from './EscapeSequences';
import { IInputHandler } from './Interfaces';
import { CHARSETS, DEFAULT_CHARSET } from './Charsets';

const normalStateHandler: {[key: string]: (parser: Parser, handler: IInputHandler) => void} = {};
normalStateHandler[C0.BEL] = (parser, handler) => handler.bell();
normalStateHandler[C0.LF] = (parser, handler) => handler.lineFeed();
normalStateHandler[C0.VT] = normalStateHandler[C0.LF];
normalStateHandler[C0.FF] = normalStateHandler[C0.LF];
normalStateHandler[C0.CR] = (parser, handler) => handler.carriageReturn();
normalStateHandler[C0.BS] = (parser, handler) => handler.backspace();
normalStateHandler[C0.HT] = (parser, handler) => handler.tab();
normalStateHandler[C0.SO] = (parser, handler) => handler.shiftOut();
normalStateHandler[C0.SI] = (parser, handler) => handler.shiftIn();
normalStateHandler[C0.ESC] = (parser, handler) => parser.setState(ParserState.ESCAPED);

// TODO: Remove terminal when parser owns params and currentParam
const escapedStateHandler: {[key: string]: (parser: Parser, terminal: any) => void} = {};
escapedStateHandler['['] = (parser, terminal) => {
  // ESC [ Control Sequence Introducer (CSI  is 0x9b)
  terminal.params = [];
  terminal.currentParam = 0;
  parser.setState(ParserState.CSI_PARAM);
};
escapedStateHandler[']'] = (parser, terminal) => {
  // ESC ] Operating System Command (OSC is 0x9d)
  terminal.params = [];
  terminal.currentParam = 0;
  parser.setState(ParserState.OSC);
};
escapedStateHandler['P'] = (parser, terminal) => {
  // ESC P Device Control String (DCS is 0x90)
  terminal.params = [];
  terminal.currentParam = 0;
  parser.setState(ParserState.DCS);
};
escapedStateHandler['_'] = (parser, terminal) => {
  // ESC _ Application Program Command ( APC is 0x9f).
  parser.setState(ParserState.IGNORE);
};
escapedStateHandler['^'] = (parser, terminal) => {
  // ESC ^ Privacy Message ( PM is 0x9e).
  parser.setState(ParserState.IGNORE);
};
escapedStateHandler['c'] = (parser, terminal) => {
  // ESC c Full Reset (RIS).
  terminal.reset();
};
escapedStateHandler['E'] = (parser, terminal) => {
  // ESC E Next Line ( NEL is 0x85).
  terminal.buffer.x = 0;
  terminal.index();
  parser.setState(ParserState.NORMAL);
};
escapedStateHandler['D'] = (parser, terminal) => {
  // ESC D Index ( IND is 0x84).
  terminal.index();
  parser.setState(ParserState.NORMAL);
};
escapedStateHandler['M'] = (parser, terminal) => {
  // ESC M Reverse Index ( RI is 0x8d).
  terminal.reverseIndex();
  parser.setState(ParserState.NORMAL);
};
escapedStateHandler['%'] = (parser, terminal) => {
  // ESC % Select default/utf-8 character set.
  // @ = default, G = utf-8
  terminal.setgLevel(0);
  terminal.setgCharset(0, DEFAULT_CHARSET); // US (default)
  parser.setState(ParserState.NORMAL);
  parser.skipNextChar();
};
escapedStateHandler[C0.CAN] = (parser) => parser.setState(ParserState.NORMAL);

const csiParamStateHandler: {[key: string]: (parser: Parser) => void} = {};
csiParamStateHandler['?'] = (parser) => parser.setPrefix('?');
csiParamStateHandler['>'] = (parser) => parser.setPrefix('>');
csiParamStateHandler['!'] = (parser) => parser.setPrefix('!');
csiParamStateHandler['0'] = (parser) => parser.setParam(parser.getParam() * 10);
csiParamStateHandler['1'] = (parser) => parser.setParam(parser.getParam() * 10 + 1);
csiParamStateHandler['2'] = (parser) => parser.setParam(parser.getParam() * 10 + 2);
csiParamStateHandler['3'] = (parser) => parser.setParam(parser.getParam() * 10 + 3);
csiParamStateHandler['4'] = (parser) => parser.setParam(parser.getParam() * 10 + 4);
csiParamStateHandler['5'] = (parser) => parser.setParam(parser.getParam() * 10 + 5);
csiParamStateHandler['6'] = (parser) => parser.setParam(parser.getParam() * 10 + 6);
csiParamStateHandler['7'] = (parser) => parser.setParam(parser.getParam() * 10 + 7);
csiParamStateHandler['8'] = (parser) => parser.setParam(parser.getParam() * 10 + 8);
csiParamStateHandler['9'] = (parser) => parser.setParam(parser.getParam() * 10 + 9);
csiParamStateHandler['$'] = (parser) => parser.setPostfix('$');
csiParamStateHandler['"'] = (parser) => parser.setPostfix('"');
csiParamStateHandler[' '] = (parser) => parser.setPostfix(' ');
csiParamStateHandler['\''] = (parser) => parser.setPostfix('\'');
csiParamStateHandler[';'] = (parser) => parser.finalizeParam();
csiParamStateHandler[C0.CAN] = (parser) => parser.setState(ParserState.NORMAL);

const csiStateHandler: {[key: string]: (handler: IInputHandler, params: number[], prefix: string, postfix: string, parser: Parser) => void} = {};
csiStateHandler['@'] = (handler, params, prefix) => handler.insertChars(params);
csiStateHandler['A'] = (handler, params, prefix) => handler.cursorUp(params);
csiStateHandler['B'] = (handler, params, prefix) => handler.cursorDown(params);
csiStateHandler['C'] = (handler, params, prefix) => handler.cursorForward(params);
csiStateHandler['D'] = (handler, params, prefix) => handler.cursorBackward(params);
csiStateHandler['E'] = (handler, params, prefix) => handler.cursorNextLine(params);
csiStateHandler['F'] = (handler, params, prefix) => handler.cursorPrecedingLine(params);
csiStateHandler['G'] = (handler, params, prefix) => handler.cursorCharAbsolute(params);
csiStateHandler['H'] = (handler, params, prefix) => handler.cursorPosition(params);
csiStateHandler['I'] = (handler, params, prefix) => handler.cursorForwardTab(params);
csiStateHandler['J'] = (handler, params, prefix) => handler.eraseInDisplay(params);
csiStateHandler['K'] = (handler, params, prefix) => handler.eraseInLine(params);
csiStateHandler['L'] = (handler, params, prefix) => handler.insertLines(params);
csiStateHandler['M'] = (handler, params, prefix) => handler.deleteLines(params);
csiStateHandler['P'] = (handler, params, prefix) => handler.deleteChars(params);
csiStateHandler['S'] = (handler, params, prefix) => handler.scrollUp(params);
csiStateHandler['T'] = (handler, params, prefix) => {
  if (params.length < 2 && !prefix) {
    handler.scrollDown(params);
  }
};
csiStateHandler['X'] = (handler, params, prefix) => handler.eraseChars(params);
csiStateHandler['Z'] = (handler, params, prefix) => handler.cursorBackwardTab(params);
csiStateHandler['`'] = (handler, params, prefix) => handler.charPosAbsolute(params);
csiStateHandler['a'] = (handler, params, prefix) => handler.HPositionRelative(params);
csiStateHandler['b'] = (handler, params, prefix) => handler.repeatPrecedingCharacter(params);
csiStateHandler['c'] = (handler, params, prefix) => handler.sendDeviceAttributes(params);
csiStateHandler['d'] = (handler, params, prefix) => handler.linePosAbsolute(params);
csiStateHandler['e'] = (handler, params, prefix) => handler.VPositionRelative(params);
csiStateHandler['f'] = (handler, params, prefix) => handler.HVPosition(params);
csiStateHandler['g'] = (handler, params, prefix) => handler.tabClear(params);
csiStateHandler['h'] = (handler, params, prefix) => handler.setMode(params);
csiStateHandler['l'] = (handler, params, prefix) => handler.resetMode(params);
csiStateHandler['m'] = (handler, params, prefix) => handler.charAttributes(params);
csiStateHandler['n'] = (handler, params, prefix) => handler.deviceStatus(params);
csiStateHandler['p'] = (handler, params, prefix) => {
  switch (prefix) {
    case '!': handler.softReset(params); break;
  }
};
csiStateHandler['q'] = (handler, params, prefix, postfix) => {
  if (postfix === ' ') {
    handler.setCursorStyle(params);
  }
};
csiStateHandler['r'] = (handler, params) => handler.setScrollRegion(params);
csiStateHandler['s'] = (handler, params) => handler.saveCursor(params);
csiStateHandler['u'] = (handler, params) => handler.restoreCursor(params);
csiStateHandler[C0.CAN] = (handler, params, prefix, postfix, parser) => parser.setState(ParserState.NORMAL);

export enum ParserState {
  NORMAL = 0,
  ESCAPED = 1,
  CSI_PARAM = 2,
  CSI = 3,
  OSC = 4,
  CHARSET = 5,
  DCS = 6,
  IGNORE = 7
}

/**
 * The terminal's parser, all input into the terminal goes through the parser
 * which parses and defers the actual input handling the the IInputHandler
 * specified in the constructor.
 */
export class Parser {
  private _state: ParserState;
  private _position: number;

  // TODO: Remove terminal when handler can do everything
  constructor(
    private _inputHandler: IInputHandler,
    private _terminal: any
  ) {
    this._state = ParserState.NORMAL;
  }

  /**
   * Parse and handle data.
   *
   * @param data The data to parse.
   */
  public parse(data: string): ParserState {
    const l = data.length;
    let j;
    let cs;
    let ch;
    let code;
    let low;

    const cursorStartX = this._terminal.buffer.x;
    const cursorStartY = this._terminal.buffer.y;

    if (this._terminal.debug) {
      this._terminal.log('data: ' + data);
    }

    this._position = 0;
    // apply leftover surrogate high from last write
    if (this._terminal.surrogate_high) {
      data = this._terminal.surrogate_high + data;
      this._terminal.surrogate_high = '';
    }

    for (; this._position < l; this._position++) {
      ch = data[this._position];

      // FIXME: higher chars than 0xa0 are not allowed in escape sequences
      //        --> maybe move to default
      code = data.charCodeAt(this._position);
      if (0xD800 <= code && code <= 0xDBFF) {
        // we got a surrogate high
        // get surrogate low (next 2 bytes)
        low = data.charCodeAt(this._position + 1);
        if (isNaN(low)) {
          // end of data stream, save surrogate high
          this._terminal.surrogate_high = ch;
          continue;
        }
        code = ((code - 0xD800) * 0x400) + (low - 0xDC00) + 0x10000;
        ch += data.charAt(this._position + 1);
      }
      // surrogate low - already handled above
      if (0xDC00 <= code && code <= 0xDFFF)
        continue;

      switch (this._state) {
        case ParserState.NORMAL:
          if (ch in normalStateHandler) {
            normalStateHandler[ch](this, this._inputHandler);
          } else {
            this._inputHandler.addChar(ch, code);
          }
          break;
        case ParserState.ESCAPED:
          if (ch in escapedStateHandler) {
            escapedStateHandler[ch](this, this._terminal);
            // Skip switch as it was just handled
            break;
          }
          switch (ch) {

            // ESC (,),*,+,-,. Designate G0-G2 Character Set.
            case '(': // <-- this seems to get all the attention
            case ')':
            case '*':
            case '+':
            case '-':
            case '.':
              switch (ch) {
                case '(':
                  this._terminal.gcharset = 0;
                  break;
                case ')':
                  this._terminal.gcharset = 1;
                  break;
                case '*':
                  this._terminal.gcharset = 2;
                  break;
                case '+':
                  this._terminal.gcharset = 3;
                  break;
                case '-':
                  this._terminal.gcharset = 1;
                  break;
                case '.':
                  this._terminal.gcharset = 2;
                  break;
              }
              this._state = ParserState.CHARSET;
              break;

            // Designate G3 Character Set (VT300).
            // A = ISO Latin-1 Supplemental.
            // Not implemented.
            case '/':
              this._terminal.gcharset = 3;
              this._state = ParserState.CHARSET;
              this._position--;
              break;

            // ESC N
            // Single Shift Select of G2 Character Set
            // ( SS2 is 0x8e). This affects next character only.
            case 'N':
              this._state = ParserState.NORMAL;
              break;
            // ESC O
            // Single Shift Select of G3 Character Set
            // ( SS3 is 0x8f). This affects next character only.
            case 'O':
              this._state = ParserState.NORMAL;
              break;
            // ESC n
            // Invoke the G2 Character Set as GL (LS2).
            case 'n':
              this._terminal.setgLevel(2);
              this._state = ParserState.NORMAL;
              break;
            // ESC o
            // Invoke the G3 Character Set as GL (LS3).
            case 'o':
              this._terminal.setgLevel(3);
              this._state = ParserState.NORMAL;
              break;
            // ESC |
            // Invoke the G3 Character Set as GR (LS3R).
            case '|':
              this._terminal.setgLevel(3);
              this._state = ParserState.NORMAL;
              break;
            // ESC }
            // Invoke the G2 Character Set as GR (LS2R).
            case '}':
              this._terminal.setgLevel(2);
              this._state = ParserState.NORMAL;
              break;
            // ESC ~
            // Invoke the G1 Character Set as GR (LS1R).
            case '~':
              this._terminal.setgLevel(1);
              this._state = ParserState.NORMAL;
              break;

            // ESC 7 Save Cursor (DECSC).
            case '7':
              this._inputHandler.saveCursor();
              this._state = ParserState.NORMAL;
              break;

            // ESC 8 Restore Cursor (DECRC).
            case '8':
              this._inputHandler.restoreCursor();
              this._state = ParserState.NORMAL;
              break;

            // ESC # 3 DEC line height/width
            case '#':
              this._state = ParserState.NORMAL;
              this._position++;
              break;

            // ESC H Tab Set (HTS is 0x88).
            case 'H':
              this._terminal.tabSet();
              this._state = ParserState.NORMAL;
              break;

            // ESC = Application Keypad (DECKPAM).
            case '=':
              this._terminal.log('Serial port requested application keypad.');
              this._terminal.applicationKeypad = true;
              if (this._terminal.viewport) {
                this._terminal.viewport.syncScrollArea();
              }
              this._state = ParserState.NORMAL;
              break;

            // ESC > Normal Keypad (DECKPNM).
            case '>':
              this._terminal.log('Switching back to normal keypad.');
              this._terminal.applicationKeypad = false;
              if (this._terminal.viewport) {
                this._terminal.viewport.syncScrollArea();
              }
              this._state = ParserState.NORMAL;
              break;

            default:
              this._state = ParserState.NORMAL;
              this._terminal.error('Unknown ESC control: %s.', ch);
              break;
          }
          break;

        case ParserState.CHARSET:
          if (ch in CHARSETS) {
            cs = CHARSETS[ch];
            if (ch === '/') { // ISOLatin is actually /A
              this.skipNextChar();
            }
          } else {
            cs = DEFAULT_CHARSET;
          }
          this._terminal.setgCharset(this._terminal.gcharset, cs);
          this._terminal.gcharset = null;
          this._state = ParserState.NORMAL;
          break;

        case ParserState.OSC:
          // OSC Ps ; Pt ST
          // OSC Ps ; Pt BEL
          //   Set Text Parameters.
          if (ch === C0.ESC || ch === C0.BEL) {
            if (ch === C0.ESC) this._position++;

            this._terminal.params.push(this._terminal.currentParam);

            switch (this._terminal.params[0]) {
              case 0:
              case 1:
              case 2:
                if (this._terminal.params[1]) {
                  this._terminal.title = this._terminal.params[1];
                  this._terminal.handleTitle(this._terminal.title);
                }
                break;
              case 3:
                // set X property
                break;
              case 4:
              case 5:
                // change dynamic colors
                break;
              case 10:
              case 11:
              case 12:
              case 13:
              case 14:
              case 15:
              case 16:
              case 17:
              case 18:
              case 19:
                // change dynamic ui colors
                break;
              case 46:
                // change log file
                break;
              case 50:
                // dynamic font
                break;
              case 51:
                // emacs shell
                break;
              case 52:
                // manipulate selection data
                break;
              case 104:
              case 105:
              case 110:
              case 111:
              case 112:
              case 113:
              case 114:
              case 115:
              case 116:
              case 117:
              case 118:
                // reset colors
                break;
            }

            this._terminal.params = [];
            this._terminal.currentParam = 0;
            this._state = ParserState.NORMAL;
          } else {
            if (!this._terminal.params.length) {
              if (ch >= '0' && ch <= '9') {
                this._terminal.currentParam =
                  this._terminal.currentParam * 10 + ch.charCodeAt(0) - 48;
              } else if (ch === ';') {
                this._terminal.params.push(this._terminal.currentParam);
                this._terminal.currentParam = '';
              }
            } else {
              this._terminal.currentParam += ch;
            }
          }
          break;

        case ParserState.CSI_PARAM:
          if (ch in csiParamStateHandler) {
            csiParamStateHandler[ch](this);
            break;
          }
          this.finalizeParam();
          // Fall through the CSI as this character should be the CSI code.
          this._state = ParserState.CSI;

        case ParserState.CSI:
          if (ch in csiStateHandler) {
            if (this._terminal.debug) {
              this._terminal.log(`CSI ${this._terminal.prefix ? this._terminal.prefix : ''} ${this._terminal.params ? this._terminal.params.join(';') : ''} ${this._terminal.postfix ? this._terminal.postfix : ''} ${ch}`);
            }
            csiStateHandler[ch](this._inputHandler, this._terminal.params, this._terminal.prefix, this._terminal.postfix, this);
          } else {
            this._terminal.error('Unknown CSI code: %s.', ch);
          }

          this._state = ParserState.NORMAL;
          this._terminal.prefix = '';
          this._terminal.postfix = '';
          break;

        case ParserState.DCS:
          if (ch === C0.ESC || ch === C0.BEL) {
            if (ch === C0.ESC) this._position++;
            let pt;
            let valid: boolean;

            switch (this._terminal.prefix) {
              // User-Defined Keys (DECUDK).
              case '':
                break;

              // Request Status String (DECRQSS).
              // test: echo -e '\eP$q"p\e\\'
              case '$q':
                pt = this._terminal.currentParam;
                valid = false;

                switch (pt) {
                  // DECSCA
                  case '"q':
                    pt = '0"q';
                    break;

                  // DECSCL
                  case '"p':
                    pt = '61"p';
                    break;

                  // DECSTBM
                  case 'r':
                    pt = ''
                      + (this._terminal.buffer.scrollTop + 1)
                      + ';'
                      + (this._terminal.buffer.scrollBottom + 1)
                      + 'r';
                    break;

                  // SGR
                  case 'm':
                    pt = '0m';
                    break;

                  default:
                    this._terminal.error('Unknown DCS Pt: %s.', pt);
                    pt = '';
                    break;
                }

                this._terminal.send(C0.ESC + 'P' + +valid + '$r' + pt + C0.ESC + '\\');
                break;

              // Set Termcap/Terminfo Data (xterm, experimental).
              case '+p':
                break;

              // Request Termcap/Terminfo String (xterm, experimental)
              // Regular xterm does not even respond to this sequence.
              // This can cause a small glitch in vim.
              // test: echo -ne '\eP+q6b64\e\\'
              case '+q':
                pt = this._terminal.currentParam;
                valid = false;

                this._terminal.send(C0.ESC + 'P' + +valid + '+r' + pt + C0.ESC + '\\');
                break;

              default:
                this._terminal.error('Unknown DCS prefix: %s.', this._terminal.prefix);
                break;
            }

            this._terminal.currentParam = 0;
            this._terminal.prefix = '';
            this._state = ParserState.NORMAL;
          } else if (!this._terminal.currentParam) {
            if (!this._terminal.prefix && ch !== '$' && ch !== '+') {
              this._terminal.currentParam = ch;
            } else if (this._terminal.prefix.length === 2) {
              this._terminal.currentParam = ch;
            } else {
              this._terminal.prefix += ch;
            }
          } else {
            this._terminal.currentParam += ch;
          }
          break;

        case ParserState.IGNORE:
          // For PM and APC.
          if (ch === C0.ESC || ch === C0.BEL) {
            if (ch === C0.ESC) this._position++;
            this._state = ParserState.NORMAL;
          }
          break;
      }
    }

    // Fire the cursormove event if it's moved. This is done inside the parser
    // as a render cannot happen in the middle of a parsing round.
    if (this._terminal.buffer.x !== cursorStartX || this._terminal.buffer.y !== cursorStartY) {
      this._terminal.emit('cursormove');
    }

    return this._state;
  }

  /**
   * Set the parser's current parsing state.
   *
   * @param state The new state.
   */
  public setState(state: ParserState): void {
    this._state = state;
  }

  /**
   * Sets the parsier's current prefix. CSI codes can have prefixes of '?', '>'
   * or '!'.
   *
   * @param prefix The prefix.
   */
  public setPrefix(prefix: string): void {
    this._terminal.prefix = prefix;
  }

  /**
   * Sets the parsier's current prefix. CSI codes can have postfixes of '$',
   * '"', ' ', '\''.
   *
   * @param postfix The postfix.
   */
  public setPostfix(postfix: string): void {
    this._terminal.postfix = postfix;
  }

  /**
   * Sets the parser's current parameter.
   *
   * @param param the parameter.
   */
  public setParam(param: number): void {
    this._terminal.currentParam = param;
  }

  /**
   * Gets the parser's current parameter.
   */
  public getParam(): number {
    return this._terminal.currentParam;
  }

  /**
   * Finalizes the parser's current parameter, adding it to the list of
   * parameters and setting the new current parameter to 0.
   */
  public finalizeParam(): void {
    this._terminal.params.push(this._terminal.currentParam);
    this._terminal.currentParam = 0;
  }

  /**
   * Tell the parser to skip the next character.
   */
  public skipNextChar(): void {
    this._position++;
  }

  /**
   * Tell the parser to repeat parsing the current character (for example if it
   * needs parsing using a different state.
   */
  // public repeatChar(): void {
  //   this._position--;
  // }
}
