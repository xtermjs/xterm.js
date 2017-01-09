import { C0 } from './EscapeSequences';
import { IInputHandler } from './Interfaces';

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
        low = data.charCodeAt(i+1);
        if (isNaN(low)) {
          // end of data stream, save surrogate high
          this._terminal.surrogate_high = ch;
          continue;
        }
        code = ((code - 0xD800) * 0x400) + (low - 0xDC00) + 0x10000;
        ch += data.charAt(i+1);
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
                if (this.charset && this.charset[ch]) {
                  ch = this.charset[ch];
                }

                row = this.y + this.ybase;

                // insert combining char in last cell
                // FIXME: needs handling after cursor jumps
                if (!ch_width && this.x) {
                  // dont overflow left
                  if (this.lines.get(row)[this.x-1]) {
                    if (!this.lines.get(row)[this.x-1][2]) {

                      // found empty cell after fullwidth, need to go 2 cells back
                      if (this.lines.get(row)[this.x-2])
                        this.lines.get(row)[this.x-2][1] += ch;

                    } else {
                      this.lines.get(row)[this.x-1][1] += ch;
                    }
                    this.updateRange(this.y);
                  }
                  break;
                }

                // goto next line if ch would overflow
                // TODO: needs a global min terminal width of 2
                if (this.x+ch_width-1 >= this.cols) {
                  // autowrap - DECAWM
                  if (this.wraparoundMode) {
                    this.x = 0;
                    this.y++;
                    if (this.y > this.scrollBottom) {
                      this.y--;
                      this.scroll();
                    }
                  } else {
                    this.x = this.cols-1;
                    if(ch_width===2)  // FIXME: check for xterm behavior
                      continue;
                  }
                }
                row = this.y + this.ybase;

                // insert mode: move characters to right
                if (this.insertMode) {
                  // do this twice for a fullwidth char
                  for (var moves=0; moves<ch_width; ++moves) {
                    // remove last cell, if it's width is 0
                    // we have to adjust the second last cell as well
                    var removed = this.lines.get(this.y + this.ybase).pop();
                    if (removed[2]===0
                        && this.lines.get(row)[this.cols-2]
                    && this.lines.get(row)[this.cols-2][2]===2)
                      this.lines.get(row)[this.cols-2] = [this.curAttr, ' ', 1];

                    // insert empty cell at cursor
                    this.lines.get(row).splice(this.x, 0, [this.curAttr, ' ', 1]);
                  }
                }

                this.lines.get(row)[this.x] = [this.curAttr, ch, ch_width];
                this.x++;
                this.updateRange(this.y);

                // fullwidth char - set next cell width to zero and advance cursor
                if (ch_width===2) {
                  this.lines.get(row)[this.x] = [this.curAttr, '', 0];
                  this.x++;
                }
              }
              break;
          }
          break;
        case ParserState.ESCAPED:
          switch (ch) {
            // ESC [ Control Sequence Introducer ( CSI is 0x9b).
            case '[':
              this.params = [];
              this.currentParam = 0;
              this.state = csi;
              break;

            // ESC ] Operating System Command ( OSC is 0x9d).
            case ']':
              this.params = [];
              this.currentParam = 0;
              this.state = osc;
              break;

            // ESC P Device Control String ( DCS is 0x90).
            case 'P':
              this.params = [];
              this.currentParam = 0;
              this.state = dcs;
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
              this.reset();
              break;

            // ESC E Next Line ( NEL is 0x85).
            // ESC D Index ( IND is 0x84).
            case 'E':
              this.x = 0;
              ;
            case 'D':
              this.index();
              break;

            // ESC M Reverse Index ( RI is 0x8d).
            case 'M':
              this.reverseIndex();
              break;

            // ESC % Select default/utf-8 character set.
            // @ = default, G = utf-8
            case '%':
              //this.charset = null;
              this.setgLevel(0);
              this.setgCharset(0, Terminal.charsets.US);
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
                  this.gcharset = 0;
                  break;
                case ')':
                  this.gcharset = 1;
                  break;
                case '*':
                  this.gcharset = 2;
                  break;
                case '+':
                  this.gcharset = 3;
                  break;
                case '-':
                  this.gcharset = 1;
                  break;
                case '.':
                  this.gcharset = 2;
                  break;
              }
              this.state = charset;
              break;

            // Designate G3 Character Set (VT300).
            // A = ISO Latin-1 Supplemental.
            // Not implemented.
            case '/':
              this.gcharset = 3;
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
              this.setgLevel(2);
              break;
            // ESC o
            // Invoke the G3 Character Set as GL (LS3).
            case 'o':
              this.setgLevel(3);
              break;
            // ESC |
            // Invoke the G3 Character Set as GR (LS3R).
            case '|':
              this.setgLevel(3);
              break;
            // ESC }
            // Invoke the G2 Character Set as GR (LS2R).
            case '}':
              this.setgLevel(2);
              break;
            // ESC ~
            // Invoke the G1 Character Set as GR (LS1R).
            case '~':
              this.setgLevel(1);
              break;

            // ESC 7 Save Cursor (DECSC).
            case '7':
              this.saveCursor();
              this.state = ParserState.NORMAL;
              break;

            // ESC 8 Restore Cursor (DECRC).
            case '8':
              this.restoreCursor();
              this.state = ParserState.NORMAL;
              break;

            // ESC # 3 DEC line height/width
            case '#':
              this.state = ParserState.NORMAL;
              i++;
              break;

            // ESC H Tab Set (HTS is 0x88).
            case 'H':
              this.tabSet();
              break;

            // ESC = Application Keypad (DECKPAM).
            case '=':
              this.log('Serial port requested application keypad.');
              this.applicationKeypad = true;
              this.viewport.syncScrollArea();
              this.state = ParserState.NORMAL;
              break;

            // ESC > Normal Keypad (DECKPNM).
            case '>':
              this.log('Switching back to normal keypad.');
              this.applicationKeypad = false;
              this.viewport.syncScrollArea();
              this.state = ParserState.NORMAL;
              break;

            default:
              this.state = ParserState.NORMAL;
              this.error('Unknown ESC control: %s.', ch);
              break;
          }
          break;

        case ParserState.CHARSET:
          switch (ch) {
            case '0': // DEC Special Character and Line Drawing Set.
              cs = Terminal.charsets.SCLD;
              break;
            case 'A': // UK
              cs = Terminal.charsets.UK;
              break;
            case 'B': // United States (USASCII).
              cs = Terminal.charsets.US;
              break;
            case '4': // Dutch
              cs = Terminal.charsets.Dutch;
              break;
            case 'C': // Finnish
            case '5':
              cs = Terminal.charsets.Finnish;
              break;
            case 'R': // French
              cs = Terminal.charsets.French;
              break;
            case 'Q': // FrenchCanadian
              cs = Terminal.charsets.FrenchCanadian;
              break;
            case 'K': // German
              cs = Terminal.charsets.German;
              break;
            case 'Y': // Italian
              cs = Terminal.charsets.Italian;
              break;
            case 'E': // NorwegianDanish
            case '6':
              cs = Terminal.charsets.NorwegianDanish;
              break;
            case 'Z': // Spanish
              cs = Terminal.charsets.Spanish;
              break;
            case 'H': // Swedish
            case '7':
              cs = Terminal.charsets.Swedish;
              break;
            case '=': // Swiss
              cs = Terminal.charsets.Swiss;
              break;
            case '/': // ISOLatin (actually /A)
              cs = Terminal.charsets.ISOLatin;
              i++;
              break;
            default: // Default
              cs = Terminal.charsets.US;
              break;
          }
          this.setgCharset(this.gcharset, cs);
          this.gcharset = null;
          this.state = ParserState.NORMAL;
          break;

        case ParserState.OSC:
          // OSC Ps ; Pt ST
          // OSC Ps ; Pt BEL
          //   Set Text Parameters.
          if (ch === C0.ESC || ch === C0.BEL) {
            if (ch === C0.ESC) i++;

            this.params.push(this.currentParam);

            switch (this.params[0]) {
              case 0:
              case 1:
              case 2:
                if (this.params[1]) {
                  this.title = this.params[1];
                  this.handleTitle(this.title);
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

            this.params = [];
            this.currentParam = 0;
            this.state = ParserState.NORMAL;
          } else {
            if (!this.params.length) {
              if (ch >= '0' && ch <= '9') {
                this.currentParam =
                  this.currentParam * 10 + ch.charCodeAt(0) - 48;
              } else if (ch === ';') {
                this.params.push(this.currentParam);
                this.currentParam = '';
              }
            } else {
              this.currentParam += ch;
            }
          }
          break;

        case csi:
          // '?', '>', '!'
          if (ch === '?' || ch === '>' || ch === '!') {
            this.prefix = ch;
            break;
          }

          // 0 - 9
          if (ch >= '0' && ch <= '9') {
            this.currentParam = this.currentParam * 10 + ch.charCodeAt(0) - 48;
            break;
          }

          // '$', '"', ' ', '\''
          if (ch === '$' || ch === '"' || ch === ' ' || ch === '\'') {
            this.postfix = ch;
            break;
          }

          this.params.push(this.currentParam);
          this.currentParam = 0;

          // ';'
          if (ch === ';') break;

          this.state = ParserState.NORMAL;

          switch (ch) {
            // CSI Ps A
            // Cursor Up Ps Times (default = 1) (CUU).
            case 'A':
              this.cursorUp(this.params);
              break;

            // CSI Ps B
            // Cursor Down Ps Times (default = 1) (CUD).
            case 'B':
              this.cursorDown(this.params);
              break;

            // CSI Ps C
            // Cursor Forward Ps Times (default = 1) (CUF).
            case 'C':
              this.cursorForward(this.params);
              break;

            // CSI Ps D
            // Cursor Backward Ps Times (default = 1) (CUB).
            case 'D':
              this.cursorBackward(this.params);
              break;

            // CSI Ps ; Ps H
            // Cursor Position [row;column] (default = [1,1]) (CUP).
            case 'H':
              this.cursorPos(this.params);
              break;

            // CSI Ps J  Erase in Display (ED).
            case 'J':
              this.eraseInDisplay(this.params);
              break;

            // CSI Ps K  Erase in Line (EL).
            case 'K':
              this.eraseInLine(this.params);
              break;

            // CSI Pm m  Character Attributes (SGR).
            case 'm':
              if (!this.prefix) {
                this.charAttributes(this.params);
              }
              break;

            // CSI Ps n  Device Status Report (DSR).
            case 'n':
              if (!this.prefix) {
                this.deviceStatus(this.params);
              }
              break;

              /**
               * Additions
               */

            // CSI Ps @
            // Insert Ps (Blank) Character(s) (default = 1) (ICH).
            case '@':
              this.insertChars(this.params);
              break;

            // CSI Ps E
            // Cursor Next Line Ps Times (default = 1) (CNL).
            case 'E':
              this.cursorNextLine(this.params);
              break;

            // CSI Ps F
            // Cursor Preceding Line Ps Times (default = 1) (CNL).
            case 'F':
              this.cursorPrecedingLine(this.params);
              break;

            // CSI Ps G
            // Cursor Character Absolute  [column] (default = [row,1]) (CHA).
            case 'G':
              this.cursorCharAbsolute(this.params);
              break;

            // CSI Ps L
            // Insert Ps Line(s) (default = 1) (IL).
            case 'L':
              this.insertLines(this.params);
              break;

            // CSI Ps M
            // Delete Ps Line(s) (default = 1) (DL).
            case 'M':
              this.deleteLines(this.params);
              break;

            // CSI Ps P
            // Delete Ps Character(s) (default = 1) (DCH).
            case 'P':
              this.deleteChars(this.params);
              break;

            // CSI Ps X
            // Erase Ps Character(s) (default = 1) (ECH).
            case 'X':
              this.eraseChars(this.params);
              break;

            // CSI Pm `  Character Position Absolute
            //   [column] (default = [row,1]) (HPA).
            case '`':
              this.charPosAbsolute(this.params);
              break;

            // 141 61 a * HPR -
            // Horizontal Position Relative
            case 'a':
              this.HPositionRelative(this.params);
              break;

            // CSI P s c
            // Send Device Attributes (Primary DA).
            // CSI > P s c
            // Send Device Attributes (Secondary DA)
            case 'c':
              this.sendDeviceAttributes(this.params);
              break;

            // CSI Pm d
            // Line Position Absolute  [row] (default = [1,column]) (VPA).
            case 'd':
              this.linePosAbsolute(this.params);
              break;

            // 145 65 e * VPR - Vertical Position Relative
            case 'e':
              this.VPositionRelative(this.params);
              break;

            // CSI Ps ; Ps f
            //   Horizontal and Vertical Position [row;column] (default =
            //   [1,1]) (HVP).
            case 'f':
              this.HVPosition(this.params);
              break;

            // CSI Pm h  Set Mode (SM).
            // CSI ? Pm h - mouse escape codes, cursor escape codes
            case 'h':
              this.setMode(this.params);
              break;

            // CSI Pm l  Reset Mode (RM).
            // CSI ? Pm l
            case 'l':
              this.resetMode(this.params);
              break;

            // CSI Ps ; Ps r
            //   Set Scrolling Region [top;bottom] (default = full size of win-
            //   dow) (DECSTBM).
            // CSI ? Pm r
            case 'r':
              this.setScrollRegion(this.params);
              break;

            // CSI s
            //   Save cursor (ANSI.SYS).
            case 's':
              this.saveCursor(this.params);
              break;

            // CSI u
            //   Restore cursor (ANSI.SYS).
            case 'u':
              this.restoreCursor(this.params);
              break;

              /**
               * Lesser Used
               */

            // CSI Ps I
            // Cursor Forward Tabulation Ps tab stops (default = 1) (CHT).
            case 'I':
              this.cursorForwardTab(this.params);
              break;

            // CSI Ps S  Scroll up Ps lines (default = 1) (SU).
            case 'S':
              this.scrollUp(this.params);
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
              if (this.params.length < 2 && !this.prefix) {
                this.scrollDown(this.params);
              }
              break;

            // CSI Ps Z
            // Cursor Backward Tabulation Ps tab stops (default = 1) (CBT).
            case 'Z':
              this.cursorBackwardTab(this.params);
              break;

            // CSI Ps b  Repeat the preceding graphic character Ps times (REP).
            case 'b':
              this.repeatPrecedingCharacter(this.params);
              break;

            // CSI Ps g  Tab Clear (TBC).
            case 'g':
              this.tabClear(this.params);
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
              switch (this.prefix) {
                  // case '>':
                  //   this.setPointerMode(this.params);
                  //   break;
                case '!':
                  this.softReset(this.params);
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
              this.error('Unknown CSI code: %s.', ch);
              break;
          }

          this.prefix = '';
          this.postfix = '';
          break;

        case ParserState.DCS:
          if (ch === C0.ESC || ch === C0.BEL) {
            if (ch === C0.ESC) i++;

            switch (this.prefix) {
              // User-Defined Keys (DECUDK).
              case '':
                break;

              // Request Status String (DECRQSS).
              // test: echo -e '\eP$q"p\e\\'
              case '$q':
                var pt = this.currentParam
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
                      + (this.scrollTop + 1)
                      + ';'
                      + (this.scrollBottom + 1)
                      + 'r';
                    break;

                  // SGR
                  case 'm':
                    pt = '0m';
                    break;

                  default:
                    this.error('Unknown DCS Pt: %s.', pt);
                    pt = '';
                    break;
                }

                this.send(C0.ESC + 'P' + +valid + '$r' + pt + C0.ESC + '\\');
                break;

              // Set Termcap/Terminfo Data (xterm, experimental).
              case '+p':
                break;

              // Request Termcap/Terminfo String (xterm, experimental)
              // Regular xterm does not even respond to this sequence.
              // This can cause a small glitch in vim.
              // test: echo -ne '\eP+q6b64\e\\'
              case '+q':
                var pt = this.currentParam
                , valid = false;

                this.send(C0.ESC + 'P' + +valid + '+r' + pt + C0.ESC + '\\');
                break;

              default:
                this.error('Unknown DCS prefix: %s.', this.prefix);
                break;
            }

            this.currentParam = 0;
            this.prefix = '';
            this.state = ParserState.NORMAL;
          } else if (!this.currentParam) {
            if (!this.prefix && ch !== '$' && ch !== '+') {
              this.currentParam = ch;
            } else if (this.prefix.length === 2) {
              this.currentParam = ch;
            } else {
              this.prefix += ch;
            }
          } else {
            this.currentParam += ch;
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
