/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { Terminal, IDisposable, IMarker } from 'xterm';
import { SixelDecoder } from 'sixel';


// buffer placeholder
// FIXME: find better method to announce foreign content
const CODE = 0x110000; // illegal unicode char
const INVISIBLE = 0x40000000; // taken from BufferLine.ts


// TODO: This is temporary, link to xterm when the new version is published
// export interface ITerminalAddon {
//   activate(terminal: Terminal): void;
//   dispose(): void;
// }

interface IDcsHandler {
  hook(collect: string, params: number[], flag: number): void;
  put(data: Uint32Array, start: number, end: number): void;
  unhook(): void;
}

interface ICellSize {
  width: number;
  height: number;
}

interface IImageSpec {
  orig: HTMLCanvasElement;
  origCellSize: ICellSize;
  actual: HTMLCanvasElement;
  actualCellSize: ICellSize;
  bitmap: ImageBitmap | null;
}

interface IMarkerAutoDispose extends IMarker {
  onDispose(handler: () => void): void;
}

type UintTypedArray = Uint8Array | Uint16Array | Uint32Array | Uint8ClampedArray;

export class ImageStorage implements IDisposable {
  private _images: Map<number, IImageSpec> = new Map();
  private _lastId = 0;

  constructor(private _terminal: Terminal) {}

  public dispose(): void {
    this._images.clear();
  }

  private get _cellSize(): ICellSize {
    const internalTerm = (this._terminal as any)._core;
    return {
      width: internalTerm._renderService.dimensions.actualCellWidth,
      height: internalTerm._renderService.dimensions.actualCellHeight
    };
  }

  private _rescale(imgId: number): void {
    const {width: cw, height: ch} = this._cellSize;
    const is = this._images.get(imgId);
    if (!is) {
      return;
    }
    const {width: aw, height: ah} = is.actualCellSize;
    if (cw === aw && ch === ah) {
      return;
    }
    const {width: ow, height: oh} = is.origCellSize;
    if (cw === ow && ch === oh) {
      is.actual = is.orig;
      is.actualCellSize.width = ow;
      is.actualCellSize.height = oh;
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(is.orig.width * cw / ow);
    canvas.height = Math.ceil(is.orig.height * ch / oh);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(is.orig, 0, 0, canvas.width, canvas.height);
      is.actual = canvas;
      is.actualCellSize.width = cw;
      is.actualCellSize.height = ch;
      is?.bitmap?.close();
      is.bitmap = null;
      createImageBitmap(canvas).then((bitmap) => is.bitmap = bitmap);
    }
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
    const cols = Math.ceil(img.width / this._cellSize.width);
    const rows = Math.ceil(img.height / this._cellSize.height);

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

    const endMarker = this._terminal.registerMarker(0);
    (endMarker as IMarkerAutoDispose).onDispose(() => this._markerGotDisposed(this._lastId));
    const imgSpec: IImageSpec = {
      orig: img,
      origCellSize: this._cellSize,
      actual: img,
      actualCellSize: this._cellSize,
      bitmap: null
    };
    this._images.set(this._lastId++, imgSpec);
    createImageBitmap(img).then((bitmap) => imgSpec.bitmap = bitmap);
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

  /**
   * Translates a SixelImage into a canvas and calls `addImage`.
   * @param sixel SixelImage
   */
  public addImageFromSixel(sixel: SixelDecoder): void {
    const canvas = document.createElement('canvas');
    canvas.width = sixel.width;
    canvas.height = sixel.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const imageData = new ImageData(sixel.width, sixel.height);

      // whether current BG should be applied to sixel image
      const applyBG = !!sixel.fillColor;  // TODO
      sixel.toPixelData(imageData.data, sixel.width, sixel.height);

      ctx.putImageData(imageData, 0, 0);
      this.addImage(canvas);
    }
  }

  public render(e: {start: number, end: number}): void {
    const {start, end} = e;
    const internalTerm = (this._terminal as any)._core;
    const buffer = internalTerm.buffer;

    // walk all cells in viewport and draw tile if needed
    for (let row = start; row <= end; ++row) {
      const bufferRow = buffer.lines.get(row + buffer.ydisp);
      for (let col = 0; col < internalTerm.cols; ++col) {
        if (bufferRow.getCodePoint(col) === CODE) {
          const fg = bufferRow.getFg(col);
          if (fg & INVISIBLE) {
            this._draw(fg & 0xFFFFFF, bufferRow.getBg(col) & 0xFFFFFF, col, row);
          }
        }
      }
    }
  }

  // FIXME: needs some layered drawing/composition
  //        reason - partially overdrawing of older tiles should be possible
  private _draw(imgId: number, tileId: number, col: number, row: number): void {
    const is = this._images.get(imgId);
    if (!is) {
      // FIXME: draw placeholder if image got removed?
      return;
    }
    this._rescale(imgId);
    const img = is.bitmap || is.actual;

    // shamelessly draw on foreign canvas for now
    // FIXME: needs own layer term._core._renderService._renderer._renderLayers
    const ctx: CanvasRenderingContext2D = (this._terminal as any)._core._renderService._renderer._renderLayers[0]._ctx;

    const {width: cellWidth, height: cellHeight} = this._cellSize;
    const cols = Math.ceil(img.width / cellWidth);

    ctx.drawImage(
      img,
      (tileId % cols) * cellWidth,
      Math.floor(tileId / cols) * cellHeight,
      cellWidth,
      cellHeight,
      col * cellWidth,
      row * cellHeight,
      cellWidth,
      cellHeight
    );
  }
}
