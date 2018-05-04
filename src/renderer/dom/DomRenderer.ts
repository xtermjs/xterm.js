/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IRenderer, IRenderDimensions, IColorSet, FLAGS } from '../Types';
import { ITerminal } from '../../Types';
import { ITheme } from 'xterm';
import { EventEmitter } from '../../EventEmitter';
import { ColorManager } from '../ColorManager';
import { INVERTED_DEFAULT_COLOR } from '../atlas/Types';
import { CHAR_DATA_CHAR_INDEX, CHAR_DATA_ATTR_INDEX, CHAR_DATA_WIDTH_INDEX } from '../../Buffer';
import { RenderDebouncer } from '../../utils/RenderDebouncer';

const ROW_CONTAINER_CLASS = 'xterm-rows';
const BOLD_CLASS = 'xterm-bold';
const CURSOR_CLASS = 'xterm-cursor';
const FG_CLASS_PREFIX = 'xterm-fg-';
const BG_CLASS_PREFIX = 'xterm-bg-';
const FOCUS_CLASS = 'xterm-focus';
const SELECTION_CLASS = 'xterm-selection';

// TODO: Use aria-hidden to prevent screen reader from seeing the rendered elements
// TODO: Document that links aren't supported in the DOM renderer
// TODO: Pull into an addon?
export class DomRenderer extends EventEmitter implements IRenderer {
  private _renderDebouncer: RenderDebouncer;

  private _styleElement: HTMLStyleElement;
  private _rowContainer: HTMLElement;
  private _rowElements: HTMLElement[] = [];
  private _selectionContainer: HTMLElement;

  public dimensions: IRenderDimensions;
  public colorManager: ColorManager;

  // TODO: Theme/ColorManager might be better owned by Terminal not IRenderer to reduce duplication?
  constructor(private _terminal: ITerminal, theme: ITheme | undefined) {
    super();
    const allowTransparency = this._terminal.options.allowTransparency;
    this.colorManager = new ColorManager(document, allowTransparency);
    this.setTheme(theme);

    this._rowContainer = document.createElement('div');
    this._rowContainer.classList.add(ROW_CONTAINER_CLASS);
    this._refreshRowElements(this._terminal.rows, this._terminal.cols);
    this._selectionContainer = document.createElement('div');
    this._selectionContainer.classList.add(SELECTION_CLASS);

    // TODO: Should IRendererDimensions lose canvas-related concepts?
    this.dimensions = {
      scaledCharWidth: null,
      scaledCharHeight: null,
      scaledCellWidth: null,
      scaledCellHeight: null,
      scaledCharLeft: null,
      scaledCharTop: null,
      scaledCanvasWidth: null,
      scaledCanvasHeight: null,
      canvasWidth: null,
      canvasHeight: null,
      actualCellWidth: null,
      actualCellHeight: null
    };
    this._updateDimensions();

    this._renderDebouncer = new RenderDebouncer(this._terminal, this._renderRows.bind(this));

    this._terminal.screenElement.appendChild(this._rowContainer);
    this._terminal.screenElement.appendChild(this._selectionContainer);
  }

  private _updateDimensions(): void {
    this.dimensions.scaledCharWidth = this._terminal.charMeasure.width * window.devicePixelRatio;
    this.dimensions.scaledCharHeight = this._terminal.charMeasure.height * window.devicePixelRatio;
    this.dimensions.scaledCellWidth = this._terminal.charMeasure.width * window.devicePixelRatio;
    this.dimensions.scaledCellHeight = this._terminal.charMeasure.height * window.devicePixelRatio;
    // TODO: Support line height and letter spacing
    this.dimensions.scaledCharLeft = 0;
    this.dimensions.scaledCharTop = 0;
    this.dimensions.scaledCanvasWidth = this.dimensions.scaledCellWidth * this._terminal.cols;
    this.dimensions.scaledCanvasHeight = this.dimensions.scaledCellHeight * this._terminal.rows;
    this.dimensions.canvasWidth = this._terminal.charMeasure.width * this._terminal.cols;
    this.dimensions.canvasHeight = this._terminal.charMeasure.height * this._terminal.rows;
    this.dimensions.actualCellWidth = this._terminal.charMeasure.width;
    this.dimensions.actualCellHeight = this._terminal.charMeasure.height;

    this._rowElements.forEach(element => {
      element.style.width = `${this.dimensions.canvasWidth}px`;
      element.style.height = `${this._terminal.charMeasure.height}px`;
    });

    this._selectionContainer.style.height = (<any>this._terminal)._viewportElement.style.height;
  }

  public setTheme(theme: ITheme | undefined): IColorSet {
    if (theme) {
      this.colorManager.setTheme(theme);
    }

    // TODO: CSS selectors would need to use some ID otherwise it will affect other terminals
    this._styleElement = document.createElement('style');
    let styles =
        `.xterm .${ROW_CONTAINER_CLASS} {` +
        ` color: ${this.colorManager.colors.foreground.css};` +
        ` background-color: ${this.colorManager.colors.background.css};` +
        `}` +
        `.xterm .${ROW_CONTAINER_CLASS} span {` +
        ` display: inline-block;` +
        ` height: 100%;` +
        ` vertical-align: top;` +
        `}` +
        `.xterm span:not(.${BOLD_CLASS}) {` +
        ` font-weight: ${this._terminal.options.fontWeight};` +
        `}` +
        `.xterm span.${BOLD_CLASS} {` +
        ` font-weight: ${this._terminal.options.fontWeightBold};` +
        `}` +
        `.xterm .${ROW_CONTAINER_CLASS}.${FOCUS_CLASS} .${CURSOR_CLASS} {` +
        ` background-color: #fff;` +
        ` color: #000;` +
        `}` +
        `.xterm .${ROW_CONTAINER_CLASS}:not(.${FOCUS_CLASS}) .${CURSOR_CLASS} {` +
        ` outline: 1px solid #fff;` +
        ` outline-offset: -1px;` +
        `}`;
    // TODO: Copy canvas renderer behavior for cursor
    this.colorManager.colors.ansi.forEach((c, i) => {
      styles +=
          `.xterm .${FG_CLASS_PREFIX}${i} { color: ${c.css}; }` +
          `.xterm .${BG_CLASS_PREFIX}${i} { background-color: ${c.css}; }`;
    });
    // Selection
    styles +=
        `.terminal .${SELECTION_CLASS} {` +
        ` position: absolute;` +
        ` top: 0;` +
        ` left: 0;` +
        ` z-index: 1;` +
        ` pointer-events: none;` +
        `}` +
        `.terminal .${SELECTION_CLASS} div {` +
        ` position: absolute;` +
        ` background-color: ${this.colorManager.colors.selection.css};` +
        `}`;
    this._styleElement.innerHTML = styles;
    this._terminal.screenElement.appendChild(this._styleElement);
    return this.colorManager.colors;
  }

  public onWindowResize(devicePixelRatio: number): void {
    this._updateDimensions();
  }

  private _refreshRowElements(cols: number, rows: number): void {
    // Add missing elements
    for (let i = this._rowElements.length; i <= rows; i++) {
      const row = document.createElement('div');
      this._rowContainer.appendChild(row);
      this._rowElements.push(row);
    }
    // Remove excess elements
    while (this._rowElements.length > rows) {
      this._rowContainer.removeChild(this._rowElements.pop());
    }
  }

  public onResize(cols: number, rows: number): void {
    this._refreshRowElements(cols, rows);
  }

  public onCharSizeChanged(): void {
    this._updateDimensions();
  }

  public onBlur(): void {
    this._rowContainer.classList.remove(FOCUS_CLASS);
  }

  public onFocus(): void {
    this._rowContainer.classList.add(FOCUS_CLASS);
  }

  public onSelectionChanged(start: [number, number], end: [number, number]): void {
    // Remove all selections
    while (this._selectionContainer.children.length) {
      this._selectionContainer.removeChild(this._selectionContainer.children[0]);
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
    this._selectionContainer.appendChild(documentFragment);
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

  public onCursorMove(): void {
    // No-op, the cursor is drawn when rows are drawn
  }

  public onOptionsChanged(): void {
    // Force a refresh
    this._updateDimensions();
    this.setTheme(undefined);
    this._terminal.refresh(0, this._terminal.rows - 1);
  }

  public clear(): void {
    this._rowElements.forEach(e => e.innerHTML = '');
  }

  public refreshRows(start: number, end: number): void {
    this._renderDebouncer.refresh(start, end);
  }

  private _renderRows(start: number, end: number): void {
    const terminal = this._terminal;

    const cursorAbsoluteY = terminal.buffer.ybase + terminal.buffer.y;

    for (let y = start; y <= end; y++) {
      const rowElement = this._rowElements[y];
      rowElement.innerHTML = '';

      const row = y + terminal.buffer.ydisp;
      const line = terminal.buffer.lines.get(row);
      for (let x = 0; x < terminal.cols; x++) {
        const charData = line[x];
        // const code: number = <number>charData[CHAR_DATA_CODE_INDEX];
        const char: string = charData[CHAR_DATA_CHAR_INDEX];
        const attr: number = charData[CHAR_DATA_ATTR_INDEX];
        let width: number = charData[CHAR_DATA_WIDTH_INDEX];

        // The character to the left is a wide character, drawing is owned by
        // the char at x-1
        if (width === 0) {
          continue;
        }

        const charElement = document.createElement('span');
        // TODO: Move standard width to <style>?
        charElement.style.width = `${terminal.charMeasure.width * width}px`;

        const flags = attr >> 18;
        let bg = attr & 0x1ff;
        let fg = (attr >> 9) & 0x1ff;

        if (row === cursorAbsoluteY && x === this._terminal.buffer.x) {
          charElement.classList.add(CURSOR_CLASS);
        }

        // If inverse flag is on, the foreground should become the background.
        if (flags & FLAGS.INVERSE) {
          const temp = bg;
          bg = fg;
          fg = temp;
          if (fg === 256) {
            // TODO: INVERTED_DEFAULT_COLOR should not be in atlas
            fg = INVERTED_DEFAULT_COLOR;
          }
          if (bg === 257) {
            bg = INVERTED_DEFAULT_COLOR;
          }
        }

        if (flags & FLAGS.BOLD) {
          // TODO: Support option that turns bold->bright off
          // Convert the FG color to the bold variant
          if (fg < 8) {
            fg += 8;
          }
          charElement.classList.add(BOLD_CLASS);
        }

        // TODO: Handle italics

        if (flags & FLAGS.BOLD) {
          // Convert the FG color to the bold variant
          if (fg < 8) {
            fg += 8;
          }
          charElement.classList.add(BOLD_CLASS);
        }

        charElement.textContent = char;
        // TODO: Make 257 a constant
        if (fg !== 257) {
          charElement.classList.add(`xterm-fg-${fg}`);
        }
        // TODO: Make 256 a constant
        if (bg !== 256) {
          charElement.classList.add(`xterm-bg-${bg}`);
        }
        rowElement.appendChild(charElement);
      }
    }

    // TODO: Document that IRenderer needs to emit this?
    this._terminal.emit('refresh', {start, end});
  }
}
