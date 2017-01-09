import { C0 } from './EscapeSequences';
import { IInputHandler } from './Interfaces';
import { CHARSETS } from './Charsets';

const normalStateHandler: {[key: string]: (handler: IInputHandler) => void} = {};
normalStateHandler[C0.BEL] = (handler) => handler.bell();
normalStateHandler[C0.LF] = (handler) => handler.lineFeed();
normalStateHandler[C0.VT] = normalStateHandler[C0.LF];
normalStateHandler[C0.FF] = normalStateHandler[C0.LF];
normalStateHandler[C0.CR] = (handler) => handler.carriageReturn();
normalStateHandler[C0.BS] = (handler) => handler.backspace();
normalStateHandler[C0.HT] = (handler) => handler.tab();
normalStateHandler[C0.SO] = (handler) => handler.shiftOut();
normalStateHandler[C0.SI] = (handler) => handler.shiftIn();

enum ParserState {
  NORMAL = 0,
  ESCAPED = 1,
  CSI = 2,
  OSC = 3,
  CHARSET = 4,
  DCS = 5,
  IGNORE = 6
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
    let l = data.length, i = 0, j, cs, ch, code, low, ch_width, row;

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

      if (this.state === ParserState.NORMAL) {
        if (ch in normalStateHandler) {
          normalStateHandler[ch](this._inputHandler);
          // Skip switch statement (eventually everything will be handled this way
          continue;
        }
      }

      switch (this.state) {
        case ParserState.NORMAL:
          switch (ch) {
            case C0.ESC:
              this.state = ParserState.ESCAPED;
              break;

            default:
              // ' '
              // calculate print space
              // expensive call, therefore we save width in line buffer
              ch_width = wcwidth(code);

              if (ch >= ' ') {
                if (this._terminal.charset && this._terminal.charset[ch]) {
                  ch = this._terminal.charset[ch];
                }

                row = this._terminal.y + this._terminal.ybase;

                // insert combining char in last cell
                // FIXME: needs handling after cursor jumps
                if (!ch_width && this._terminal.x) {
                  // dont overflow left
                  if (this._terminal.lines.get(row)[this._terminal.x - 1]) {
                    if (!this._terminal.lines.get(row)[this._terminal.x - 1][2]) {

                      // found empty cell after fullwidth, need to go 2 cells back
                      if (this._terminal.lines.get(row)[this._terminal.x - 2])
                        this._terminal.lines.get(row)[this._terminal.x - 2][1] += ch;

                    } else {
                      this._terminal.lines.get(row)[this._terminal.x - 1][1] += ch;
                    }
                    this._terminal.updateRange(this._terminal.y);
                  }
                  break;
                }

                // goto next line if ch would overflow
                // TODO: needs a global min terminal width of 2
                if (this._terminal.x + ch_width - 1 >= this._terminal.cols) {
                  // autowrap - DECAWM
                  if (this._terminal.wraparoundMode) {
                    this._terminal.x = 0;
                    this._terminal.y++;
                    if (this._terminal.y > this._terminal.scrollBottom) {
                      this._terminal.y--;
                      this._terminal.scroll();
                    }
                  } else {
                    this._terminal.x = this._terminal.cols - 1;
                    if (ch_width === 2)  // FIXME: check for xterm behavior
                      continue;
                  }
                }
                row = this._terminal.y + this._terminal.ybase;

                // insert mode: move characters to right
                if (this._terminal.insertMode) {
                  // do this twice for a fullwidth char
                  for (let moves = 0; moves < ch_width; ++moves) {
                    // remove last cell, if it's width is 0
                    // we have to adjust the second last cell as well
                    const removed = this._terminal.lines.get(this._terminal.y + this._terminal.ybase).pop();
                    if (removed[2] === 0
                        && this._terminal.lines.get(row)[this._terminal.cols - 2]
                    && this._terminal.lines.get(row)[this._terminal.cols - 2][2] === 2)
                      this._terminal.lines.get(row)[this._terminal.cols - 2] = [this._terminal.curAttr, ' ', 1];

                    // insert empty cell at cursor
                    this._terminal.lines.get(row).splice(this._terminal.x, 0, [this._terminal.curAttr, ' ', 1]);
                  }
                }

                this._terminal.lines.get(row)[this._terminal.x] = [this._terminal.curAttr, ch, ch_width];
                this._terminal.x++;
                this._terminal.updateRange(this._terminal.y);

                // fullwidth char - set next cell width to zero and advance cursor
                if (ch_width === 2) {
                  this._terminal.lines.get(row)[this._terminal.x] = [this._terminal.curAttr, '', 0];
                  this._terminal.x++;
                }
              }
              break;
          }
          break;
        case ParserState.ESCAPED:
          switch (ch) {
            // ESC [ Control Sequence Introducer ( CSI is 0x9b).
            case '[':
              this._terminal.params = [];
              this._terminal.currentParam = 0;
              this.state = ParserState.CSI;
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
              this._terminal.saveCursor();
              this.state = ParserState.NORMAL;
              break;

            // ESC 8 Restore Cursor (DECRC).
            case '8':
              this._terminal.restoreCursor();
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

        case ParserState.CSI:
          // '?', '>', '!'
          if (ch === '?' || ch === '>' || ch === '!') {
            this._terminal.prefix = ch;
            break;
          }

          // 0 - 9
          if (ch >= '0' && ch <= '9') {
            this._terminal.currentParam = this._terminal.currentParam * 10 + ch.charCodeAt(0) - 48;
            break;
          }

          // '$', '"', ' ', '\''
          if (ch === '$' || ch === '"' || ch === ' ' || ch === '\'') {
            this._terminal.postfix = ch;
            break;
          }

          this._terminal.params.push(this._terminal.currentParam);
          this._terminal.currentParam = 0;

          // ';'
          if (ch === ';') break;

          this.state = ParserState.NORMAL;

          switch (ch) {
            // CSI Ps A
            // Cursor Up Ps Times (default = 1) (CUU).
            case 'A':
              this._terminal.cursorUp(this._terminal.params);
              break;

            // CSI Ps B
            // Cursor Down Ps Times (default = 1) (CUD).
            case 'B':
              this._terminal.cursorDown(this._terminal.params);
              break;

            // CSI Ps C
            // Cursor Forward Ps Times (default = 1) (CUF).
            case 'C':
              this._terminal.cursorForward(this._terminal.params);
              break;

            // CSI Ps D
            // Cursor Backward Ps Times (default = 1) (CUB).
            case 'D':
              this._terminal.cursorBackward(this._terminal.params);
              break;

            // CSI Ps ; Ps H
            // Cursor Position [row;column] (default = [1,1]) (CUP).
            case 'H':
              this._terminal.cursorPos(this._terminal.params);
              break;

            // CSI Ps J  Erase in Display (ED).
            case 'J':
              this._terminal.eraseInDisplay(this._terminal.params);
              break;

            // CSI Ps K  Erase in Line (EL).
            case 'K':
              this._terminal.eraseInLine(this._terminal.params);
              break;

            // CSI Pm m  Character Attributes (SGR).
            case 'm':
              if (!this._terminal.prefix) {
                this._terminal.charAttributes(this._terminal.params);
              }
              break;

            // CSI Ps n  Device Status Report (DSR).
            case 'n':
              if (!this._terminal.prefix) {
                this._terminal.deviceStatus(this._terminal.params);
              }
              break;

              /**
               * Additions
               */

            // CSI Ps @
            // Insert Ps (Blank) Character(s) (default = 1) (ICH).
            case '@':
              this._terminal.insertChars(this._terminal.params);
              break;

            // CSI Ps E
            // Cursor Next Line Ps Times (default = 1) (CNL).
            case 'E':
              this._terminal.cursorNextLine(this._terminal.params);
              break;

            // CSI Ps F
            // Cursor Preceding Line Ps Times (default = 1) (CNL).
            case 'F':
              this._terminal.cursorPrecedingLine(this._terminal.params);
              break;

            // CSI Ps G
            // Cursor Character Absolute  [column] (default = [row,1]) (CHA).
            case 'G':
              this._terminal.cursorCharAbsolute(this._terminal.params);
              break;

            // CSI Ps L
            // Insert Ps Line(s) (default = 1) (IL).
            case 'L':
              this._terminal.insertLines(this._terminal.params);
              break;

            // CSI Ps M
            // Delete Ps Line(s) (default = 1) (DL).
            case 'M':
              this._terminal.deleteLines(this._terminal.params);
              break;

            // CSI Ps P
            // Delete Ps Character(s) (default = 1) (DCH).
            case 'P':
              this._terminal.deleteChars(this._terminal.params);
              break;

            // CSI Ps X
            // Erase Ps Character(s) (default = 1) (ECH).
            case 'X':
              this._terminal.eraseChars(this._terminal.params);
              break;

            // CSI Pm `  Character Position Absolute
            //   [column] (default = [row,1]) (HPA).
            case '`':
              this._terminal.charPosAbsolute(this._terminal.params);
              break;

            // 141 61 a * HPR -
            // Horizontal Position Relative
            case 'a':
              this._terminal.HPositionRelative(this._terminal.params);
              break;

            // CSI P s c
            // Send Device Attributes (Primary DA).
            // CSI > P s c
            // Send Device Attributes (Secondary DA)
            case 'c':
              this._terminal.sendDeviceAttributes(this._terminal.params);
              break;

            // CSI Pm d
            // Line Position Absolute  [row] (default = [1,column]) (VPA).
            case 'd':
              this._terminal.linePosAbsolute(this._terminal.params);
              break;

            // 145 65 e * VPR - Vertical Position Relative
            case 'e':
              this._terminal.VPositionRelative(this._terminal.params);
              break;

            // CSI Ps ; Ps f
            //   Horizontal and Vertical Position [row;column] (default =
            //   [1,1]) (HVP).
            case 'f':
              this._terminal.HVPosition(this._terminal.params);
              break;

            // CSI Pm h  Set Mode (SM).
            // CSI ? Pm h - mouse escape codes, cursor escape codes
            case 'h':
              this._terminal.setMode(this._terminal.params);
              break;

            // CSI Pm l  Reset Mode (RM).
            // CSI ? Pm l
            case 'l':
              this._terminal.resetMode(this._terminal.params);
              break;

            // CSI Ps ; Ps r
            //   Set Scrolling Region [top;bottom] (default = full size of win-
            //   dow) (DECSTBM).
            // CSI ? Pm r
            case 'r':
              this._terminal.setScrollRegion(this._terminal.params);
              break;

            // CSI s
            //   Save cursor (ANSI.SYS).
            case 's':
              this._terminal.saveCursor(this._terminal.params);
              break;

            // CSI u
            //   Restore cursor (ANSI.SYS).
            case 'u':
              this._terminal.restoreCursor(this._terminal.params);
              break;

              /**
               * Lesser Used
               */

            // CSI Ps I
            // Cursor Forward Tabulation Ps tab stops (default = 1) (CHT).
            case 'I':
              this._terminal.cursorForwardTab(this._terminal.params);
              break;

            // CSI Ps S  Scroll up Ps lines (default = 1) (SU).
            case 'S':
              this._terminal.scrollUp(this._terminal.params);
              break;

            // CSI Ps T  Scroll down Ps lines (default = 1) (SD).
            // CSI Ps ; Ps ; Ps ; Ps ; Ps T
            // CSI > Ps; Ps T
            case 'T':
              // if (this.prefix === '>') {
              //   this.resetTitleModes(this.params);
              //   break;
              // }
              // if (this.params.length > 2) {
              //   this.initMouseTracking(this.params);
              //   break;
              // }
              if (this._terminal.params.length < 2 && !this._terminal.prefix) {
                this._terminal.scrollDown(this._terminal.params);
              }
              break;

            // CSI Ps Z
            // Cursor Backward Tabulation Ps tab stops (default = 1) (CBT).
            case 'Z':
              this._terminal.cursorBackwardTab(this._terminal.params);
              break;

            // CSI Ps b  Repeat the preceding graphic character Ps times (REP).
            case 'b':
              this._terminal.repeatPrecedingCharacter(this._terminal.params);
              break;

            // CSI Ps g  Tab Clear (TBC).
            case 'g':
              this._terminal.tabClear(this._terminal.params);
              break;

              // CSI Pm i  Media Copy (MC).
              // CSI ? Pm i
              // case 'i':
              //   this.mediaCopy(this.params);
              //   break;

              // CSI Pm m  Character Attributes (SGR).
              // CSI > Ps; Ps m
              // case 'm': // duplicate
              //   if (this.prefix === '>') {
              //     this.setResources(this.params);
              //   } else {
              //     this.charAttributes(this.params);
              //   }
              //   break;

              // CSI Ps n  Device Status Report (DSR).
              // CSI > Ps n
              // case 'n': // duplicate
              //   if (this.prefix === '>') {
              //     this.disableModifiers(this.params);
              //   } else {
              //     this.deviceStatus(this.params);
              //   }
              //   break;

              // CSI > Ps p  Set pointer mode.
              // CSI ! p   Soft terminal reset (DECSTR).
              // CSI Ps$ p
              //   Request ANSI mode (DECRQM).
              // CSI ? Ps$ p
              //   Request DEC private mode (DECRQM).
              // CSI Ps ; Ps " p
            case 'p':
              switch (this._terminal.prefix) {
                  // case '>':
                  //   this.setPointerMode(this.params);
                  //   break;
                case '!':
                  this._terminal.softReset(this._terminal.params);
                  break;
                  // case '?':
                  //   if (this.postfix === '$') {
                  //     this.requestPrivateMode(this.params);
                  //   }
                  //   break;
                  // default:
                  //   if (this.postfix === '"') {
                  //     this.setConformanceLevel(this.params);
                  //   } else if (this.postfix === '$') {
                  //     this.requestAnsiMode(this.params);
                  //   }
                  //   break;
              }
              break;

              // CSI Ps q  Load LEDs (DECLL).
              // CSI Ps SP q
              // CSI Ps " q
              // case 'q':
              //   if (this.postfix === ' ') {
              //     this.setCursorStyle(this.params);
              //     break;
              //   }
              //   if (this.postfix === '"') {
              //     this.setCharProtectionAttr(this.params);
              //     break;
              //   }
              //   this.loadLEDs(this.params);
              //   break;

              // CSI Ps ; Ps r
              //   Set Scrolling Region [top;bottom] (default = full size of win-
              //   dow) (DECSTBM).
              // CSI ? Pm r
              // CSI Pt; Pl; Pb; Pr; Ps$ r
              // case 'r': // duplicate
              //   if (this.prefix === '?') {
              //     this.restorePrivateValues(this.params);
              //   } else if (this.postfix === '$') {
              //     this.setAttrInRectangle(this.params);
              //   } else {
              //     this.setScrollRegion(this.params);
              //   }
              //   break;

              // CSI s     Save cursor (ANSI.SYS).
              // CSI ? Pm s
              // case 's': // duplicate
              //   if (this.prefix === '?') {
              //     this.savePrivateValues(this.params);
              //   } else {
              //     this.saveCursor(this.params);
              //   }
              //   break;

              // CSI Ps ; Ps ; Ps t
              // CSI Pt; Pl; Pb; Pr; Ps$ t
              // CSI > Ps; Ps t
              // CSI Ps SP t
              // case 't':
              //   if (this.postfix === '$') {
              //     this.reverseAttrInRectangle(this.params);
              //   } else if (this.postfix === ' ') {
              //     this.setWarningBellVolume(this.params);
              //   } else {
              //     if (this.prefix === '>') {
              //       this.setTitleModeFeature(this.params);
              //     } else {
              //       this.manipulateWindow(this.params);
              //     }
              //   }
              //   break;

              // CSI u     Restore cursor (ANSI.SYS).
              // CSI Ps SP u
              // case 'u': // duplicate
              //   if (this.postfix === ' ') {
              //     this.setMarginBellVolume(this.params);
              //   } else {
              //     this.restoreCursor(this.params);
              //   }
              //   break;

              // CSI Pt; Pl; Pb; Pr; Pp; Pt; Pl; Pp$ v
              // case 'v':
              //   if (this.postfix === '$') {
              //     this.copyRectagle(this.params);
              //   }
              //   break;

              // CSI Pt ; Pl ; Pb ; Pr ' w
              // case 'w':
              //   if (this.postfix === '\'') {
              //     this.enableFilterRectangle(this.params);
              //   }
              //   break;

              // CSI Ps x  Request Terminal Parameters (DECREQTPARM).
              // CSI Ps x  Select Attribute Change Extent (DECSACE).
              // CSI Pc; Pt; Pl; Pb; Pr$ x
              // case 'x':
              //   if (this.postfix === '$') {
              //     this.fillRectangle(this.params);
              //   } else {
              //     this.requestParameters(this.params);
              //     //this.__(this.params);
              //   }
              //   break;

              // CSI Ps ; Pu ' z
              // CSI Pt; Pl; Pb; Pr$ z
              // case 'z':
              //   if (this.postfix === '\'') {
              //     this.enableLocatorReporting(this.params);
              //   } else if (this.postfix === '$') {
              //     this.eraseRectangle(this.params);
              //   }
              //   break;

              // CSI Pm ' {
              // CSI Pt; Pl; Pb; Pr$ {
              // case '{':
              //   if (this.postfix === '\'') {
              //     this.setLocatorEvents(this.params);
              //   } else if (this.postfix === '$') {
              //     this.selectiveEraseRectangle(this.params);
              //   }
              //   break;

              // CSI Ps ' |
              // case '|':
              //   if (this.postfix === '\'') {
              //     this.requestLocatorPosition(this.params);
              //   }
              //   break;

              // CSI P m SP }
              // Insert P s Column(s) (default = 1) (DECIC), VT420 and up.
              // case '}':
              //   if (this.postfix === ' ') {
              //     this.insertColumns(this.params);
              //   }
              //   break;

              // CSI P m SP ~
              // Delete P s Column(s) (default = 1) (DECDC), VT420 and up
              // case '~':
              //   if (this.postfix === ' ') {
              //     this.deleteColumns(this.params);
              //   }
              //   break;

            default:
              this._terminal.error('Unknown CSI code: %s.', ch);
              break;
          }

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
}

const wcwidth = (function(opts) {
  // extracted from https://www.cl.cam.ac.uk/%7Emgk25/ucs/wcwidth.c
  // combining characters
  const COMBINING = [
    [0x0300, 0x036F], [0x0483, 0x0486], [0x0488, 0x0489],
    [0x0591, 0x05BD], [0x05BF, 0x05BF], [0x05C1, 0x05C2],
    [0x05C4, 0x05C5], [0x05C7, 0x05C7], [0x0600, 0x0603],
    [0x0610, 0x0615], [0x064B, 0x065E], [0x0670, 0x0670],
    [0x06D6, 0x06E4], [0x06E7, 0x06E8], [0x06EA, 0x06ED],
    [0x070F, 0x070F], [0x0711, 0x0711], [0x0730, 0x074A],
    [0x07A6, 0x07B0], [0x07EB, 0x07F3], [0x0901, 0x0902],
    [0x093C, 0x093C], [0x0941, 0x0948], [0x094D, 0x094D],
    [0x0951, 0x0954], [0x0962, 0x0963], [0x0981, 0x0981],
    [0x09BC, 0x09BC], [0x09C1, 0x09C4], [0x09CD, 0x09CD],
    [0x09E2, 0x09E3], [0x0A01, 0x0A02], [0x0A3C, 0x0A3C],
    [0x0A41, 0x0A42], [0x0A47, 0x0A48], [0x0A4B, 0x0A4D],
    [0x0A70, 0x0A71], [0x0A81, 0x0A82], [0x0ABC, 0x0ABC],
    [0x0AC1, 0x0AC5], [0x0AC7, 0x0AC8], [0x0ACD, 0x0ACD],
    [0x0AE2, 0x0AE3], [0x0B01, 0x0B01], [0x0B3C, 0x0B3C],
    [0x0B3F, 0x0B3F], [0x0B41, 0x0B43], [0x0B4D, 0x0B4D],
    [0x0B56, 0x0B56], [0x0B82, 0x0B82], [0x0BC0, 0x0BC0],
    [0x0BCD, 0x0BCD], [0x0C3E, 0x0C40], [0x0C46, 0x0C48],
    [0x0C4A, 0x0C4D], [0x0C55, 0x0C56], [0x0CBC, 0x0CBC],
    [0x0CBF, 0x0CBF], [0x0CC6, 0x0CC6], [0x0CCC, 0x0CCD],
    [0x0CE2, 0x0CE3], [0x0D41, 0x0D43], [0x0D4D, 0x0D4D],
    [0x0DCA, 0x0DCA], [0x0DD2, 0x0DD4], [0x0DD6, 0x0DD6],
    [0x0E31, 0x0E31], [0x0E34, 0x0E3A], [0x0E47, 0x0E4E],
    [0x0EB1, 0x0EB1], [0x0EB4, 0x0EB9], [0x0EBB, 0x0EBC],
    [0x0EC8, 0x0ECD], [0x0F18, 0x0F19], [0x0F35, 0x0F35],
    [0x0F37, 0x0F37], [0x0F39, 0x0F39], [0x0F71, 0x0F7E],
    [0x0F80, 0x0F84], [0x0F86, 0x0F87], [0x0F90, 0x0F97],
    [0x0F99, 0x0FBC], [0x0FC6, 0x0FC6], [0x102D, 0x1030],
    [0x1032, 0x1032], [0x1036, 0x1037], [0x1039, 0x1039],
    [0x1058, 0x1059], [0x1160, 0x11FF], [0x135F, 0x135F],
    [0x1712, 0x1714], [0x1732, 0x1734], [0x1752, 0x1753],
    [0x1772, 0x1773], [0x17B4, 0x17B5], [0x17B7, 0x17BD],
    [0x17C6, 0x17C6], [0x17C9, 0x17D3], [0x17DD, 0x17DD],
    [0x180B, 0x180D], [0x18A9, 0x18A9], [0x1920, 0x1922],
    [0x1927, 0x1928], [0x1932, 0x1932], [0x1939, 0x193B],
    [0x1A17, 0x1A18], [0x1B00, 0x1B03], [0x1B34, 0x1B34],
    [0x1B36, 0x1B3A], [0x1B3C, 0x1B3C], [0x1B42, 0x1B42],
    [0x1B6B, 0x1B73], [0x1DC0, 0x1DCA], [0x1DFE, 0x1DFF],
    [0x200B, 0x200F], [0x202A, 0x202E], [0x2060, 0x2063],
    [0x206A, 0x206F], [0x20D0, 0x20EF], [0x302A, 0x302F],
    [0x3099, 0x309A], [0xA806, 0xA806], [0xA80B, 0xA80B],
    [0xA825, 0xA826], [0xFB1E, 0xFB1E], [0xFE00, 0xFE0F],
    [0xFE20, 0xFE23], [0xFEFF, 0xFEFF], [0xFFF9, 0xFFFB],
    [0x10A01, 0x10A03], [0x10A05, 0x10A06], [0x10A0C, 0x10A0F],
    [0x10A38, 0x10A3A], [0x10A3F, 0x10A3F], [0x1D167, 0x1D169],
    [0x1D173, 0x1D182], [0x1D185, 0x1D18B], [0x1D1AA, 0x1D1AD],
    [0x1D242, 0x1D244], [0xE0001, 0xE0001], [0xE0020, 0xE007F],
    [0xE0100, 0xE01EF]
  ];
  // binary search
  function bisearch(ucs) {
    let min = 0;
    let max = COMBINING.length - 1;
    let mid;
    if (ucs < COMBINING[0][0] || ucs > COMBINING[max][1])
      return false;
    while (max >= min) {
      mid = Math.floor((min + max) / 2);
      if (ucs > COMBINING[mid][1])
        min = mid + 1;
      else if (ucs < COMBINING[mid][0])
        max = mid - 1;
      else
        return true;
    }
    return false;
  }
  function wcwidth(ucs) {
    // test for 8-bit control characters
    if (ucs === 0)
      return opts.nul;
    if (ucs < 32 || (ucs >= 0x7f && ucs < 0xa0))
      return opts.control;
    // binary search in table of non-spacing characters
    if (bisearch(ucs))
      return 0;
    // if we arrive here, ucs is not a combining or C0/C1 control character
    if (isWide(ucs)) {
      return 2;
    }
    return 1;
  }
  function isWide(ucs) {
    return (
      ucs >= 0x1100 && (
        ucs <= 0x115f ||                // Hangul Jamo init. consonants
        ucs === 0x2329 ||
        ucs === 0x232a ||
        (ucs >= 0x2e80 && ucs <= 0xa4cf && ucs !== 0x303f) ||  // CJK..Yi
        (ucs >= 0xac00 && ucs <= 0xd7a3) ||    // Hangul Syllables
        (ucs >= 0xf900 && ucs <= 0xfaff) ||    // CJK Compat Ideographs
        (ucs >= 0xfe10 && ucs <= 0xfe19) ||    // Vertical forms
        (ucs >= 0xfe30 && ucs <= 0xfe6f) ||    // CJK Compat Forms
        (ucs >= 0xff00 && ucs <= 0xff60) ||    // Fullwidth Forms
        (ucs >= 0xffe0 && ucs <= 0xffe6) ||
        (ucs >= 0x20000 && ucs <= 0x2fffd) ||
        (ucs >= 0x30000 && ucs <= 0x3fffd)));
  }
  return wcwidth;
})({nul: 0, control: 0});  // configurable options
