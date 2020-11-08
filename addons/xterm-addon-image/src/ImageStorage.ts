/**
 * Copyright (c) 2020 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { Terminal, IDisposable } from 'xterm';
import { ImageRenderer } from './ImageRenderer';
import { IImageSpec } from './Types';


// buffer placeholder
// FIXME: find better method to announce foreign content
const CODE = 0x110000; // illegal unicode char
const INVISIBLE = 0x40000000; // taken from BufferLine.ts


/**
 * ImageStorage - extension of CoreTerminal:
 * - hold image data
 * - write image data to buffer
 * - alter buffer on resize
 */
export class ImageStorage implements IDisposable {
  private _images: Map<number, IImageSpec> = new Map();
  private _lastId = 0;

  constructor(private _terminal: Terminal, private _ir: ImageRenderer) {}

  public dispose(): void {
    this._images.clear();
  }

  /**
   * Method to add an image to the storage.
   * Does all the needed low level stuff to tile the image data correctly
   * onto the terminal buffer cells.
   */
  public addImage(img: HTMLCanvasElement): void {
    /**
     * TODO - create markers:
     *    start marker  - first line containing image data
     *    end marker    - line below last line containing image data
     *
     * use markers:
     *  - speedup rendering
     *    instead of searching cell by cell through all viewport cells,
     *    search for image start-end marker intersections with viewport lines
     *    --> investigate, not likely to help much from first tests
     */

    // calc rows x cols needed to display the image
    const cols = Math.ceil(img.width / this._ir.currentCellSize.width);
    const rows = Math.ceil(img.height / this._ir.currentCellSize.height);

    // write placeholder into terminal buffer
    const imgIdx = this._lastId;
    const fg = INVISIBLE | imgIdx;

    const internalTerm = (this._terminal as any)._core;
    const buffer = internalTerm.buffer;
    const offset = internalTerm.buffer.x;

    for (let row = 0; row < rows - 1; ++row) {
      const bufferRow = buffer.lines.get(buffer.y + buffer.ybase);
      for (let col = 0; col < cols; ++col) {
        if (offset + col >= internalTerm.cols) {
          break;
        }
        const tileNum = row * cols + col;
        bufferRow.setCellFromCodePoint(offset + col, CODE, 1, fg, tileNum);
      }
      internalTerm._inputHandler.lineFeed();
      buffer.x = offset;
    }
    // last line
    const bufferRow = buffer.lines.get(buffer.y + buffer.ybase);
    for (let col = 0; col < cols; ++col) {
      if (offset + col >= internalTerm.cols) {
        break;
      }
      const tileNum = (rows - 1) * cols + col;
      bufferRow.setCellFromCodePoint(offset + col, CODE, 1, fg, tileNum);
    }
    buffer.x += cols;
    if (buffer.x >= internalTerm.cols) {
      internalTerm._inputHandler.lineFeed();
    }

    // TODO: mark every line + remark on resize to get better disposal coverage
    const endMarker = this._terminal.registerMarker(0);
    endMarker?.onDispose(() => this._markerGotDisposed(this._lastId));
    const imgSpec: IImageSpec = {
      orig: img,
      origCellSize: this._ir.currentCellSize,
      actual: img,
      actualCellSize: this._ir.currentCellSize,
      bitmap: undefined
    };
    this._images.set(this._lastId++, imgSpec);
    ImageRenderer.createImageBitmap(img).then((bitmap) => imgSpec.bitmap = bitmap);
  }

  private _markerGotDisposed(idx: number): void {
    // FIXME: check if all tiles got really removed (best efford read-ahead?)
    // FIXME: this also needs a method to throw away images once the tile counter is zero
    // --> avoid memory hogging by inplace image overwrites
    // How to achieve that?
    // - scan tile usage in original image area on image pressure (start + end marker?)
    // - failsafe setting: upper image limit (fifo? least recently?)
    if (this._images.has(idx)) {
      const is = this._images.get(idx);
      is?.bitmap?.close();
      this._images.delete(idx);
    }
    // FIXME: is it enough to remove the image spec here?
  }

  // TODO: resort render stuff to image renderer
  public render(e: {start: number, end: number}): void {
    // exit early if dont have any images to test for
    if (!this._images.size || !this._ir.canvas) {
      return;
    }

    const {start, end} = e;
    const internalTerm = (this._terminal as any)._core;
    const buffer = internalTerm.buffer;

    // rescale image layer if needed
    this._ir.rescaleCanvas();
    // clear drawing area
    this._ir.clearLines(start, end);

    // walk all cells in viewport and draw tile if needed
    for (let row = start; row <= end; ++row) {
      const bufferRow = buffer.lines.get(row + buffer.ydisp);
      for (let col = 0; col < internalTerm.cols; ++col) {
        if (bufferRow.getCodePoint(col) === CODE) {
          const fg = bufferRow.getFg(col);
          if (fg & INVISIBLE) {
            const id = fg & 0xFFFFFF;
            let cCol = col;
            let count = 1;
            // TODO: check for correct tile order as well
            // FIXME: draw as much as possible to the right
            // --> this needs a proper way of resize handling w/o too many wrapping artefacts
            const trimmedLength = bufferRow.getTrimmedLength();
            const lastIsImage = bufferRow.getCodePoint(trimmedLength - 1) === CODE && bufferRow.getFg(trimmedLength - 1);
            while (
              ++cCol < internalTerm.cols
              && (
                id === (bufferRow.getFg(cCol) & 0xFFFFFF)
                || (cCol >= trimmedLength && lastIsImage)
              )
            ) {
              count++;
            }
            const imgSpec = this._images.get(id);
            if (imgSpec) {
              this._ir.draw(imgSpec, bufferRow.getBg(col) & 0xFFFFFF, col, row, count);
            }
            col = cCol - 1;
          }
        }
      }
    }
  }
}
