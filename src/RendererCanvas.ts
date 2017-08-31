/**
 * @license MIT
 */

import { ITerminal } from './Interfaces';
import { DomElementObjectPool } from './utils/DomElementObjectPool';
import { CHAR_DATA_WIDTH_INDEX, CHAR_DATA_CHAR_INDEX } from './Buffer';
import { createBackgroundFillData } from './renderer/Canvas';
import { IRenderLayer } from './renderer/Interfaces';
import { BackgroundRenderLayer } from './renderer/BackgroundRenderLayer';

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

  private _textCanvasElement: HTMLCanvasElement;
  private _textCanvasContext: CanvasRenderingContext2D;
  private _offscreenCanvas: HTMLCanvasElement;
  private _offscreenContext: CanvasRenderingContext2D;

  private _renderLayers: IRenderLayer[];

  private _charAtlasBitmap;//: ImageBitmap;

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
  private _imageData: ImageData;

  constructor(private _terminal: ITerminal) {
    // Figure out whether boldness affects
    // the character width of monospace fonts.
    if (brokenBold === null) {
      brokenBold = checkBoldBroken(this._terminal.element);
    }

    this._textCanvasElement = document.createElement('canvas');
    this._textCanvasElement.classList.add('xterm-text-canvas');
    this._textCanvasContext = this._textCanvasElement.getContext('2d');
    this._textCanvasContext.scale(window.devicePixelRatio, window.devicePixelRatio);

    this._offscreenCanvas = document.createElement('canvas');
    this._offscreenContext = this._offscreenCanvas.getContext('2d');
    this._offscreenContext.scale(window.devicePixelRatio, window.devicePixelRatio);

    this._renderLayers = [
      new BackgroundRenderLayer(this._terminal.element)
    ];

    this._terminal.element.appendChild(this._textCanvasElement);

    // TODO: Pull more DOM interactions into Renderer.constructor, element for
    // example should be owned by Renderer (and also exposed by Terminal due to
    // to established public API).
  }

  public onResize(cols: number, rows: number): void {
    // TODO: Could be triggered immediately after onCharSizeChanged
  }

  public onCharSizeChanged(charWidth: number, charHeight: number): void {
    const width = Math.ceil(charWidth) * this._terminal.cols;
    const height = Math.ceil(charHeight) * this._terminal.rows;
    this._textCanvasElement.width = width * window.devicePixelRatio;
    this._textCanvasElement.height = height * window.devicePixelRatio;
    this._textCanvasElement.style.width = `${width}px`;
    this._textCanvasElement.style.height = `${height}px`;
    this._offscreenCanvas.width = 255 * charWidth * window.devicePixelRatio;
    this._offscreenCanvas.height = (/*default*/1 + /*0-15*/16) * charHeight * window.devicePixelRatio;
    this._refreshCharImageDataAtlas();
    for (let i = 0; i < this._renderLayers.length; i++) {
      this._renderLayers[i].resize(width, height, charWidth, charHeight);
    }
  }

  private _refreshCharImageDataAtlas(): void {
    const scaledCharWidth = Math.ceil(this._terminal.charMeasure.width) * window.devicePixelRatio;
    const scaledCharHeight = Math.ceil(this._terminal.charMeasure.height) * window.devicePixelRatio;

    this._offscreenContext.save();
    this._offscreenContext.fillStyle = '#ffffff';
    this._offscreenContext.font = `${16 * window.devicePixelRatio}px courier`;
    this._offscreenContext.textBaseline = 'top';
    // Default color
    for (let i = 0; i < 256; i++) {
      this._offscreenContext.fillText(String.fromCharCode(i), i * scaledCharWidth, 0);
    }
    // Colors 0-15
    for (let colorIndex = 0; colorIndex < 16; colorIndex++) {
      // colors 8-15 are bold
      if (colorIndex === 8) {
        this._offscreenContext.font = `bold ${this._offscreenContext.font}`;
      }
      for (let i = 0; i < 256; i++) {
        this._offscreenContext.fillStyle = this._colors[colorIndex];
        this._offscreenContext.fillText(String.fromCharCode(i), i * scaledCharWidth, (colorIndex + 1) * scaledCharHeight);
      }
    }
    this._offscreenContext.restore();

    const charAtlasImageData = this._offscreenContext.getImageData(0, 0, this._offscreenCanvas.width, this._offscreenCanvas.height);
    (<any>window).createImageBitmap(charAtlasImageData).then(bitmap => {
      this._charAtlasBitmap = bitmap;
    });

    this._offscreenContext.clearRect(0, 0, this._offscreenCanvas.width, this._offscreenCanvas.height);
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
    for (let i = 0; i < this._renderLayers.length; i++) {
      this._renderLayers[i].render(this._terminal, start, end);
    }
    this._terminal.emit('refresh', {start, end});
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
    const scaledCharWidth = Math.ceil(this._terminal.charMeasure.width) * window.devicePixelRatio;
    const scaledCharHeight = Math.ceil(this._terminal.charMeasure.height) * window.devicePixelRatio;
    const textCtx = this._textCanvasContext;

    // TODO: Needs to react to terminal resize
    // Initialize image data
    if (!this._imageData) {
      this._imageData = textCtx.createImageData(scaledCharWidth * this._terminal.cols * window.devicePixelRatio, scaledCharHeight * this._terminal.rows * window.devicePixelRatio);
      this._imageData.data.set(createBackgroundFillData(this._imageData.width, this._imageData.height, 255, 0, 0, 255));
    }

    // Don't bother rendering until the atlas bitmap is ready
    if (!this._charAtlasBitmap) {
      return;
    }

    // console.log('fill', start, end);
    // console.log('fill', start * charHeight, (end - start + 1) * charHeight);
    // ctx.fillRect(0, start * charHeight, charWidth * this._terminal.cols, (end - start + 1) * charHeight);
    textCtx.fillStyle = '#ffffff';
    textCtx.textBaseline = 'top';
    textCtx.font = `${16 * window.devicePixelRatio}px courier`;

    // Clear out the old data
    textCtx.clearRect(0, start * scaledCharHeight, scaledCharWidth * this._terminal.cols, (end - start + 1) * scaledCharHeight);

    for (let y = start; y <= end; y++) {
      let row = y + this._terminal.buffer.ydisp;
      let line = this._terminal.buffer.lines.get(row);
      for (let x = 0; x < this._terminal.cols; x++) {
        textCtx.save();

        let data: number = line[x][0];
        // const ch = line[x][CHAR_DATA_CHAR_INDEX];
        const code: number = <number>line[x][3];

        // if (ch === ' ') {
        //   continue;
        // }

        // let bg = data & 0x1ff;
        let fg = (data >> 9) & 0x1ff;
        let flags = data >> 18;

        if (flags & FLAGS.BOLD) {
          textCtx.font = `bold ${textCtx.font}`;
          // Convert the FG color to the bold variant
          if (fg < 8) {
            fg += 8;
          }
        }

        // if (fg < 16) {
        //   ctx.fillStyle = this._colors[fg];
        // } else if (fg < 256) {
        //   // TODO: Support colors 16-255
        // }

        let colorIndex = 0;
        if (fg < 16) {
          colorIndex = fg + 1;
        }

        // Simulate cache
        // let imageData;
        // let key = ch + data;
        // if (key in this._imageDataCache) {
        //   imageData = this._imageDataCache[key];
        // } else {
        //   ctx.fillText(ch, x * scaledCharWidth, y * scaledCharHeight);
        //   if (flags & FLAGS.UNDERLINE) {
        //     ctx.fillRect(x * scaledCharWidth, (y + 1) * scaledCharHeight - window.devicePixelRatio, scaledCharWidth, window.devicePixelRatio);
        //   }
        //   imageData = ctx.getImageData(x * scaledCharWidth, y * scaledCharHeight, scaledCharWidth, scaledCharHeight);
        //   this._imageDataCache[key] = imageData;
        // }
        // ctx.putImageData(imageData, x * scaledCharWidth, y * scaledCharHeight);

        // TODO: Try to get atlas working
        // This seems too slow :(
        // ctx.putImageData(this._charImageDataAtlas, x * scaledCharWidth - ch.charCodeAt(0) * scaledCharWidth, y * scaledCharHeight, ch.charCodeAt(0) * scaledCharWidth, 0, scaledCharWidth, scaledCharHeight);

        // ctx.drawImage(this._offscreenCanvas, code * scaledCharWidth, 0, scaledCharWidth, scaledCharHeight, x * scaledCharWidth, y * scaledCharHeight, scaledCharWidth, scaledCharHeight);

        // ImageBitmap's draw about twice as fast as from a canvas
        textCtx.drawImage(this._charAtlasBitmap, code * scaledCharWidth, colorIndex * scaledCharHeight, scaledCharWidth, scaledCharHeight, x * scaledCharWidth, y * scaledCharHeight, scaledCharWidth, scaledCharHeight);

        // Always write text
        // ctx.fillText(ch, x * charWidth, y * charHeight);
        textCtx.restore();
      }


      // TODO: Try to get atlas working
      // ctx.putImageData(this._charImageDataAtlas, y * scaledCharWidth, y * scaledCharHeight, 65 * scaledCharWidth, 0, scaledCharWidth, scaledCharHeight);
    }

    // This draws the atlas (for debugging purposes)
    // ctx.putImageData(this._charImageDataAtlas, 0, 0);
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
