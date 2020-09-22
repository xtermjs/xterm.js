/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { Terminal, IDisposable, ITerminalAddon } from 'xterm';
import { SixelDecoder } from 'sixel';


// buffer placeholder
// FIXME: find better method to announce foreign content
const CODE = 0x110000; // illegal unicode char
const INVISIBLE = 0x40000000; // taken from BufferLine.ts


// TODO: This is temporary, link to xterm when the new version is published
//export interface ITerminalAddon {
//  activate(terminal: Terminal): void;
//  dispose(): void;
//}

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
  urlCache: {[key: number]: string};
}

type UintTypedArray = Uint8Array | Uint16Array | Uint32Array | Uint8ClampedArray;


export class ImageStorage implements IDisposable {
  private _images: IImageSpec[] = [];

  constructor(private _terminal: Terminal) {}

  public dispose(): void {
    // FIXME: free stuff here...
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
    const {width: aw, height: ah} = this._images[imgId].actualCellSize;
    if (cw === aw && ch === ah) {
      return;
    }
    const {width: ow, height: oh} = this._images[imgId].origCellSize;
    if (cw === ow && ch === oh) {
      this._images[imgId].actual = this._images[imgId].orig;
      this._images[imgId].actualCellSize.width = ow;
      this._images[imgId].actualCellSize.height = oh;
      this._images[imgId].urlCache = {};
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(this._images[imgId].orig.width * cw / ow);
    canvas.height = Math.ceil(this._images[imgId].orig.height * ch / oh);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(this._images[imgId].orig, 0, 0, canvas.width, canvas.height);
      this._images[imgId].actual = canvas;
      this._images[imgId].actualCellSize.width = cw;
      this._images[imgId].actualCellSize.height = ch;
      this._images[imgId].urlCache = {};
    }
  }

  /**
   * Method to add an image to the storage.
   * Does all the needed low level stuff to tile the image data correctly
   * onto the terminal buffer cells.
   */
  public addImage(img: HTMLCanvasElement): number {
    /**
     * TODO - create markers:
     *    start marker  - first line containing image data
     *    end marker    - line below last line containing image data
     *
     * use markers:
     *  - speedup rendering
     *    instead of searching cell by cell through all viewport cells,
     *    search for image start-end marker intersections with viewport lines
     *  - lifecycling of images
     *    delete image as soon as end marker got disposed
     */

    // calc rows x cols needed to display the image
    const cols = Math.ceil(img.width / this._cellSize.width);
    const rows = Math.ceil(img.height / this._cellSize.height);

    const position = this._images.length;
    this._images.push({
      orig: img,
      origCellSize: this._cellSize,
      actual: img,
      actualCellSize: this._cellSize,
      urlCache: {}
    });

    // write placeholder into terminal buffer
    const imgIdx = this._images.length - 1;
    const fg = INVISIBLE | imgIdx;

    const internalTerm = (this._terminal as any)._core;
    const buffer = internalTerm.buffer;
    const offset = internalTerm.buffer.x;

    /*
    for (let row = 0; row < rows; ++row) {
      const bufferRow = buffer.lines.get(buffer.y + buffer.ybase);
      for (let col = 0; col < cols; ++col) {
        if (offset + col >= internalTerm.cols) {
          break;
        }
        const tileNum = row * cols + col;
        bufferRow.setCellFromCodePoint(offset + col, CODE, 1, fg, tileNum);
      }
      if (row < rows - 1) {
        buffer.y++;
        if (buffer.y > buffer.scrollBottom) {
          buffer.y--;
          internalTerm.scroll(false);
        }
      }
    }
    if (offset + cols >= internalTerm.cols) {
      buffer.y++;
      if (buffer.y > buffer.scrollBottom) {
        buffer.y--;
        internalTerm.scroll(false);
      }
      internalTerm.buffer.x = 0;
    } else {
      internalTerm.buffer.x = offset + cols;
    }
    */

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

    return position;
  }

  /**
   * Translates a SixelImage into a canvas and calls `addImage`.
   * @param sixel SixelImage
   */
  public addImageFromSixel(sixel: SixelDecoder): void {
    console.log('sixel size', sixel.width, sixel.height);
    const canvas = document.createElement('canvas');
    canvas.width = sixel.width;
    canvas.height = sixel.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // const imageData = ctx.getImageData(0, 0, sixel.width, sixel.height);
      const imageData = new ImageData(sixel.width, sixel.height);

      // whether current BG should be applied to sixel image
      const applyBG = !!sixel.fillColor;
      sixel.toPixelData(imageData.data, sixel.width, sixel.height);

      ctx.putImageData(imageData, 0, 0);
      this.addImage(canvas);
      const img = new Image(sixel.width, sixel.height);
      img.src = '' + imageData;
      console.log(img);
    }
  }

  public render(e: {start: number, end: number}): void {
    const {start, end} = e;
    const internalTerm = (this._terminal as any)._core;
    const buffer = internalTerm.buffer;

    const renderType = this._terminal.getOption('rendererType');
    let rows: any = null;
    let parent: any = null;
    if (renderType === 'dom') {
      rows = document.getElementsByClassName('xterm-rows')[0];
      parent = rows.parentNode;
      rows.remove();
    }

    // walk all cells in viewport and draw tile if needed
    for (let row = start; row <= end; ++row) {
      const bufferRow = buffer.lines.get(row + buffer.ydisp);
      for (let col = 0; col < internalTerm.cols; ++col) {
        if (bufferRow.getCodePoint(col) === CODE) {
          const fg = bufferRow.getFg(col);
          if (fg & INVISIBLE) {
            if (renderType === 'canvas') {
              this._drawToCanvas(fg & 0xFFFFFF, bufferRow.getBg(col) & 0xFFFFFF, col, row);
            } else if (renderType === 'dom') {
              this._drawToDom(fg & 0xFFFFFF, bufferRow.getBg(col) & 0xFFFFFF, col, row, rows);
            } else {
              throw new Error('unssuported renderer');
            }
          }
        }
      }
    }

    if (renderType === 'dom') {
      parent.append(rows);
    }
  }

  private _drawToDom(imgId: number, tileId: number, col: number, row: number, rows: any): void {
    this._rescale(imgId);
    let dataUrl = this._images[imgId].urlCache[tileId];
    if (!dataUrl) {
      const img = this._images[imgId].actual;
      const {width: cellWidth, height: cellHeight} = this._cellSize;
      const cols = Math.ceil(img.width / cellWidth);

      const canvas = document.createElement('canvas');
      canvas.width = cellWidth;
      canvas.height = cellHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return;
      }
      ctx.drawImage(
        img,
        (tileId % cols) * cellWidth,
        Math.floor(tileId / cols) * cellHeight,
        cellWidth,
        cellHeight,
        0,
        0,
        cellWidth,
        cellHeight
      );
      this._images[imgId].urlCache[tileId] = canvas.toDataURL('image/jpeg');
      dataUrl = this._images[imgId].urlCache[tileId];
    }

    const rowEl = rows.children[row];
    if (rowEl) {
      const colEl = rowEl.children[col];
      if (colEl) {
        colEl.textContent = ' ';
        colEl.style.backgroundImage = `url('${dataUrl}')`;
        colEl.style.overflow = 'hidden';
      }
    }

  }

  private _drawToCanvas(imgId: number, tileId: number, col: number, row: number): void {
    const internalTerm = (this._terminal as any)._core;

    // shamelessly draw on foreign canvas for now
    // FIXME: needs own layer term._core._renderService._renderer._renderLayers
    const ctx: CanvasRenderingContext2D = internalTerm._renderService._renderer._renderLayers[0]._ctx;

    this._rescale(imgId);
    const img = this._images[imgId].actual;
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
