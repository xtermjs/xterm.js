/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { Terminal, IDisposable } from 'xterm';
import { SixelDecoder } from 'sixel';


// buffer placeholder
// FIXME: find better method to announce foreign content
const CODE = 0x110000; // illegal unicode char
const INVISIBLE = 0x40000000; // taken from BufferLine.ts


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


export class ImageStorage implements IDisposable {
  private _images: Map<number, IImageSpec> = new Map();
  private _lastId = 0;

  constructor(private _terminal: Terminal, private _ir: ImageRenderer) {}

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
    const canvas = this._ir.getCanvas(Math.ceil(is.orig.width * cw / ow), Math.ceil(is.orig.height * ch / oh));
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

    // TODO: mark every line + remark on resize to get better disposal coverage
    const endMarker = this._terminal.registerMarker(0);
    endMarker?.onDispose(() => this._markerGotDisposed(this._lastId));
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
    const canvas = this._ir.getCanvas(sixel.width, sixel.height);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const imageData = new ImageData(sixel.width, sixel.height);

      // whether current BG should be applied to sixel image
      // const applyBG = !!sixel.fillColor;  // TODO
      sixel.toPixelData(imageData.data, sixel.width, sixel.height);

      ctx.putImageData(imageData, 0, 0);
      this.addImage(canvas);
    }
  }

  // TODO: resort render stuff to image renderer
  public render(e: {start: number, end: number}): void {
    const {start, end} = e;
    const internalTerm = (this._terminal as any)._core;
    const buffer = internalTerm.buffer;
    const ctx = this._ir.ctx;
    if (!ctx) return;

    // clear drawing area
    this._clear(ctx, start, end, internalTerm._renderService.dimensions);

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
            this._draw(ctx, id, bufferRow.getBg(col) & 0xFFFFFF, col, row, count);
            col = cCol - 1;
          }
        }
      }
    }
  }

  private _clear(ctx: CanvasRenderingContext2D, start: number, end: number, dimensions: any): void {
    const top = start * dimensions.actualCellHeight;
    const bottom = ++end * dimensions.actualCellHeight;
    ctx.clearRect(0, top, dimensions.canvasWidth, bottom);
  }

  // FIXME: needs some layered drawing/composition
  //        reason - partially overdrawing of older tiles should be possible
  private _draw(ctx: CanvasRenderingContext2D, imgId: number, tileId: number, col: number, row: number, count: number = 1): void {
    const is = this._images.get(imgId);
    if (!is) {
      // FIXME: draw placeholder if image got removed?
      return;
    }
    this._rescale(imgId);
    const img = is.bitmap || is.actual;

    const {width: cellWidth, height: cellHeight} = this._cellSize;
    const cols = Math.ceil(img.width / cellWidth);

    ctx.drawImage(
      img,
      (tileId % cols) * cellWidth,
      Math.floor(tileId / cols) * cellHeight,
      cellWidth * count,
      cellHeight,
      col * cellWidth,
      row * cellHeight,
      cellWidth * count,
      cellHeight
    );
  }
}


/**
 * image renderer
 * Holds all output related data structures.
 * Defaults to browser output for now.
 */
export class ImageRenderer implements IDisposable {
  private _internalTerm: any;
  private _oldOpen: (parent: HTMLElement) => void;
  private _rs: any;
  private _oldSetRenderer: (renderer: any) => void = () => {};
  private _csms: any;
  public canvas: HTMLCanvasElement | undefined;
  public ctx: CanvasRenderingContext2D | null | undefined;
  private _dimHandler: IDisposable | undefined;
  private _charSizeHandler: IDisposable | undefined;

  constructor(terminal: Terminal) {
    this._internalTerm = (terminal as any)._core;
    this._oldOpen = this._internalTerm.open;
    this._internalTerm.open = (parent: HTMLElement): void => {
      this._oldOpen.call(this._internalTerm, parent);
      this.open();
    };
    if (this._internalTerm.screenElement) {
      this.open();
    }
  }

  public dispose(): void {
    this.removeLayerFromDom();
    if (this._internalTerm && this._oldOpen) {
      this._internalTerm.open = this._oldOpen;
    }
    if (this._rs && this._oldSetRenderer) {
      this._rs.setRenderer = this._oldSetRenderer;
    }
    this._internalTerm = undefined;
    this._rs = undefined;
    this._csms = undefined;
    this._dimHandler?.dispose();
    this._charSizeHandler?.dispose();
  }

  public open(): void {
    this._rs = this._internalTerm._renderService;
    this._oldSetRenderer = this._rs.setRenderer.bind(this._rs);
    this._rs.setRenderer = (renderer: any) => {
      this.removeLayerFromDom();
      this._oldSetRenderer(renderer);
      this.insertLayerToDom();
    };
    this._csms = this._internalTerm._charSizeService;
    this._dimHandler = this._rs.onDimensionsChange((data: any) => this.dimensionChanged(data));
    this._charSizeHandler = this._csms.onCharSizeChange(() => this.dimensionChanged(this._rs.dimensions));
    this.insertLayerToDom();
  }

  public removeLayerFromDom(): void {
    this.canvas?.parentNode?.removeChild(this.canvas);
  }

  public insertLayerToDom(): void {
    this.canvas = this.getCanvas(this._rs?.dimensions.canvasWidth, this._rs?.dimensions.canvasHeight);
    this.canvas.classList.add('xterm-image-layer');
    this._internalTerm.screenElement.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d', {alpha: true, desynchronized: true});
  }

  public dimensionChanged(dimensions: any): void {
    // FIXME: why do we have to wait for next event loop tick? (creates a really nasty blackout bug)
    // get current dimensions from draw call instead?
    setTimeout(() => {
      console.log(dimensions);
      this.canvas?.setAttribute('width', `${dimensions.canvasWidth}`);
      this.canvas?.setAttribute('height', `${dimensions.canvasHeight}`);
    }, 0);
  }

  public getCanvas(width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width | 0;
    canvas.height = height | 0;
    return canvas;
  }
}
