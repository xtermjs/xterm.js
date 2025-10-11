/**
 * Copyright (c) 2020 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IDisposable } from '@xterm/xterm';
import { ImageRenderer } from './ImageRenderer';
import { ITerminalExt, IExtendedAttrsImage, IImageAddonOptions, IImageSpec, IBufferLineExt, BgFlags, Cell, Content, ICellSize, ExtFlags, Attributes, UnderlineStyle } from './Types';


// fallback default cell size
export const CELL_SIZE_DEFAULT: ICellSize = {
  width: 7,
  height: 14
};

/**
 * Extend extended attribute to also hold image tile information.
 *
 * Object definition is copied from base repo to fully mimick its behavior.
 * Image data is added as additional public properties `imageId` and `tileId`.
 */
class ExtendedAttrsImage implements IExtendedAttrsImage {
  private _ext: number = 0;
  public get ext(): number {
    if (this._urlId) {
      return (
        (this._ext & ~ExtFlags.UNDERLINE_STYLE) |
        (this.underlineStyle << 26)
      );
    }
    return this._ext;
  }
  public set ext(value: number) { this._ext = value; }

  public get underlineStyle(): UnderlineStyle {
    // Always return the URL style if it has one
    if (this._urlId) {
      return UnderlineStyle.DASHED;
    }
    return (this._ext & ExtFlags.UNDERLINE_STYLE) >> 26;
  }
  public set underlineStyle(value: UnderlineStyle) {
    this._ext &= ~ExtFlags.UNDERLINE_STYLE;
    this._ext |= (value << 26) & ExtFlags.UNDERLINE_STYLE;
  }

  public get underlineColor(): number {
    return this._ext & (Attributes.CM_MASK | Attributes.RGB_MASK);
  }
  public set underlineColor(value: number) {
    this._ext &= ~(Attributes.CM_MASK | Attributes.RGB_MASK);
    this._ext |= value & (Attributes.CM_MASK | Attributes.RGB_MASK);
  }

  public get underlineVariantOffset(): number {
    const val = (this._ext & ExtFlags.VARIANT_OFFSET) >> 29;
    if (val < 0) {
      return val ^ 0xFFFFFFF8;
    }
    return val;
  }
  public set underlineVariantOffset(value: number) {
    this._ext &= ~ExtFlags.VARIANT_OFFSET;
    this._ext |= (value << 29) & ExtFlags.VARIANT_OFFSET;
  }

  private _urlId: number = 0;
  public get urlId(): number {
    return this._urlId;
  }
  public set urlId(value: number) {
    this._urlId = value;
  }

  constructor(
    ext: number = 0,
    urlId: number = 0,
    public imageId = -1,
    public tileId = -1
  ) {
    this._ext = ext;
    this._urlId = urlId;
  }

  public clone(): IExtendedAttrsImage {
    /**
     * Technically we dont need a clone variant of ExtendedAttrsImage,
     * as we never clone a cell holding image data.
     * Note: Clone is only meant to be used by the InputHandler for
     * sticky attributes, which is never the case for image data.
     * We still provide a proper clone method to reflect the full ext attr
     * state in case there are future use cases for clone.
     */
    return new ExtendedAttrsImage(this._ext, this._urlId, this.imageId, this.tileId);
  }

  public isEmpty(): boolean {
    return this.underlineStyle === UnderlineStyle.NONE && this._urlId === 0 && this.imageId === -1;
  }
}
const EMPTY_ATTRS = new ExtendedAttrsImage();


/**
 * ImageStorage - extension of CoreTerminal:
 * - hold image data
 * - write/read image data to/from buffer
 *
 * TODO: image composition for overwrites
 */
export class ImageStorage implements IDisposable {
  // storage
  private _images: Map<number, IImageSpec> = new Map();
  // last used id
  private _lastId = 0;
  // last evicted id
  private _lowestId = 0;
  // whether a full clear happened before
  private _fullyCleared = false;
  // whether render should do a full clear
  private _needsFullClear = false;
  // hard limit of stored pixels (fallback limit of 10 MB)
  private _pixelLimit: number = 2500000;

  private _viewportMetrics: { cols: number, rows: number };

  constructor(
    private _terminal: ITerminalExt,
    private _renderer: ImageRenderer,
    private _opts: IImageAddonOptions
  ) {
    try {
      this.setLimit(this._opts.storageLimit);
    } catch (e: any) {
      console.error(e.message);
      console.warn(`storageLimit is set to ${this.getLimit()} MB`);
    }
    this._viewportMetrics = {
      cols: this._terminal.cols,
      rows: this._terminal.rows
    };
  }

  public dispose(): void {
    this.reset();
  }

  public reset(): void {
    for (const spec of this._images.values()) {
      spec.marker?.dispose();
    }
    // NOTE: marker.dispose above already calls ImageBitmap.close
    // therefore we can just wipe the map here
    this._images.clear();
    this._renderer.clearAll();
  }

  public getLimit(): number {
    return this._pixelLimit * 4 / 1000000;
  }

  public setLimit(value: number): void {
    if (value < 0.5 || value > 1000) {
      throw RangeError('invalid storageLimit, should be at least 0.5 MB and not exceed 1G');
    }
    this._pixelLimit = (value / 4 * 1000000) >>> 0;
    this._evictOldest(0);
  }

  public getUsage(): number {
    return this._getStoredPixels() * 4 / 1000000;
  }

  private _getStoredPixels(): number {
    let storedPixels = 0;
    for (const spec of this._images.values()) {
      if (spec.orig) {
        storedPixels += spec.orig.width * spec.orig.height;
        if (spec.actual && spec.actual !== spec.orig) {
          storedPixels += spec.actual.width * spec.actual.height;
        }
      }
    }
    return storedPixels;
  }

  private _delImg(id: number): void {
    const spec = this._images.get(id);
    this._images.delete(id);
    // FIXME: really ugly workaround to get bitmaps deallocated :(
    if (spec && window.ImageBitmap && spec.orig instanceof ImageBitmap) {
      spec.orig.close();
    }
  }

  /**
   * Wipe canvas and images on alternate buffer.
   */
  public wipeAlternate(): void {
    // remove all alternate tagged images
    const zero = [];
    for (const [id, spec] of this._images.entries()) {
      if (spec.bufferType === 'alternate') {
        spec.marker?.dispose();
        zero.push(id);
      }
    }
    for (const id of zero) {
      this._delImg(id);
    }
    // mark canvas to be wiped on next render
    this._needsFullClear = true;
    this._fullyCleared = false;
  }

  /**
   * Only advance text cursor.
   * This is an edge case from empty sixels carrying only a height but no pixels.
   * Partially fixes https://github.com/jerch/xterm-addon-image/issues/37.
   */
  public advanceCursor(height: number): void {
    if (this._opts.sixelScrolling) {
      let cellSize = this._renderer.cellSize;
      if (cellSize.width === -1 || cellSize.height === -1) {
        cellSize = CELL_SIZE_DEFAULT;
      }
      const rows = Math.ceil(height / cellSize.height);
      for (let i = 1; i < rows; ++i) {
        this._terminal._core._inputHandler.lineFeed();
      }
    }
  }

  /**
   * Method to add an image to the storage.
   */
  public addImage(img: HTMLCanvasElement | ImageBitmap): void {
    // never allow storage to exceed memory limit
    this._evictOldest(img.width * img.height);

    // calc rows x cols needed to display the image
    let cellSize = this._renderer.cellSize;
    if (cellSize.width === -1 || cellSize.height === -1) {
      cellSize = CELL_SIZE_DEFAULT;
    }
    const cols = Math.ceil(img.width / cellSize.width);
    const rows = Math.ceil(img.height / cellSize.height);

    const imageId = ++this._lastId;

    const buffer = this._terminal._core.buffer;
    const termCols = this._terminal.cols;
    const termRows = this._terminal.rows;
    const originX = buffer.x;
    const originY = buffer.y;
    let offset = originX;
    let tileCount = 0;

    if (!this._opts.sixelScrolling) {
      buffer.x = 0;
      buffer.y = 0;
      offset = 0;
    }

    this._terminal._core._inputHandler._dirtyRowTracker.markDirty(buffer.y);
    for (let row = 0; row < rows; ++row) {
      const line = buffer.lines.get(buffer.y + buffer.ybase);
      for (let col = 0; col < cols; ++col) {
        if (offset + col >= termCols) break;
        this._writeToCell(line as IBufferLineExt, offset + col, imageId, row * cols + col);
        tileCount++;
      }
      if (this._opts.sixelScrolling) {
        if (row < rows - 1) this._terminal._core._inputHandler.lineFeed();
      } else {
        if (++buffer.y >= termRows) break;
      }
      buffer.x = offset;
    }
    this._terminal._core._inputHandler._dirtyRowTracker.markDirty(buffer.y);

    // cursor positioning modes
    if (this._opts.sixelScrolling) {
      buffer.x = offset;
    } else {
      buffer.x = originX;
      buffer.y = originY;
    }

    // deleted images with zero tile count
    const zero = [];
    for (const [id, spec] of this._images.entries()) {
      if (spec.tileCount < 1) {
        spec.marker?.dispose();
        zero.push(id);
      }
    }
    for (const id of zero) {
      this._delImg(id);
    }

    // eviction marker:
    // delete the image when the marker gets disposed
    const endMarker = this._terminal.registerMarker(0);
    endMarker?.onDispose(() => {
      const spec = this._images.get(imageId);
      if (spec) {
        this._delImg(imageId);
      }
    });

    // since markers do not work on alternate for some reason,
    // we evict images here manually
    if (this._terminal.buffer.active.type === 'alternate') {
      this._evictOnAlternate();
    }

    // create storage entry
    const imgSpec: IImageSpec = {
      orig: img,
      origCellSize: cellSize,
      actual: img,
      actualCellSize: { ...cellSize },  // clone needed, since later modified
      marker: endMarker || undefined,
      tileCount,
      bufferType: this._terminal.buffer.active.type
    };

    // finally add the image
    this._images.set(imageId, imgSpec);
  }


  /**
   * Render method. Collects buffer information and triggers
   * canvas updates.
   */
  // TODO: Should we move this to the ImageRenderer?
  public render(range: { start: number, end: number }): void {
    // setup image canvas in case we have none yet, but have images in store
    if (!this._renderer.canvas && this._images.size) {
      this._renderer.insertLayerToDom();
      // safety measure - in case we cannot spawn a canvas at all, just exit
      if (!this._renderer.canvas) {
        return;
      }
    }
    // rescale if needed
    this._renderer.rescaleCanvas();
    // exit early if we dont have any images to test for
    if (!this._images.size) {
      if (!this._fullyCleared) {
        this._renderer.clearAll();
        this._fullyCleared = true;
        this._needsFullClear = false;
      }
      if (this._renderer.canvas) {
        this._renderer.removeLayerFromDom();
      }
      return;
    }

    // buffer switches force a full clear
    if (this._needsFullClear) {
      this._renderer.clearAll();
      this._fullyCleared = true;
      this._needsFullClear = false;
    }

    const { start, end } = range;
    const buffer = this._terminal._core.buffer;
    const cols = this._terminal._core.cols;

    // clear drawing area
    this._renderer.clearLines(start, end);

    // walk all cells in viewport and draw tiles found
    for (let row = start; row <= end; ++row) {
      const line = buffer.lines.get(row + buffer.ydisp) as IBufferLineExt;
      if (!line) return;
      for (let col = 0; col < cols; ++col) {
        if (line.getBg(col) & BgFlags.HAS_EXTENDED) {
          let e: IExtendedAttrsImage = line._extendedAttrs[col] || EMPTY_ATTRS;
          const imageId = e.imageId;
          if (imageId === undefined || imageId === -1) {
            continue;
          }
          const imgSpec = this._images.get(imageId);
          if (e.tileId !== -1) {
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
              && (line.getBg(col) & BgFlags.HAS_EXTENDED)
              && (e = line._extendedAttrs[col] || EMPTY_ATTRS)
              && (e.imageId === imageId)
              && (e.tileId === startTile + count)
            ) {
              count++;
            }
            col--;
            if (imgSpec) {
              if (imgSpec.actual) {
                this._renderer.draw(imgSpec, startTile, startCol, row, count);
              }
            } else if (this._opts.showPlaceholder) {
              this._renderer.drawPlaceholder(startCol, row, count);
            }
            this._fullyCleared = false;
          }
        }
      }
    }
  }

  public viewportResize(metrics: { cols: number, rows: number }): void {
    // exit early if we have nothing in storage
    if (!this._images.size) {
      this._viewportMetrics = metrics;
      return;
    }

    // handle only viewport width enlargements, exit all other cases
    // TODO: needs patch for tile counter
    if (this._viewportMetrics.cols >= metrics.cols) {
      this._viewportMetrics = metrics;
      return;
    }

    // walk scrollbuffer at old col width to find all possible expansion matches
    const buffer = this._terminal._core.buffer;
    const rows = buffer.lines.length;
    const oldCol = this._viewportMetrics.cols - 1;
    for (let row = 0; row < rows; ++row) {
      const line = buffer.lines.get(row) as IBufferLineExt;
      if (line.getBg(oldCol) & BgFlags.HAS_EXTENDED) {
        const e: IExtendedAttrsImage = line._extendedAttrs[oldCol] || EMPTY_ATTRS;
        const imageId = e.imageId;
        if (imageId === undefined || imageId === -1) {
          continue;
        }
        const imgSpec = this._images.get(imageId);
        if (!imgSpec) {
          continue;
        }
        // found an image tile at oldCol, check if it qualifies for right exapansion
        const tilesPerRow = Math.ceil((imgSpec.actual?.width || 0) / imgSpec.actualCellSize.width);
        if ((e.tileId % tilesPerRow) + 1 >= tilesPerRow) {
          continue;
        }
        // expand only if right side is empty (nothing got wrapped from below)
        let hasData = false;
        for (let rightCol = oldCol + 1; rightCol > metrics.cols; ++rightCol) {
          if (line._data[rightCol * Cell.SIZE + Cell.CONTENT] & Content.HAS_CONTENT_MASK) {
            hasData = true;
            break;
          }
        }
        if (hasData) {
          continue;
        }
        // do right expansion on terminal buffer
        const end = Math.min(metrics.cols, tilesPerRow - (e.tileId % tilesPerRow) + oldCol);
        let lastTile = e.tileId;
        for (let expandCol = oldCol + 1; expandCol < end; ++expandCol) {
          this._writeToCell(line as IBufferLineExt, expandCol, imageId, ++lastTile);
          imgSpec.tileCount++;
        }
      }
    }
    // store new viewport metrics
    this._viewportMetrics = metrics;
  }

  /**
   * Retrieve original canvas at buffer position.
   */
  public getImageAtBufferCell(x: number, y: number): HTMLCanvasElement | undefined {
    const buffer = this._terminal._core.buffer;
    const line = buffer.lines.get(y) as IBufferLineExt;
    if (line && line.getBg(x) & BgFlags.HAS_EXTENDED) {
      const e: IExtendedAttrsImage = line._extendedAttrs[x] || EMPTY_ATTRS;
      if (e.imageId && e.imageId !== -1) {
        const orig = this._images.get(e.imageId)?.orig;
        if (window.ImageBitmap && orig instanceof ImageBitmap) {
          const canvas = ImageRenderer.createCanvas(window.document, orig.width, orig.height);
          canvas.getContext('2d')?.drawImage(orig, 0, 0, orig.width, orig.height);
          return canvas;
        }
        return orig as HTMLCanvasElement;
      }
    }
  }

  /**
   * Extract active single tile at buffer position.
   */
  public extractTileAtBufferCell(x: number, y: number): HTMLCanvasElement | undefined {
    const buffer = this._terminal._core.buffer;
    const line = buffer.lines.get(y) as IBufferLineExt;
    if (line && line.getBg(x) & BgFlags.HAS_EXTENDED) {
      const e: IExtendedAttrsImage = line._extendedAttrs[x] || EMPTY_ATTRS;
      if (e.imageId && e.imageId !== -1 && e.tileId !== -1) {
        const spec = this._images.get(e.imageId);
        if (spec) {
          return this._renderer.extractTile(spec, e.tileId);
        }
      }
    }
  }

  // TODO: Do we need some blob offloading tricks here to avoid early eviction?
  // also see https://stackoverflow.com/questions/28307789/is-there-any-limitation-on-javascript-max-blob-size
  private _evictOldest(room: number): number {
    const used = this._getStoredPixels();
    let current = used;
    while (this._pixelLimit < current + room && this._images.size) {
      const spec = this._images.get(++this._lowestId);
      if (spec && spec.orig) {
        current -= spec.orig.width * spec.orig.height;
        if (spec.actual && spec.orig !== spec.actual) {
          current -= spec.actual.width * spec.actual.height;
        }
        spec.marker?.dispose();
        this._delImg(this._lowestId);
      }
    }
    return used - current;
  }

  private _writeToCell(line: IBufferLineExt, x: number, imageId: number, tileId: number): void {
    if (line._data[x * Cell.SIZE + Cell.BG] & BgFlags.HAS_EXTENDED) {
      const old = line._extendedAttrs[x];
      if (old) {
        if (old.imageId !== undefined) {
          // found an old ExtendedAttrsImage, since we know that
          // they are always isolated instances (single cell usage),
          // we can re-use it and just update their id entries
          const oldSpec = this._images.get(old.imageId);
          if (oldSpec) {
            // early eviction for in-viewport overwrites
            oldSpec.tileCount--;
          }
          old.imageId = imageId;
          old.tileId = tileId;
          return;
        }
        // found a plain ExtendedAttrs instance, clone it to new entry
        line._extendedAttrs[x] = new ExtendedAttrsImage(old.ext, old.urlId, imageId, tileId);
        return;
      }
    }
    // fall-through: always create new ExtendedAttrsImage entry
    line._data[x * Cell.SIZE + Cell.BG] |= BgFlags.HAS_EXTENDED;
    line._extendedAttrs[x] = new ExtendedAttrsImage(0, 0, imageId, tileId);
  }

  private _evictOnAlternate(): void {
    // nullify tile count of all images on alternate buffer
    for (const spec of this._images.values()) {
      if (spec.bufferType === 'alternate') {
        spec.tileCount = 0;
      }
    }
    // re-count tiles on whole buffer
    const buffer = this._terminal._core.buffer;
    for (let y = 0; y < this._terminal.rows; ++y) {
      const line = buffer.lines.get(y) as IBufferLineExt;
      if (!line) {
        continue;
      }
      for (let x = 0; x < this._terminal.cols; ++x) {
        if (line._data[x * Cell.SIZE + Cell.BG] & BgFlags.HAS_EXTENDED) {
          const imgId = line._extendedAttrs[x]?.imageId;
          if (imgId) {
            const spec = this._images.get(imgId);
            if (spec) {
              spec.tileCount++;
            }
          }
        }
      }
    }
    // deleted images with zero tile count
    const zero = [];
    for (const [id, spec] of this._images.entries()) {
      if (spec.bufferType === 'alternate' && !spec.tileCount) {
        spec.marker?.dispose();
        zero.push(id);
      }
    }
    for (const id of zero) {
      this._delImg(id);
    }
  }
}
