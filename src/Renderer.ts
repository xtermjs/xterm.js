/**
 * @license MIT
 */

import { ITerminal } from './Interfaces';
import { DomElementObjectPool } from './utils/DomElementObjectPool';

/**
 * The maximum number of refresh frames to skip when the write buffer is non-
 * empty. Note that these frames may be intermingled with frames that are
 * skipped via requestAnimationFrame's mechanism.
 */
const MAX_REFRESH_FRAME_SKIP = 5;

/**
 * Flags used to render terminal text properly.
 */
enum FLAGS {
  BOLD = 1,
  UNDERLINE = 2,
  BLINK = 4,
  INVERSE = 8,
  INVISIBLE = 16
};

let brokenBold: boolean = null;

export class Renderer {
  /** A queue of the rows to be refreshed */
  private _refreshRowsQueue: {start: number, end: number}[] = [];
  private _refreshFramesSkipped = 0;
  private _refreshAnimationFrame = null;

  private _spanElementObjectPool = new DomElementObjectPool('span');

  constructor(private _terminal: ITerminal) {
    // Figure out whether boldness affects
    // the character width of monospace fonts.
    if (brokenBold === null) {
      brokenBold = checkBoldBroken((<any>this._terminal).element);
    }
    this._spanElementObjectPool = new DomElementObjectPool('span');

    // TODO: Pull more DOM interactions into Renderer.constructor, element for
    // example should be owned by Renderer (and also exposed by Terminal due to
    // to established public API).
  }

  /**
   * Queues a refresh between two rows (inclusive), to be done on next animation
   * frame.
   * @param {number} start The start row.
   * @param {number} end The end row.
   */
  public queueRefresh(start: number, end: number): void {
    this._refreshRowsQueue.push({ start: start, end: end });
    if (!this._refreshAnimationFrame) {
      this._refreshAnimationFrame = window.requestAnimationFrame(this._refreshLoop.bind(this));
    }
  }

  /**
   * Performs the refresh loop callback, calling refresh only if a refresh is
   * necessary before queueing up the next one.
   */
  private _refreshLoop(): void {
    // Skip MAX_REFRESH_FRAME_SKIP frames if the writeBuffer is non-empty as it
    // will need to be immediately refreshed anyway. This saves a lot of
    // rendering time as the viewport DOM does not need to be refreshed, no
    // scroll events, no layouts, etc.
    const skipFrame = this._terminal.writeBuffer.length > 0 && this._refreshFramesSkipped++ <= MAX_REFRESH_FRAME_SKIP;
    if (skipFrame) {
      this._refreshAnimationFrame = window.requestAnimationFrame(this._refreshLoop.bind(this));
      return;
    }

    this._refreshFramesSkipped = 0;
    let start;
    let end;
    if (this._refreshRowsQueue.length > 4) {
      // Just do a full refresh when 5+ refreshes are queued
      start = 0;
      end = this._terminal.rows - 1;
    } else {
      // Get start and end rows that need refreshing
      start = this._refreshRowsQueue[0].start;
      end = this._refreshRowsQueue[0].end;
      for (let i = 1; i < this._refreshRowsQueue.length; i++) {
        if (this._refreshRowsQueue[i].start < start) {
          start = this._refreshRowsQueue[i].start;
        }
        if (this._refreshRowsQueue[i].end > end) {
          end = this._refreshRowsQueue[i].end;
        }
      }
    }
    this._refreshRowsQueue = [];
    this._refreshAnimationFrame = null;
    this._refresh(start, end);
  }

  /**
   * Refreshes (re-renders) terminal content within two rows (inclusive)
   *
   * Rendering Engine:
   *
   * In the screen buffer, each character is stored as a an array with a character
   * and a 32-bit integer:
   *   - First value: a utf-16 character.
   *   - Second value:
   *   - Next 9 bits: background color (0-511).
   *   - Next 9 bits: foreground color (0-511).
   *   - Next 14 bits: a mask for misc. flags:
   *     - 1=bold
   *     - 2=underline
   *     - 4=blink
   *     - 8=inverse
   *     - 16=invisible
   *
   * @param {number} start The row to start from (between 0 and terminal's height terminal - 1)
   * @param {number} end The row to end at (between fromRow and terminal's height terminal - 1)
   */
  private _refresh(start: number, end: number): void {
    // If this is a big refresh, remove the terminal rows from the DOM for faster calculations
    let parent;
    if (end - start >= this._terminal.rows / 2) {
      parent = this._terminal.element.parentNode;
      if (parent) {
        this._terminal.element.removeChild(this._terminal.rowContainer);
      }
    }

    let width = this._terminal.cols;
    let y = start;

    if (end >= this._terminal.rows) {
      this._terminal.log('`end` is too large. Most likely a bad CSR.');
      end = this._terminal.rows - 1;
    }

    for (; y <= end; y++) {
      let row = y + this._terminal.ydisp;

      let line = this._terminal.lines.get(row);

      let x;
      if (this._terminal.y === y - (this._terminal.ybase - this._terminal.ydisp) &&
          this._terminal.cursorState &&
          !this._terminal.cursorHidden) {
        x = this._terminal.x;
      } else {
        x = -1;
      }

      let attr = this._terminal.defAttr;

      const documentFragment = document.createDocumentFragment();
      let innerHTML = '';
      let currentElement;

      // Return the row's spans to the pool
      while (this._terminal.children[y].children.length) {
        const child = this._terminal.children[y].children[0];
        this._terminal.children[y].removeChild(child);
        this._spanElementObjectPool.release(<HTMLElement>child);
      }

      for (let i = 0; i < width; i++) {
        // TODO: Could data be a more specific type?
        let data: any = line[i][0];
        const ch = line[i][1];
        const ch_width: any = line[i][2];
        if (!ch_width) {
          continue;
        }

        if (i === x) {
          data = -1;
        }

        if (data !== attr) {
          if (attr !== this._terminal.defAttr) {
            if (innerHTML) {
              currentElement.innerHTML = innerHTML;
              innerHTML = '';
            }
            documentFragment.appendChild(currentElement);
            currentElement = null;
          }
          if (data !== this._terminal.defAttr) {
            if (innerHTML && !currentElement) {
              currentElement = this._spanElementObjectPool.acquire();
            }
            if (currentElement) {
              if (innerHTML) {
                currentElement.innerHTML = innerHTML;
                innerHTML = '';
              }
              documentFragment.appendChild(currentElement);
            }
            currentElement = this._spanElementObjectPool.acquire();
            if (data === -1) {
              currentElement.classList.add('reverse-video');
              currentElement.classList.add('terminal-cursor');
            } else {
              let bg = data & 0x1ff;
              let fg = (data >> 9) & 0x1ff;
              let flags = data >> 18;

              if (flags & FLAGS.BOLD) {
                if (!brokenBold) {
                  currentElement.classList.add('xterm-bold');
                }
                // See: XTerm*boldColors
                if (fg < 8) {
                  fg += 8;
                }
              }

              if (flags & FLAGS.UNDERLINE) {
                currentElement.classList.add('xterm-underline');
              }

              if (flags & FLAGS.BLINK) {
                currentElement.classList.add('xterm-blink');
              }

              // If inverse flag is on, then swap the foreground and background variables.
              if (flags & FLAGS.INVERSE) {
                let temp = bg;
                bg = fg;
                fg = temp;
                // Should inverse just be before the above boldColors effect instead?
                if ((flags & 1) && fg < 8) {
                  fg += 8;
                }
              }

              if (flags & FLAGS.INVISIBLE) {
                currentElement.classList.add('xterm-hidden');
              }

              /**
               * Weird situation: Invert flag used black foreground and white background results
               * in invalid background color, positioned at the 256 index of the 256 terminal
               * color map. Pin the colors manually in such a case.
               *
               * Source: https://github.com/sourcelair/xterm.js/issues/57
               */
              if (flags & FLAGS.INVERSE) {
                if (bg === 257) {
                  bg = 15;
                }
                if (fg === 256) {
                  fg = 0;
                }
              }

              if (bg < 256) {
                currentElement.classList.add(`xterm-bg-color-${bg}`);
              }

              if (fg < 256) {
                currentElement.classList.add(`xterm-color-${fg}`);
              }
            }
          }
        }

        if (ch_width === 2) {
          // Wrap wide characters so they're sized correctly. It's more difficult to release these
          // from the object pool so just create new ones via innerHTML.
          innerHTML += `<span class="xterm-wide-char">${ch}</span>`;
        } else if (ch.charCodeAt(0) > 255) {
          // Wrap any non-wide unicode character as some fonts size them badly
          innerHTML += `<span class="xterm-normal-char">${ch}</span>`;
        } else {
          switch (ch) {
            case '&':
              innerHTML += '&amp;';
              break;
            case '<':
              innerHTML += '&lt;';
              break;
            case '>':
              innerHTML += '&gt;';
              break;
            default:
              if (ch <= ' ') {
                innerHTML += '&nbsp;';
              } else {
                innerHTML += ch;
              }
              break;
          }
        }

        attr = data;
      }

      if (innerHTML && !currentElement) {
        currentElement = this._spanElementObjectPool.acquire();
      }
      if (currentElement) {
        if (innerHTML) {
          currentElement.innerHTML = innerHTML;
          innerHTML = '';
        }
        documentFragment.appendChild(currentElement);
        currentElement = null;
      }

      this._terminal.children[y].appendChild(documentFragment);
    }

    if (parent) {
      this._terminal.element.appendChild(this._terminal.rowContainer);
    }

    this._terminal.emit('refresh', {element: this._terminal.element, start: start, end: end});
  };

  /**
   * Refreshes the selection in the DOM.
   * @param start The selection start.
   * @param end The selection end.
   */
  public refreshSelection(start: [number, number], end: [number, number]) {
    // Remove all selections
    while (this._terminal.selectionContainer.children.length) {
      this._terminal.selectionContainer.removeChild(this._terminal.selectionContainer.children[0]);
    }

    // Selection does not exist
    if (!start || !end) {
      return;
    }

    // Translate from buffer position to viewport position
    const viewportStartRow = start[1] - this._terminal.ydisp;
    const viewportEndRow = end[1] - this._terminal.ydisp;
    const viewportCappedStartRow = Math.max(viewportStartRow, 0);
    const viewportCappedEndRow = Math.min(viewportEndRow, this._terminal.rows - 1);

    // No need to draw the selection
    if (viewportCappedStartRow >= this._terminal.rows || viewportCappedEndRow < 0) {
      return;
    }

    // Create the selections
    const documentFragment = document.createDocumentFragment();
    // Draw first row
    const startCol = viewportStartRow === viewportCappedStartRow ? start[0] : 0;
    const endCol = viewportCappedStartRow === viewportCappedEndRow ? end[0] : this._terminal.cols;
    documentFragment.appendChild(this._createSelectionElement(viewportCappedStartRow, startCol, endCol));
    // Draw middle rows
    const middleRowsCount = viewportCappedEndRow - viewportCappedStartRow - 1;
    documentFragment.appendChild(this._createSelectionElement(viewportCappedStartRow + 1, 0, this._terminal.cols, middleRowsCount));
    // Draw final row
    if (viewportCappedStartRow !== viewportCappedEndRow) {
      // Only draw viewportEndRow if it's not the same as viewporttartRow
      const endCol = viewportEndRow === viewportCappedEndRow ? end[0] : this._terminal.cols;
      documentFragment.appendChild(this._createSelectionElement(viewportCappedEndRow, 0, endCol));
    }
    this._terminal.selectionContainer.appendChild(documentFragment);
  }

  /**
   * Creates a selection element at the specified position.
   * @param row The row of the selection.
   * @param colStart The start column.
   * @param colEnd The end columns.
   */
  private _createSelectionElement(row: number, colStart: number, colEnd: number, rowCount: number = 1): HTMLElement {
    const element = document.createElement('div');
    element.style.height = `${rowCount * this._terminal.charMeasure.height}px`;
    element.style.top = `${row * this._terminal.charMeasure.height}px`;
    element.style.left = `${colStart * this._terminal.charMeasure.width}px`;
    element.style.width = `${this._terminal.charMeasure.width * (colEnd - colStart)}px`;
    return element;
  }
}


// If bold is broken, we can't use it in the terminal.
function checkBoldBroken(terminal) {
  const document = terminal.ownerDocument;
  const el = document.createElement('span');
  el.innerHTML = 'hello world';
  terminal.appendChild(el);
  const w1 = el.offsetWidth;
  const h1 = el.offsetHeight;
  el.style.fontWeight = 'bold';
  const w2 = el.offsetWidth;
  const h2 = el.offsetHeight;
  terminal.removeChild(el);
  return w1 !== w2 || h1 !== h2;
}
