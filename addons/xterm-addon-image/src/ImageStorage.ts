/**
 * Copyright (c) 2020 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { IDisposable } from 'xterm';
import { ImageRenderer } from './ImageRenderer';
import { ICoreTerminal, IExtendedAttrsImage, IImageSpec, IStorageOptions } from './Types';


// some constants for bufferline
const HAS_EXTENDED = 0x10000000;
const CELL_SIZE = 3;
const enum Cell {
  CONTENT = 0,
  FG = 1,
  BG = 2
}

/**
 * Extend extended attribute to also hold image tile information.
 */
export class ExtendedAttrsImage implements IExtendedAttrsImage {
  constructor(
    public underlineStyle = 0,
    public underlineColor: number = -1,
    public imageId = -1,
    public tileId = -1
  ) {}
  public clone(): ExtendedAttrsImage {
    return new ExtendedAttrsImage(this.underlineStyle, this.underlineColor, this.imageId, this.tileId);
  }
  public isEmpty(): boolean {
    return this.underlineStyle === 0 && this.imageId === -1;
  }
}
const EMPTY_ATTRS = new ExtendedAttrsImage();


/**
 * ImageStorage - extension of CoreTerminal:
 * - hold image data
 * - write/read image data to/from buffer
 * - alter buffer on resize (TODO)
 */
export class ImageStorage implements IDisposable {
  // storage
  private _images: Map<number, IImageSpec> = new Map();
  // last used id
  private _lastId = 0;
  // last evicted id
  private _lowestId = 0;
  // whether last render call has drawn anything
  private _hasDrawn = false;
  // total amount of stored pixels (used for hard limiting memory usage)
  private _storedPixels = 0;
  // hard limit of stored pixels (fallback limit of 10 MB)
  private _pixelLimit: number = 2500000;

  constructor(private _terminal: ICoreTerminal, private _renderer: ImageRenderer, limit: number) {
    try {
      this.setLimit(limit);
    } catch (e) {
      console.error(e.message);
      console.warn(`storageLimit is set to ${this.getLimit()} MB`);
    }
  }

  public dispose(): void {
    this.reset();
  }

  public reset(): void {
    // FIXME: Do we actually have to close all bitmaps beforehand?
    for (const spec of this._images.values()) {
      spec.bitmap?.close();
    }
    this._images.clear();
    this._storedPixels = 0;
    this._renderer.clearAll();
  }

  public getLimit(): number {
    return this._pixelLimit * 4 / 1000000;
  }

  public setLimit(value: number): void {
    if (value < 1 || value > 1000) {
      throw RangeError('invalid storageLimit, should be at least 1 MB and not exceed 1G');
    }
    this._pixelLimit = (value / 4 * 1000000) >>> 0;
    if (this._storedPixels > this._pixelLimit) {
      this._evictOldest();
    }
  }

  public getUsage(): number {
    return this._storedPixels * 4 / 1000000;
  }

  // FIXME: Do we need some blob offloading tricks here to avoid early eviction?
  // also see https://stackoverflow.com/questions/28307789/is-there-any-limitation-on-javascript-max-blob-size
  private _evictOldest(): void {
    // FIXME: check for _lowestId >= _lastId here?
    while (this._storedPixels > this._pixelLimit && this._images.size) {
      const spec = this._images.get(++this._lowestId);
      if (spec) {
        this._storedPixels -= spec.orig.width * spec.orig.height;
        if (spec.orig !== spec.actual) {
          this._storedPixels -= spec.actual.width * spec.actual.height;
        }
        spec.bitmap?.close();
        this._images.delete(this._lowestId);
      }
    }
  }

  public getCellAdjustedCanvas(width: number, height: number): HTMLCanvasElement {
    return ImageRenderer.createCanvas(
      Math.ceil(width / this._renderer.currentCellSize.width) * this._renderer.currentCellSize.width,
      Math.ceil(height / this._renderer.currentCellSize.height) * this._renderer.currentCellSize.height
    );
  }

  // FIXME: move to image handlers to avoid canvas reconstruction
  // private _adjustToFullCells(img: HTMLCanvasElement, opts: IStorageOptions): HTMLCanvasElement {
  //   const nw = Math.ceil(img.width / this._renderer.currentCellSize.width) * this._renderer.currentCellSize.width;
  //   const nh = Math.ceil(img.height / this._renderer.currentCellSize.height) * this._renderer.currentCellSize.height;
  //   const c = ImageRenderer.createCanvas(nw, nh);
  //   const ctx = c.getContext('2d');
  //   if (ctx) {
  //     if (opts.fill) {
  //       ctx.fillStyle = `rgba(${opts.fill >>> 24}, ${opts.fill >>> 16 & 0xFF}, ${opts.fill >>> 8 & 0xFF}, 1)`;
  //       ctx.fillRect(0, 0, c.width, c.height);
  //     }
  //     let x = 0;
  //     let y = 0;
  //     switch (opts.align) {
  //       case Align.TOP_LEFT:      x = 0; y = 0; break;
  //       case Align.TOP:           x = (c.width - img.width) / 2; y = 0; break;
  //       case Align.TOP_RIGHT:     x = c.width - img.width; y = 0; break;
  //       case Align.RIGHT:         x = c.width - img.width; y = (c.height - img.height) / 2; break;
  //       case Align.BOTTOM_RIGHT:  x = c.width - img.width; y = c.height - img.height; break;
  //       case Align.BOTTOM:        x = (c.width - img.width) / 2; y = c.height - img.height; break;
  //       case Align.BOTTOM_LEFT:   x = 0; y = c.height - img.height; break;
  //       case Align.LEFT:          x = 0; y = (c.height - img.height) / 2; break;
  //       case Align.CENTER:        x = (c.width - img.width) / 2; y = (c.height - img.height) / 2; break;
  //     }
  //     ctx.drawImage(img, x, y);
  //   }
  //   return c;
  // }

  private _writeToCell(line: any, x: number, imageId: number, tileId: number): void {
    const eAttr = new ExtendedAttrsImage(0, -1, imageId, tileId);
    if (line._data[x * CELL_SIZE + Cell.BG] & HAS_EXTENDED) {
      if (line._extendedAttrs[x]) {
        eAttr.underlineStyle = line._extendedAttrs[x].underlineStyle;
        eAttr.underlineColor = line._extendedAttrs[x].underlineColor;
        // TODO: collect and return old image tile for later composition
      }
    } else {
      line._data[x * CELL_SIZE + Cell.BG] |= HAS_EXTENDED;
    }
    line._extendedAttrs[x] = eAttr;
  }

  /**
   * Method to add an image to the storage.
   */
  public addImage(img: HTMLCanvasElement, options: IStorageOptions): void {
    // never allow storage to exceed memory limit
    this._storedPixels += img.width *img.height;
    if (this._storedPixels > this._pixelLimit) {
      this._evictOldest();
    }

    // calc rows x cols needed to display the image
    const cols = Math.ceil(img.width / this._renderer.currentCellSize.width);
    const rows = Math.ceil(img.height / this._renderer.currentCellSize.height);

    const imgIdx = ++this._lastId;

    const buffer = this._terminal._core.buffer;
    const termCols = this._terminal.cols;
    const termRows = this._terminal.rows;
    const originX = buffer.x;
    const originY = buffer.y;
    let offset = originX;

    if (!options.scroll) {
      this._terminal._core._dirtyRowService.markAllDirty();
      buffer.x = 0;
      buffer.y = 0;
      offset = 0;
    }

    // TODO: track image intersections from _writeToCell for composing and better tile eviction

    // FIXME: how to go with origin mode / scroll margins here?
    for (let row = 0; row < rows; ++row) {
      const line = buffer.lines.get(buffer.y + buffer.ybase);
      for (let col = 0; col < cols; ++col) {
        if (offset + col >= termCols) break;
        this._writeToCell(line, offset + col, imgIdx, row * cols + col);
      }
      if (options.scroll) {
        if (row < rows - 1) this._terminal._core._inputHandler.lineFeed();
      } else {
        if (++buffer.y >= termRows) break;
      }
      buffer.x = offset;
    }

    // cursor positioning modes
    if (options.scroll) {
      if (options.right) {
        buffer.x = offset + cols;
        if (buffer.x >= termCols) {
          this._terminal._core._inputHandler.lineFeed();
          buffer.x = (options.below) ? offset : 0;
        }
      } else {
        this._terminal._core._inputHandler.lineFeed();
        buffer.x = (options.below) ? offset : 0;
      }
    } else {
      buffer.x = originX;
      buffer.y = originY;
    }

    // TODO: mark every line + remark on resize to get better disposal coverage
    const endMarker = this._terminal.registerMarker(0);
    endMarker?.onDispose(this._markerGotDisposed(this._lastId));
    const imgSpec: IImageSpec = {
      orig: img,
      origCellSize: this._renderer.currentCellSize,
      actual: img,
      actualCellSize: this._renderer.currentCellSize,
      bitmap: undefined
    };
    this._images.set(this._lastId, imgSpec);
    ImageRenderer.createImageBitmap(img).then((bitmap) => imgSpec.bitmap = bitmap);
  }

  private _markerGotDisposed(idx: number): () => void {
    // FIXME: check if all tiles got really removed (best efford read-ahead?)
    // FIXME: this also needs a method to throw away images once the tile counter is zero
    // --> avoid memory hogging by inplace image overwrites
    // How to achieve that?
    // - scan tile usage in original image area on image pressure (start + end marker?)
    // - failsafe setting: upper image limit (fifo? least recently?)
    return () => {
      if (this._images.has(idx)) {
        this._images.get(idx)!.bitmap?.close();
        this._images.delete(idx);
      }
      // FIXME: is it enough to remove the image spec here?
    };
  }

  public render(range: {start: number, end: number}): void {
    // exit early if dont have any images to test for
    if (!this._images.size || !this._renderer.canvas) {
      if (this._hasDrawn) {
        this._renderer.clearAll();
        this._hasDrawn = false;
      }
      return;
    }

    const {start, end} = range;
    const buffer = this._terminal._core.buffer;
    const cols = this._terminal._core.cols;
    this._hasDrawn = false;

    // rescale image layer if needed
    this._renderer.rescaleCanvas();
    // clear drawing area
    this._renderer.clearLines(start, end);

    // walk all cells in viewport and draw tiles found
    for (let row = start; row <= end; ++row) {
      const line = buffer.lines.get(row + buffer.ydisp);
      if (!line) return;
      for (let col = 0; col < cols; ++col) {
        if (line.getBg(col) & HAS_EXTENDED) {
          let e: ExtendedAttrsImage = line._extendedAttrs[col] || EMPTY_ATTRS;
          const imageId = e.imageId;
          const imgSpec = this._images.get(imageId);
          if (imgSpec && e.tileId !== -1) {
            const startTile = e.tileId;
            const startCol = col;
            let count = 1;
            /**
             * merge tiles to the right into a single draw call, if:
             * - not at end of line
             * - cell has same image id
             * - cell has consecutive tile id
             */
            while (
              ++col < cols
              && (line.getBg(col) & HAS_EXTENDED)
              && (e = line._extendedAttrs[col] || EMPTY_ATTRS)
              && (e.imageId === imageId)
              && (e.tileId === startTile + count)
            ) {
              count++;
            }
            col--;
            this._renderer.draw(imgSpec, startTile, startCol, row, count);
            this._hasDrawn = true;
          }
        }
      }
    }
  }
}
