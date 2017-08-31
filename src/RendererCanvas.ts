/**
 * @license MIT
 */

import { ITerminal } from './Interfaces';
import { DomElementObjectPool } from './utils/DomElementObjectPool';
import { CHAR_DATA_WIDTH_INDEX, CHAR_DATA_CHAR_INDEX } from './Buffer';

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

  constructor(private _terminal: ITerminal) {
    // Figure out whether boldness affects
    // the character width of monospace fonts.
    if (brokenBold === null) {
      brokenBold = checkBoldBroken(this._terminal.element);
    }

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
    this._terminal.emit('refresh', {start, end});
  }

  // TODO: This would be better as a large texture atlas rather than a cache of ImageData objects
  private _imageDataCache = {};
  private _colors = [
    // dark:
    '#2e3436',
    '#cc0000',
    '#4e9a06',
    '#c4a000',
    '#3465a4',
    '#75507b',
    '#06989a',
    '#d3d7cf',
    // bright:
    '#555753',
    '#ef2929',
    '#8ae234',
    '#fce94f',
    '#729fcf',
    '#ad7fa8',
    '#34e2e2',
    '#eeeeec'
  ];

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
    const charWidth = Math.ceil(this._terminal.charMeasure.width) * window.devicePixelRatio;
    const charHeight = Math.ceil(this._terminal.charMeasure.height) * window.devicePixelRatio;
    const ctx = this._terminal.canvasContext;

    ctx.fillStyle = '#000000';
    // console.log('fill', start, end);
    // console.log('fill', start * charHeight, (end - start + 1) * charHeight);
    // ctx.fillRect(0, start * charHeight, charWidth * this._terminal.cols, (end - start + 1) * charHeight);
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'top';
    ctx.font = `${16 * window.devicePixelRatio}px courier`;

    for (let y = start; y <= end; y++) {
      let row = y + this._terminal.buffer.ydisp;
      let line = this._terminal.buffer.lines.get(row);
      for (let x = 0; x < this._terminal.cols; x++) {
        ctx.save();

        let data: number = line[x][0];
        const ch = line[x][CHAR_DATA_CHAR_INDEX];

        // if (ch === ' ') {
        //   continue;
        // }

        let bg = data & 0x1ff;
        let fg = (data >> 9) & 0x1ff;
        let flags = data >> 18;

        // if (bg < 16) {
        // }

        if (flags & FLAGS.BOLD) {
          ctx.font = `bold ${ctx.font}`;
          // Convert the FG color to the bold variant
          if (fg < 8) {
            fg += 8;
          }
        }

        if (fg < 16) {
          ctx.fillStyle = this._colors[fg];
        } else if (fg < 256) {
          // TODO: Support colors 16-255
        }

        // Simulate cache
        let imageData;
        let key = ch + data;
        if (key in this._imageDataCache) {
          imageData = this._imageDataCache[key];
        } else {
          ctx.fillText(ch, x * charWidth, y * charHeight);
          if (flags & FLAGS.UNDERLINE) {
            ctx.fillRect(x * charWidth, (y + 1) * charHeight - window.devicePixelRatio, charWidth, window.devicePixelRatio);
          }
          imageData = ctx.getImageData(x * charWidth, y * charHeight, charWidth, charHeight);
          this._imageDataCache[key] = imageData;
        }
        ctx.putImageData(imageData, x * charWidth, y * charHeight);

        // Always write text
        // ctx.fillText(ch, x * charWidth, y * charHeight);
        ctx.restore();
      }
    }
  }

  /**
   * Refreshes the selection in the DOM.
   * @param start The selection start.
   * @param end The selection end.
   */
  public refreshSelection(start: [number, number], end: [number, number]): void {
    // Remove all selections
    while (this._terminal.selectionContainer.children.length) {
      this._terminal.selectionContainer.removeChild(this._terminal.selectionContainer.children[0]);
    }

    // Selection does not exist
    if (!start || !end) {
      return;
    }

    // Translate from buffer position to viewport position
    const viewportStartRow = start[1] - this._terminal.buffer.ydisp;
    const viewportEndRow = end[1] - this._terminal.buffer.ydisp;
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
function checkBoldBroken(terminalElement: HTMLElement): boolean {
  const document = terminalElement.ownerDocument;
  const el = document.createElement('span');
  el.innerHTML = 'hello world';
  terminalElement.appendChild(el);
  const w1 = el.offsetWidth;
  const h1 = el.offsetHeight;
  el.style.fontWeight = 'bold';
  const w2 = el.offsetWidth;
  const h2 = el.offsetHeight;
  terminalElement.removeChild(el);
  return w1 !== w2 || h1 !== h2;
}
