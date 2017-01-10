import { IInputHandler, ITerminal } from './Interfaces';
import { C0 } from './EscapeSequences';

export class InputHandler implements IInputHandler {
  // TODO: We want to type _terminal when it's pulled into TS
  constructor(private _terminal: any) { }

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
    this._terminal.x -= param;
    if (this._terminal.x < 0) {
      this._terminal.x = 0;
    }
  }

  /**
   * CSI Ps ; Ps H
   * Cursor Position [row;column] (default = [1,1]) (CUP).
   */
  public cursorPosition(params: number[]) {
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
  public eraseInDisplay(params: number[]) {
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
        ; // no saved lines
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
  public eraseInLine(params: number[]) {
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
  public charAttributes(params: number[]) {
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
  public deviceStatus(params: number[]) {
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

}
