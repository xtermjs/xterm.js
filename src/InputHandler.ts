/**
 * @license MIT
 */

import { IInputHandler, ITerminal } from './Interfaces';
import { C0 } from './EscapeSequences';
import { DEFAULT_CHARSET } from './Charsets';

/**
 * The terminal's standard implementation of IInputHandler, this handles all
 * input from the Parser.
 *
 * Refer to http://invisible-island.net/xterm/ctlseqs/ctlseqs.html to understand
 * each function's header comment.
 */
export class InputHandler implements IInputHandler {
  // TODO: We want to type _terminal when it's pulled into TS
  constructor(private _terminal: any) { }

  public addChar(char: string, code: number): void {
    if (char >= ' ') {
      // calculate print space
      // expensive call, therefore we save width in line buffer
      const ch_width = wcwidth(code);

      if (this._terminal.charset && this._terminal.charset[char]) {
        char = this._terminal.charset[char];
      }

      let row = this._terminal.y + this._terminal.ybase;

      // insert combining char in last cell
      // FIXME: needs handling after cursor jumps
      if (!ch_width && this._terminal.x) {
        // dont overflow left
        if (this._terminal.lines.get(row)[this._terminal.x - 1]) {
          if (!this._terminal.lines.get(row)[this._terminal.x - 1][2]) {

            // found empty cell after fullwidth, need to go 2 cells back
            if (this._terminal.lines.get(row)[this._terminal.x - 2])
              this._terminal.lines.get(row)[this._terminal.x - 2][1] += char;

          } else {
            this._terminal.lines.get(row)[this._terminal.x - 1][1] += char;
          }
          this._terminal.updateRange(this._terminal.y);
        }
        return;
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
          if (ch_width === 2)  // FIXME: check for xterm behavior
            return;
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

      this._terminal.lines.get(row)[this._terminal.x] = [this._terminal.curAttr, char, ch_width];
      this._terminal.x++;
      this._terminal.updateRange(this._terminal.y);

      // fullwidth char - set next cell width to zero and advance cursor
      if (ch_width === 2) {
        this._terminal.lines.get(row)[this._terminal.x] = [this._terminal.curAttr, '', 0];
        this._terminal.x++;
      }
    }
  }

  /**
   * BEL
   * Bell (Ctrl-G).
   */
  public bell(): void {
    if (!this._terminal.visualBell) {
      return;
    }
    this._terminal.element.style.borderColor = 'white';
    setTimeout(() => this._terminal.element.style.borderColor = '', 10);
    if (this._terminal.popOnBell) {
      this._terminal.focus();
    }
  }

  /**
   * LF
   * Line Feed or New Line (NL).  (LF  is Ctrl-J).
   */
  public lineFeed(): void {
    if (this._terminal.convertEol) {
      this._terminal.x = 0;
    }
    this._terminal.y++;
    if (this._terminal.y > this._terminal.scrollBottom) {
      this._terminal.y--;
      this._terminal.scroll();
    }
    // If the end of the line is hit, prevent this action from wrapping around to the next line.
    if (this._terminal.x >= this._terminal.cols) {
      this._terminal.x--;
    }
  }

  /**
   * CR
   * Carriage Return (Ctrl-M).
   */
  public carriageReturn(): void {
    this._terminal.x = 0;
  }

  /**
   * BS
   * Backspace (Ctrl-H).
   */
  public backspace(): void {
    if (this._terminal.x > 0) {
      this._terminal.x--;
    }
  }

  /**
   * TAB
   * Horizontal Tab (HT) (Ctrl-I).
   */
  public tab(): void {
    this._terminal.x = this._terminal.nextStop();
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
   * CSI Ps @
   * Insert Ps (Blank) Character(s) (default = 1) (ICH).
   */
  public insertChars(params: number[]): void {
    let param, row, j, ch;

    param = params[0];
    if (param < 1) param = 1;

    row = this._terminal.y + this._terminal.ybase;
    j = this._terminal.x;
    ch = [this._terminal.eraseAttr(), ' ', 1]; // xterm

    while (param-- && j < this._terminal.cols) {
      this._terminal.lines.get(row).splice(j++, 0, ch);
      this._terminal.lines.get(row).pop();
    }
  }

  /**
   * CSI Ps A
   * Cursor Up Ps Times (default = 1) (CUU).
   */
  public cursorUp(params: number[]): void {
    let param = params[0];
    if (param < 1) {
      param = 1;
    }
    this._terminal.y -= param;
    if (this._terminal.y < 0) {
      this._terminal.y = 0;
    }
  }

  /**
   * CSI Ps B
   * Cursor Down Ps Times (default = 1) (CUD).
   */
  public cursorDown(params: number[]) {
    let param = params[0];
    if (param < 1) {
      param = 1;
    }
    this._terminal.y += param;
    if (this._terminal.y >= this._terminal.rows) {
      this._terminal.y = this._terminal.rows - 1;
    }
    // If the end of the line is hit, prevent this action from wrapping around to the next line.
    if (this._terminal.x >= this._terminal.cols) {
      this._terminal.x--;
    }
  }

  /**
   * CSI Ps C
   * Cursor Forward Ps Times (default = 1) (CUF).
   */
  public cursorForward(params: number[]) {
    let param = params[0];
    if (param < 1) {
      param = 1;
    }
    this._terminal.x += param;
    if (this._terminal.x >= this._terminal.cols) {
      this._terminal.x = this._terminal.cols - 1;
    }
  }

  /**
   * CSI Ps D
   * Cursor Backward Ps Times (default = 1) (CUB).
   */
  public cursorBackward(params: number[]) {
    let param = params[0];
    if (param < 1) {
      param = 1;
    }
    // If the end of the line is hit, prevent this action from wrapping around to the next line.
    if (this._terminal.x >= this._terminal.cols) {
      this._terminal.x--;
    }
    this._terminal.x -= param;
    if (this._terminal.x < 0) {
      this._terminal.x = 0;
    }
  }

  /**
   * CSI Ps E
   * Cursor Next Line Ps Times (default = 1) (CNL).
   * same as CSI Ps B ?
   */
  public cursorNextLine(params: number[]): void {
    let param = params[0];
    if (param < 1) {
      param = 1;
    }
    this._terminal.y += param;
    if (this._terminal.y >= this._terminal.rows) {
      this._terminal.y = this._terminal.rows - 1;
    }
    this._terminal.x = 0;
  };


  /**
   * CSI Ps F
   * Cursor Preceding Line Ps Times (default = 1) (CNL).
   * reuse CSI Ps A ?
   */
  public cursorPrecedingLine(params: number[]): void {
    let param = params[0];
    if (param < 1) {
      param = 1;
    }
    this._terminal.y -= param;
    if (this._terminal.y < 0) {
      this._terminal.y = 0;
    }
    this._terminal.x = 0;
  };


  /**
   * CSI Ps G
   * Cursor Character Absolute  [column] (default = [row,1]) (CHA).
   */
  public cursorCharAbsolute(params: number[]): void {
    let param = params[0];
    if (param < 1) {
      param = 1;
    }
    this._terminal.x = param - 1;
  }

  /**
   * CSI Ps ; Ps H
   * Cursor Position [row;column] (default = [1,1]) (CUP).
   */
  public cursorPosition(params: number[]): void {
    let row, col;

    row = params[0] - 1;

    if (params.length >= 2) {
      col = params[1] - 1;
    } else {
      col = 0;
    }

    if (row < 0) {
      row = 0;
    } else if (row >= this._terminal.rows) {
      row = this._terminal.rows - 1;
    }

    if (col < 0) {
      col = 0;
    } else if (col >= this._terminal.cols) {
      col = this._terminal.cols - 1;
    }

    this._terminal.x = col;
    this._terminal.y = row;
  }

  /**
   * CSI Ps I
   *   Cursor Forward Tabulation Ps tab stops (default = 1) (CHT).
   */
  public cursorForwardTab(params: number[]): void {
    let param = params[0] || 1;
    while (param--) {
      this._terminal.x = this._terminal.nextStop();
    }
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
  public eraseInDisplay(params: number[]): void {
    let j;
    switch (params[0]) {
      case 0:
        this._terminal.eraseRight(this._terminal.x, this._terminal.y);
        j = this._terminal.y + 1;
        for (; j < this._terminal.rows; j++) {
          this._terminal.eraseLine(j);
        }
        break;
      case 1:
        this._terminal.eraseLeft(this._terminal.x, this._terminal.y);
        j = this._terminal.y;
        while (j--) {
          this._terminal.eraseLine(j);
        }
        break;
      case 2:
        j = this._terminal.rows;
        while (j--) this._terminal.eraseLine(j);
        break;
      case 3:
        // Clear scrollback (everything not in viewport)
        const scrollBackSize = this._terminal.lines.length - this._terminal.rows;
        if (scrollBackSize > 0) {
          this._terminal.lines.trimStart(scrollBackSize);
          this._terminal.ybase = Math.max(this._terminal.ybase - scrollBackSize, 0);
          this._terminal.ydisp = Math.max(this._terminal.ydisp - scrollBackSize, 0);
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
  public eraseInLine(params: number[]): void {
    switch (params[0]) {
      case 0:
        this._terminal.eraseRight(this._terminal.x, this._terminal.y);
        break;
      case 1:
        this._terminal.eraseLeft(this._terminal.x, this._terminal.y);
        break;
      case 2:
        this._terminal.eraseLine(this._terminal.y);
        break;
    }
  }

  /**
   * CSI Ps L
   * Insert Ps Line(s) (default = 1) (IL).
   */
  public insertLines(params: number[]): void {
    let param, row, j;

    param = params[0];
    if (param < 1) {
      param = 1;
    }
    row = this._terminal.y + this._terminal.ybase;

    j = this._terminal.rows - 1 - this._terminal.scrollBottom;
    j = this._terminal.rows - 1 + this._terminal.ybase - j + 1;

    while (param--) {
      if (this._terminal.lines.length === this._terminal.lines.maxLength) {
        // Trim the start of lines to make room for the new line
        this._terminal.lines.trimStart(1);
        this._terminal.ybase--;
        this._terminal.ydisp--;
        row--;
        j--;
      }
      // test: echo -e '\e[44m\e[1L\e[0m'
      // blankLine(true) - xterm/linux behavior
      this._terminal.lines.splice(row, 0, this._terminal.blankLine(true));
      this._terminal.lines.splice(j, 1);
    }

    // this.maxRange();
    this._terminal.updateRange(this._terminal.y);
    this._terminal.updateRange(this._terminal.scrollBottom);
  }

  /**
   * CSI Ps M
   * Delete Ps Line(s) (default = 1) (DL).
   */
  public deleteLines(params: number[]): void {
    let param, row, j;

    param = params[0];
    if (param < 1) {
      param = 1;
    }
    row = this._terminal.y + this._terminal.ybase;

    j = this._terminal.rows - 1 - this._terminal.scrollBottom;
    j = this._terminal.rows - 1 + this._terminal.ybase - j;

    while (param--) {
      if (this._terminal.lines.length === this._terminal.lines.maxLength) {
        // Trim the start of lines to make room for the new line
        this._terminal.lines.trimStart(1);
        this._terminal.ybase -= 1;
        this._terminal.ydisp -= 1;
      }
      // test: echo -e '\e[44m\e[1M\e[0m'
      // blankLine(true) - xterm/linux behavior
      this._terminal.lines.splice(j + 1, 0, this._terminal.blankLine(true));
      this._terminal.lines.splice(row, 1);
    }

    // this.maxRange();
    this._terminal.updateRange(this._terminal.y);
    this._terminal.updateRange(this._terminal.scrollBottom);
  }

  /**
   * CSI Ps P
   * Delete Ps Character(s) (default = 1) (DCH).
   */
  public deleteChars(params: number[]): void {
    let param, row, ch;

    param = params[0];
    if (param < 1) {
      param = 1;
    }

    row = this._terminal.y + this._terminal.ybase;
    ch = [this._terminal.eraseAttr(), ' ', 1]; // xterm

    while (param--) {
      this._terminal.lines.get(row).splice(this._terminal.x, 1);
      this._terminal.lines.get(row).push(ch);
    }
  }

  /**
   * CSI Ps S  Scroll up Ps lines (default = 1) (SU).
   */
  public scrollUp(params: number[]): void {
    let param = params[0] || 1;
    while (param--) {
      this._terminal.lines.splice(this._terminal.ybase + this._terminal.scrollTop, 1);
      this._terminal.lines.splice(this._terminal.ybase + this._terminal.scrollBottom, 0, this._terminal.blankLine());
    }
    // this.maxRange();
    this._terminal.updateRange(this._terminal.scrollTop);
    this._terminal.updateRange(this._terminal.scrollBottom);
  }

  /**
   * CSI Ps T  Scroll down Ps lines (default = 1) (SD).
   */
  public scrollDown(params: number[]): void {
    let param = params[0] || 1;
    while (param--) {
      this._terminal.lines.splice(this._terminal.ybase + this._terminal.scrollBottom, 1);
      this._terminal.lines.splice(this._terminal.ybase + this._terminal.scrollTop, 0, this._terminal.blankLine());
    }
    // this.maxRange();
    this._terminal.updateRange(this._terminal.scrollTop);
    this._terminal.updateRange(this._terminal.scrollBottom);
  }

  /**
   * CSI Ps X
   * Erase Ps Character(s) (default = 1) (ECH).
   */
  public eraseChars(params: number[]): void {
    let param, row, j, ch;

    param = params[0];
    if (param < 1) {
      param = 1;
    }

    row = this._terminal.y + this._terminal.ybase;
    j = this._terminal.x;
    ch = [this._terminal.eraseAttr(), ' ', 1]; // xterm

    while (param-- && j < this._terminal.cols) {
      this._terminal.lines.get(row)[j++] = ch;
    }
  }

  /**
   * CSI Ps Z  Cursor Backward Tabulation Ps tab stops (default = 1) (CBT).
   */
  public cursorBackwardTab(params: number[]): void {
    let param = params[0] || 1;
    while (param--) {
      this._terminal.x = this._terminal.prevStop();
    }
  }

  /**
   * CSI Pm `  Character Position Absolute
   *   [column] (default = [row,1]) (HPA).
   */
  public charPosAbsolute(params: number[]): void {
    let param = params[0];
    if (param < 1) {
      param = 1;
    }
    this._terminal.x = param - 1;
    if (this._terminal.x >= this._terminal.cols) {
      this._terminal.x = this._terminal.cols - 1;
    }
  }

  /**
   * CSI Pm a  Character Position Relative
   *   [columns] (default = [row,col+1]) (HPR)
   * reuse CSI Ps C ?
   */
  public HPositionRelative(params: number[]): void {
    let param = params[0];
    if (param < 1) {
      param = 1;
    }
    this._terminal.x += param;
    if (this._terminal.x >= this._terminal.cols) {
      this._terminal.x = this._terminal.cols - 1;
    }
  }

  /**
   * CSI Ps b  Repeat the preceding graphic character Ps times (REP).
   */
  public repeatPrecedingCharacter(params: number[]): void {
    let param = params[0] || 1
      , line = this._terminal.lines.get(this._terminal.ybase + this._terminal.y)
      , ch = line[this._terminal.x - 1] || [this._terminal.defAttr, ' ', 1];

    while (param--) {
      line[this._terminal.x++] = ch;
    }
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
  public sendDeviceAttributes(params: number[]): void {
    if (params[0] > 0) {
      return;
    }

    if (!this._terminal.prefix) {
      if (this._terminal.is('xterm') || this._terminal.is('rxvt-unicode') || this._terminal.is('screen')) {
        this._terminal.send(C0.ESC + '[?1;2c');
      } else if (this._terminal.is('linux')) {
        this._terminal.send(C0.ESC + '[?6c');
      }
    } else if (this._terminal.prefix === '>') {
      // xterm and urxvt
      // seem to spit this
      // out around ~370 times (?).
      if (this._terminal.is('xterm')) {
        this._terminal.send(C0.ESC + '[>0;276;0c');
      } else if (this._terminal.is('rxvt-unicode')) {
        this._terminal.send(C0.ESC + '[>85;95;0c');
      } else if (this._terminal.is('linux')) {
        // not supported by linux console.
        // linux console echoes parameters.
        this._terminal.send(params[0] + 'c');
      } else if (this._terminal.is('screen')) {
        this._terminal.send(C0.ESC + '[>83;40003;0c');
      }
    }
  }

  /**
   * CSI Pm d  Vertical Position Absolute (VPA)
   *   [row] (default = [1,column])
   */
  public linePosAbsolute(params: number[]): void {
    let param = params[0];
    if (param < 1) {
      param = 1;
    }
    this._terminal.y = param - 1;
    if (this._terminal.y >= this._terminal.rows) {
      this._terminal.y = this._terminal.rows - 1;
    }
  }

  /**
   * CSI Pm e  Vertical Position Relative (VPR)
   *   [rows] (default = [row+1,column])
   * reuse CSI Ps B ?
   */
  public VPositionRelative(params: number[]): void {
    let param = params[0];
    if (param < 1) {
      param = 1;
    }
    this._terminal.y += param;
    if (this._terminal.y >= this._terminal.rows) {
      this._terminal.y = this._terminal.rows - 1;
    }
    // If the end of the line is hit, prevent this action from wrapping around to the next line.
    if (this._terminal.x >= this._terminal.cols) {
      this._terminal.x--;
    }
  }

  /**
   * CSI Ps ; Ps f
   *   Horizontal and Vertical Position [row;column] (default =
   *   [1,1]) (HVP).
   */
  public HVPosition(params: number[]): void {
    if (params[0] < 1) params[0] = 1;
    if (params[1] < 1) params[1] = 1;

    this._terminal.y = params[0] - 1;
    if (this._terminal.y >= this._terminal.rows) {
      this._terminal.y = this._terminal.rows - 1;
    }

    this._terminal.x = params[1] - 1;
    if (this._terminal.x >= this._terminal.cols) {
      this._terminal.x = this._terminal.cols - 1;
    }
  }

  /**
   * CSI Ps g  Tab Clear (TBC).
   *     Ps = 0  -> Clear Current Column (default).
   *     Ps = 3  -> Clear All.
   * Potentially:
   *   Ps = 2  -> Clear Stops on Line.
   *   http://vt100.net/annarbor/aaa-ug/section6.html
   */
  public tabClear(params: number[]): void {
    let param = params[0];
    if (param <= 0) {
      delete this._terminal.tabs[this._terminal.x];
    } else if (param === 3) {
      this._terminal.tabs = {};
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
  public setMode(params: number[]): void {
    if (params.length > 1) {
      for (let i = 0; i < params.length; i++) {
        this.setMode([params[i]]);
      }

      return;
    }

    if (!this._terminal.prefix) {
      switch (params[0]) {
        case 4:
          this._terminal.insertMode = true;
          break;
        case 20:
          // this._terminal.convertEol = true;
          break;
      }
    } else if (this._terminal.prefix === '?') {
      switch (params[0]) {
        case 1:
          this._terminal.applicationCursor = true;
          break;
        case 2:
          this._terminal.setgCharset(0, DEFAULT_CHARSET);
          this._terminal.setgCharset(1, DEFAULT_CHARSET);
          this._terminal.setgCharset(2, DEFAULT_CHARSET);
          this._terminal.setgCharset(3, DEFAULT_CHARSET);
          // set VT100 mode here
          break;
        case 3: // 132 col mode
          this._terminal.savedCols = this._terminal.cols;
          this._terminal.resize(132, this._terminal.rows);
          break;
        case 6:
          this._terminal.originMode = true;
          break;
        case 7:
          this._terminal.wraparoundMode = true;
          break;
        case 12:
          // this.cursorBlink = true;
          break;
        case 66:
          this._terminal.log('Serial port requested application keypad.');
          this._terminal.applicationKeypad = true;
          this._terminal.viewport.syncScrollArea();
          break;
        case 9: // X10 Mouse
          // no release, no motion, no wheel, no modifiers.
        case 1000: // vt200 mouse
          // no motion.
          // no modifiers, except control on the wheel.
        case 1002: // button event mouse
        case 1003: // any event mouse
          // any event - sends motion events,
          // even if there is no button held down.

          // TODO: Why are params[0] compares nested within a switch for params[0]?

          this._terminal.x10Mouse = params[0] === 9;
          this._terminal.vt200Mouse = params[0] === 1000;
          this._terminal.normalMouse = params[0] > 1000;
          this._terminal.mouseEvents = true;
          this._terminal.element.style.cursor = 'default';
          this._terminal.log('Binding to mouse events.');
          break;
        case 1004: // send focusin/focusout events
          // focusin: ^[[I
          // focusout: ^[[O
          this._terminal.sendFocus = true;
          break;
        case 1005: // utf8 ext mode mouse
          this._terminal.utfMouse = true;
          // for wide terminals
          // simply encodes large values as utf8 characters
          break;
        case 1006: // sgr ext mode mouse
          this._terminal.sgrMouse = true;
          // for wide terminals
          // does not add 32 to fields
          // press: ^[[<b;x;yM
          // release: ^[[<b;x;ym
          break;
        case 1015: // urxvt ext mode mouse
          this._terminal.urxvtMouse = true;
          // for wide terminals
          // numbers for fields
          // press: ^[[b;x;yM
          // motion: ^[[b;x;yT
          break;
        case 25: // show cursor
          this._terminal.cursorHidden = false;
          break;
        case 1049: // alt screen buffer cursor
          // this._terminal.saveCursor();
          ; // FALL-THROUGH
        case 47: // alt screen buffer
        case 1047: // alt screen buffer
          if (!this._terminal.normal) {
            let normal = {
              lines: this._terminal.lines,
              ybase: this._terminal.ybase,
              ydisp: this._terminal.ydisp,
              x: this._terminal.x,
              y: this._terminal.y,
              scrollTop: this._terminal.scrollTop,
              scrollBottom: this._terminal.scrollBottom,
              tabs: this._terminal.tabs
              // XXX save charset(s) here?
              // charset: this._terminal.charset,
              // glevel: this._terminal.glevel,
              // charsets: this._terminal.charsets
            };
            this._terminal.reset();
            this._terminal.viewport.syncScrollArea();
            this._terminal.normal = normal;
            this._terminal.showCursor();
          }
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
  public resetMode(params: number[]): void {
    if (params.length > 1) {
      for (let i = 0; i < params.length; i++) {
        this.resetMode([params[i]]);
      }

      return;
    }

    if (!this._terminal.prefix) {
      switch (params[0]) {
        case 4:
          this._terminal.insertMode = false;
          break;
        case 20:
          // this._terminal.convertEol = false;
          break;
      }
    } else if (this._terminal.prefix === '?') {
      switch (params[0]) {
        case 1:
          this._terminal.applicationCursor = false;
          break;
        case 3:
          if (this._terminal.cols === 132 && this._terminal.savedCols) {
            this._terminal.resize(this._terminal.savedCols, this._terminal.rows);
          }
          delete this._terminal.savedCols;
          break;
        case 6:
          this._terminal.originMode = false;
          break;
        case 7:
          this._terminal.wraparoundMode = false;
          break;
        case 12:
          // this.cursorBlink = false;
          break;
        case 66:
          this._terminal.log('Switching back to normal keypad.');
          this._terminal.applicationKeypad = false;
          this._terminal.viewport.syncScrollArea();
          break;
        case 9: // X10 Mouse
        case 1000: // vt200 mouse
        case 1002: // button event mouse
        case 1003: // any event mouse
          this._terminal.x10Mouse = false;
          this._terminal.vt200Mouse = false;
          this._terminal.normalMouse = false;
          this._terminal.mouseEvents = false;
          this._terminal.element.style.cursor = '';
          break;
        case 1004: // send focusin/focusout events
          this._terminal.sendFocus = false;
          break;
        case 1005: // utf8 ext mode mouse
          this._terminal.utfMouse = false;
          break;
        case 1006: // sgr ext mode mouse
          this._terminal.sgrMouse = false;
          break;
        case 1015: // urxvt ext mode mouse
          this._terminal.urxvtMouse = false;
          break;
        case 25: // hide cursor
          this._terminal.cursorHidden = true;
          break;
        case 1049: // alt screen buffer cursor
          ; // FALL-THROUGH
        case 47: // normal screen buffer
        case 1047: // normal screen buffer - clearing it first
          if (this._terminal.normal) {
            this._terminal.lines = this._terminal.normal.lines;
            this._terminal.ybase = this._terminal.normal.ybase;
            this._terminal.ydisp = this._terminal.normal.ydisp;
            this._terminal.x = this._terminal.normal.x;
            this._terminal.y = this._terminal.normal.y;
            this._terminal.scrollTop = this._terminal.normal.scrollTop;
            this._terminal.scrollBottom = this._terminal.normal.scrollBottom;
            this._terminal.tabs = this._terminal.normal.tabs;
            this._terminal.normal = null;
            // if (params === 1049) {
            //   this.x = this.savedX;
            //   this.y = this.savedY;
            // }
            this._terminal.refresh(0, this._terminal.rows - 1);
            this._terminal.viewport.syncScrollArea();
            this._terminal.showCursor();
          }
          break;
      }
    }
  }

  /**
   * CSI Pm m  Character Attributes (SGR).
   *     Ps = 0  -> Normal (default).
   *     Ps = 1  -> Bold.
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
  public charAttributes(params: number[]): void {
    // Optimize a single SGR0.
    if (params.length === 1 && params[0] === 0) {
      this._terminal.curAttr = this._terminal.defAttr;
      return;
    }

    let l = params.length
    , i = 0
    , flags = this._terminal.curAttr >> 18
    , fg = (this._terminal.curAttr >> 9) & 0x1ff
    , bg = this._terminal.curAttr & 0x1ff
    , p;

    for (; i < l; i++) {
      p = params[i];
      if (p >= 30 && p <= 37) {
        // fg color 8
        fg = p - 30;
      } else if (p >= 40 && p <= 47) {
        // bg color 8
        bg = p - 40;
      } else if (p >= 90 && p <= 97) {
        // fg color 16
        p += 8;
        fg = p - 90;
      } else if (p >= 100 && p <= 107) {
        // bg color 16
        p += 8;
        bg = p - 100;
      } else if (p === 0) {
        // default
        flags = this._terminal.defAttr >> 18;
        fg = (this._terminal.defAttr >> 9) & 0x1ff;
        bg = this._terminal.defAttr & 0x1ff;
        // flags = 0;
        // fg = 0x1ff;
        // bg = 0x1ff;
      } else if (p === 1) {
        // bold text
        flags |= 1;
      } else if (p === 4) {
        // underlined text
        flags |= 2;
      } else if (p === 5) {
        // blink
        flags |= 4;
      } else if (p === 7) {
        // inverse and positive
        // test with: echo -e '\e[31m\e[42mhello\e[7mworld\e[27mhi\e[m'
        flags |= 8;
      } else if (p === 8) {
        // invisible
        flags |= 16;
      } else if (p === 22) {
        // not bold
        flags &= ~1;
      } else if (p === 24) {
        // not underlined
        flags &= ~2;
      } else if (p === 25) {
        // not blink
        flags &= ~4;
      } else if (p === 27) {
        // not inverse
        flags &= ~8;
      } else if (p === 28) {
        // not invisible
        flags &= ~16;
      } else if (p === 39) {
        // reset fg
        fg = (this._terminal.defAttr >> 9) & 0x1ff;
      } else if (p === 49) {
        // reset bg
        bg = this._terminal.defAttr & 0x1ff;
      } else if (p === 38) {
        // fg color 256
        if (params[i + 1] === 2) {
          i += 2;
          fg = this._terminal.matchColor(
            params[i] & 0xff,
            params[i + 1] & 0xff,
            params[i + 2] & 0xff);
          if (fg === -1) fg = 0x1ff;
          i += 2;
        } else if (params[i + 1] === 5) {
          i += 2;
          p = params[i] & 0xff;
          fg = p;
        }
      } else if (p === 48) {
        // bg color 256
        if (params[i + 1] === 2) {
          i += 2;
          bg = this._terminal.matchColor(
            params[i] & 0xff,
            params[i + 1] & 0xff,
            params[i + 2] & 0xff);
          if (bg === -1) bg = 0x1ff;
          i += 2;
        } else if (params[i + 1] === 5) {
          i += 2;
          p = params[i] & 0xff;
          bg = p;
        }
      } else if (p === 100) {
        // reset fg/bg
        fg = (this._terminal.defAttr >> 9) & 0x1ff;
        bg = this._terminal.defAttr & 0x1ff;
      } else {
        this._terminal.error('Unknown SGR attribute: %d.', p);
      }
    }

    this._terminal.curAttr = (flags << 18) | (fg << 9) | bg;
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
  public deviceStatus(params: number[]): void {
    if (!this._terminal.prefix) {
      switch (params[0]) {
        case 5:
          // status report
          this._terminal.send(C0.ESC + '[0n');
          break;
        case 6:
          // cursor position
          this._terminal.send(C0.ESC + '['
                    + (this._terminal.y + 1)
                    + ';'
                    + (this._terminal.x + 1)
                    + 'R');
          break;
      }
    } else if (this._terminal.prefix === '?') {
      // modern xterm doesnt seem to
      // respond to any of these except ?6, 6, and 5
      switch (params[0]) {
        case 6:
          // cursor position
          this._terminal.send(C0.ESC + '[?'
                    + (this._terminal.y + 1)
                    + ';'
                    + (this._terminal.x + 1)
                    + 'R');
          break;
        case 15:
          // no printer
          // this.send(C0.ESC + '[?11n');
          break;
        case 25:
          // dont support user defined keys
          // this.send(C0.ESC + '[?21n');
          break;
        case 26:
          // north american keyboard
          // this.send(C0.ESC + '[?27;1;0;0n');
          break;
        case 53:
          // no dec locator/mouse
          // this.send(C0.ESC + '[?50n');
          break;
      }
    }
  }

  /**
   * CSI ! p   Soft terminal reset (DECSTR).
   * http://vt100.net/docs/vt220-rm/table4-10.html
   */
  public softReset(params: number[]): void {
    this._terminal.cursorHidden = false;
    this._terminal.insertMode = false;
    this._terminal.originMode = false;
    this._terminal.wraparoundMode = true;  // defaults: xterm - true, vt100 - false
    this._terminal.applicationKeypad = false; // ?
    this._terminal.viewport.syncScrollArea();
    this._terminal.applicationCursor = false;
    this._terminal.scrollTop = 0;
    this._terminal.scrollBottom = this._terminal.rows - 1;
    this._terminal.curAttr = this._terminal.defAttr;
    this._terminal.x = this._terminal.y = 0; // ?
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
  public setCursorStyle(params?: number[]): void {
    const param = params[0] < 1 ? 1 : params[0];
    switch (param) {
      case 1:
      case 2:
        this._terminal.setOption('cursorStyle', 'block');
        break;
      case 3:
      case 4:
        this._terminal.setOption('cursorStyle', 'underline');
        break;
      case 5:
      case 6:
        this._terminal.setOption('cursorStyle', 'bar');
        break;
    }
    const isBlinking = param % 2 === 1;
    this._terminal.setOption('cursorBlink', isBlinking);
  }

  /**
   * CSI Ps ; Ps r
   *   Set Scrolling Region [top;bottom] (default = full size of win-
   *   dow) (DECSTBM).
   * CSI ? Pm r
   */
  public setScrollRegion(params: number[]): void {
    if (this._terminal.prefix) return;
    this._terminal.scrollTop = (params[0] || 1) - 1;
    this._terminal.scrollBottom = (params[1] && params[1] <= this._terminal.rows ? params[1] : this._terminal.rows) - 1;
    this._terminal.x = 0;
    this._terminal.y = 0;
  }


  /**
   * CSI s
   *   Save cursor (ANSI.SYS).
   */
  public saveCursor(params: number[]): void {
    this._terminal.savedX = this._terminal.x;
    this._terminal.savedY = this._terminal.y;
  }


  /**
   * CSI u
   *   Restore cursor (ANSI.SYS).
   */
  public restoreCursor(params: number[]): void {
    this._terminal.x = this._terminal.savedX || 0;
    this._terminal.y = this._terminal.savedY || 0;
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
