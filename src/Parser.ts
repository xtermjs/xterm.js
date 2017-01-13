import { C0 } from './EscapeSequences';
import { IInputHandler } from './Interfaces';
import { CHARSETS } from './Charsets';

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

const csiStateHandler: {[key: string]: (handler: IInputHandler, params: number[], prefix: string) => void} = {};
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
csiStateHandler['r'] = (handler, params) => handler.setScrollRegion(params);
csiStateHandler['s'] = (handler, params) => handler.saveCursor(params);
csiStateHandler['u'] = (handler, params) => handler.restoreCursor(params);

enum ParserState {
  NORMAL = 0,
  ESCAPED = 1,
  CSI_PARAM = 2,
  CSI = 3,
  OSC = 4,
  CHARSET = 5,
  DCS = 6,
  IGNORE = 7
}

export class Parser {
  private state: ParserState;

  // TODO: Remove terminal when handler can do everything
  constructor(
    private _inputHandler: IInputHandler,
    private _terminal: any
  ) {
    this.state = ParserState.NORMAL;
  }

  public parse(data: string) {
    let l = data.length, i = 0, j, cs, ch, code, low;

    // apply leftover surrogate high from last write
    if (this._terminal.surrogate_high) {
      data = this._terminal.surrogate_high + data;
      this._terminal.surrogate_high = '';
    }

    for (; i < l; i++) {
      ch = data[i];

      // FIXME: higher chars than 0xa0 are not allowed in escape sequences
      //        --> maybe move to default
      code = data.charCodeAt(i);
      if (0xD800 <= code && code <= 0xDBFF) {
        // we got a surrogate high
        // get surrogate low (next 2 bytes)
        low = data.charCodeAt(i + 1);
        if (isNaN(low)) {
          // end of data stream, save surrogate high
          this._terminal.surrogate_high = ch;
          continue;
        }
        code = ((code - 0xD800) * 0x400) + (low - 0xDC00) + 0x10000;
        ch += data.charAt(i + 1);
      }
      // surrogate low - already handled above
      if (0xDC00 <= code && code <= 0xDFFF)
        continue;

      switch (this.state) {
        case ParserState.NORMAL:
          if (ch in normalStateHandler) {
            normalStateHandler[ch](this, this._inputHandler);
          } else {
            this._inputHandler.addChar(ch, code);
          }
          break;
        case ParserState.ESCAPED:
          switch (ch) {
            // ESC [ Control Sequence Introducer ( CSI is 0x9b).
            case '[':
              this._terminal.params = [];
              this._terminal.currentParam = 0;
              this.state = ParserState.CSI_PARAM;
              break;

            // ESC ] Operating System Command ( OSC is 0x9d).
            case ']':
              this._terminal.params = [];
              this._terminal.currentParam = 0;
              this.state = ParserState.OSC;
              break;

            // ESC P Device Control String ( DCS is 0x90).
            case 'P':
              this._terminal.params = [];
              this._terminal.currentParam = 0;
              this.state = ParserState.DCS;
              break;

            // ESC _ Application Program Command ( APC is 0x9f).
            case '_':
              this.state = ParserState.IGNORE;
              break;

            // ESC ^ Privacy Message ( PM is 0x9e).
            case '^':
              this.state = ParserState.IGNORE;
              break;

            // ESC c Full Reset (RIS).
            case 'c':
              this._terminal.reset();
              break;

            // ESC E Next Line ( NEL is 0x85).
            // ESC D Index ( IND is 0x84).
            case 'E':
              this._terminal.x = 0;
              ;
            case 'D':
              this._terminal.index();
              this.state = ParserState.NORMAL;
              break;

            // ESC M Reverse Index ( RI is 0x8d).
            case 'M':
              this._terminal.reverseIndex();
              this.state = ParserState.NORMAL;
              break;

            // ESC % Select default/utf-8 character set.
            // @ = default, G = utf-8
            case '%':
              // this.charset = null;
              this._terminal.setgLevel(0);
              this._terminal.setgCharset(0, CHARSETS.US);
              this.state = ParserState.NORMAL;
              i++;
              break;

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
              this.state = ParserState.CHARSET;
              break;

            // Designate G3 Character Set (VT300).
            // A = ISO Latin-1 Supplemental.
            // Not implemented.
            case '/':
              this._terminal.gcharset = 3;
              this.state = ParserState.CHARSET;
              i--;
              break;

            // ESC N
            // Single Shift Select of G2 Character Set
            // ( SS2 is 0x8e). This affects next character only.
            case 'N':
              break;
            // ESC O
            // Single Shift Select of G3 Character Set
            // ( SS3 is 0x8f). This affects next character only.
            case 'O':
              break;
            // ESC n
            // Invoke the G2 Character Set as GL (LS2).
            case 'n':
              this._terminal.setgLevel(2);
              break;
            // ESC o
            // Invoke the G3 Character Set as GL (LS3).
            case 'o':
              this._terminal.setgLevel(3);
              break;
            // ESC |
            // Invoke the G3 Character Set as GR (LS3R).
            case '|':
              this._terminal.setgLevel(3);
              break;
            // ESC }
            // Invoke the G2 Character Set as GR (LS2R).
            case '}':
              this._terminal.setgLevel(2);
              break;
            // ESC ~
            // Invoke the G1 Character Set as GR (LS1R).
            case '~':
              this._terminal.setgLevel(1);
              break;

            // ESC 7 Save Cursor (DECSC).
            case '7':
              this._inputHandler.saveCursor();
              this.state = ParserState.NORMAL;
              break;

            // ESC 8 Restore Cursor (DECRC).
            case '8':
              this._inputHandler.restoreCursor();
              this.state = ParserState.NORMAL;
              break;

            // ESC # 3 DEC line height/width
            case '#':
              this.state = ParserState.NORMAL;
              i++;
              break;

            // ESC H Tab Set (HTS is 0x88).
            case 'H':
              this._terminal.tabSet();
              this.state = ParserState.NORMAL;
              break;

            // ESC = Application Keypad (DECKPAM).
            case '=':
              this._terminal.log('Serial port requested application keypad.');
              this._terminal.applicationKeypad = true;
              this._terminal.viewport.syncScrollArea();
              this.state = ParserState.NORMAL;
              break;

            // ESC > Normal Keypad (DECKPNM).
            case '>':
              this._terminal.log('Switching back to normal keypad.');
              this._terminal.applicationKeypad = false;
              this._terminal.viewport.syncScrollArea();
              this.state = ParserState.NORMAL;
              break;

            default:
              this.state = ParserState.NORMAL;
              this._terminal.error('Unknown ESC control: %s.', ch);
              break;
          }
          break;

        case ParserState.CHARSET:
          switch (ch) {
            case '0': // DEC Special Character and Line Drawing Set.
              cs = CHARSETS.SCLD;
              break;
            case 'A': // UK
              cs = CHARSETS.UK;
              break;
            case 'B': // United States (USASCII).
              cs = CHARSETS.US;
              break;
            case '4': // Dutch
              cs = CHARSETS.Dutch;
              break;
            case 'C': // Finnish
            case '5':
              cs = CHARSETS.Finnish;
              break;
            case 'R': // French
              cs = CHARSETS.French;
              break;
            case 'Q': // FrenchCanadian
              cs = CHARSETS.FrenchCanadian;
              break;
            case 'K': // German
              cs = CHARSETS.German;
              break;
            case 'Y': // Italian
              cs = CHARSETS.Italian;
              break;
            case 'E': // NorwegianDanish
            case '6':
              cs = CHARSETS.NorwegianDanish;
              break;
            case 'Z': // Spanish
              cs = CHARSETS.Spanish;
              break;
            case 'H': // Swedish
            case '7':
              cs = CHARSETS.Swedish;
              break;
            case '=': // Swiss
              cs = CHARSETS.Swiss;
              break;
            case '/': // ISOLatin (actually /A)
              cs = CHARSETS.ISOLatin;
              i++;
              break;
            default: // Default
              cs = CHARSETS.US;
              break;
          }
          this._terminal.setgCharset(this._terminal.gcharset, cs);
          this._terminal.gcharset = null;
          this.state = ParserState.NORMAL;
          break;

        case ParserState.OSC:
          // OSC Ps ; Pt ST
          // OSC Ps ; Pt BEL
          //   Set Text Parameters.
          if (ch === C0.ESC || ch === C0.BEL) {
            if (ch === C0.ESC) i++;

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
            this.state = ParserState.NORMAL;
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
          this.state = ParserState.CSI;

        case ParserState.CSI:
          if (ch in csiStateHandler) {
            csiStateHandler[ch](this._inputHandler, this._terminal.params, this._terminal.prefix);
          } else {
            this._terminal.error('Unknown CSI code: %s.', ch);
          }

          this.state = ParserState.NORMAL;
          this._terminal.prefix = '';
          this._terminal.postfix = '';
          break;

        case ParserState.DCS:
          if (ch === C0.ESC || ch === C0.BEL) {
            if (ch === C0.ESC) i++;

            switch (this._terminal.prefix) {
              // User-Defined Keys (DECUDK).
              case '':
                break;

              // Request Status String (DECRQSS).
              // test: echo -e '\eP$q"p\e\\'
              case '$q':
                let pt = this._terminal.currentParam
                , valid = false;

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
                      + (this._terminal.scrollTop + 1)
                      + ';'
                      + (this._terminal.scrollBottom + 1)
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
                // TODO: Don't declare pt twice
                /*let*/ pt = this._terminal.currentParam
                , valid = false;

                this._terminal.send(C0.ESC + 'P' + +valid + '+r' + pt + C0.ESC + '\\');
                break;

              default:
                this._terminal.error('Unknown DCS prefix: %s.', this._terminal.prefix);
                break;
            }

            this._terminal.currentParam = 0;
            this._terminal.prefix = '';
            this.state = ParserState.NORMAL;
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
            if (ch === C0.ESC) i++;
            this.state = ParserState.NORMAL;
          }
          break;
      }
    }
  }

  public setState(state: ParserState): void {
    this.state = state;
  }

  public setPrefix(prefix: string): void {
    this._terminal.prefix = prefix;
  }

  public setParam(param: number) {
    this._terminal.currentParam = param;
  }

  public getParam(): number {
    return this._terminal.currentParam;
  }

  public finalizeParam(): void {
    this._terminal.params.push(this._terminal.currentParam);
    this._terminal.currentParam = 0;
  }

  public setPostfix(postfix: string): void {
    this._terminal.postfix = postfix;
  }
}
