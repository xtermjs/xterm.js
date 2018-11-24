/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IRenderer, IRenderDimensions, IColorSet } from '../Types';
import { ILinkHoverEvent, ITerminal, CharacterJoinerHandler, LinkHoverEventTypes } from '../../Types';
import { ITheme } from 'xterm';
import { EventEmitter } from '../../common/EventEmitter';
import { ColorManager } from '../ColorManager';
import { RenderDebouncer } from '../../ui/RenderDebouncer';
import { BOLD_CLASS, ITALIC_CLASS, CURSOR_CLASS, CURSOR_STYLE_BLOCK_CLASS, CURSOR_STYLE_BAR_CLASS, CURSOR_STYLE_UNDERLINE_CLASS, DomRendererRowFactory } from './DomRendererRowFactory';
import { INVERTED_DEFAULT_COLOR } from '../atlas/Types';

const TERMINAL_CLASS_PREFIX = 'xterm-dom-renderer-owner-';
const ROW_CONTAINER_CLASS = 'xterm-rows';
const FG_CLASS_PREFIX = 'xterm-fg-';
const BG_CLASS_PREFIX = 'xterm-bg-';
const FOCUS_CLASS = 'xterm-focus';
const SELECTION_CLASS = 'xterm-selection';

let nextTerminalId = 1;

// TODO: Pull into an addon when TS composite projects allow easier sharing of code (not just
// interfaces) between core and addons

/**
 * A fallback renderer for when canvas is slow. This is not meant to be
 * particularly fast or feature complete, more just stable and usable for when
 * canvas is not an option.
 */
export class DomRenderer extends EventEmitter implements IRenderer {
  private _renderDebouncer: RenderDebouncer;
  private _rowFactory: DomRendererRowFactory;
  private _terminalClass: number = nextTerminalId++;

  private _themeStyleElement: HTMLStyleElement;
  private _dimensionsStyleElement: HTMLStyleElement;
  private _rowContainer: HTMLElement;
  private _rowElements: HTMLElement[] = [];
  private _selectionContainer: HTMLElement;

  public dimensions: IRenderDimensions;
  public colorManager: ColorManager;

  constructor(private _terminal: ITerminal, theme: ITheme | undefined) {
    super();
    const allowTransparency = this._terminal.options.allowTransparency;
    this.colorManager = new ColorManager(document, allowTransparency);
    this.setTheme(theme);

    this._rowContainer = document.createElement('div');
    this._rowContainer.classList.add(ROW_CONTAINER_CLASS);
    this._rowContainer.style.lineHeight = 'normal';
    this._rowContainer.setAttribute('aria-hidden', 'true');
    this._refreshRowElements(this._terminal.cols, this._terminal.rows);
    this._selectionContainer = document.createElement('div');
    this._selectionContainer.classList.add(SELECTION_CLASS);
    this._selectionContainer.setAttribute('aria-hidden', 'true');

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
    this._rowFactory = new DomRendererRowFactory(document);

    this._terminal.element.classList.add(TERMINAL_CLASS_PREFIX + this._terminalClass);
    this._terminal.screenElement.appendChild(this._rowContainer);
    this._terminal.screenElement.appendChild(this._selectionContainer);

    this._terminal.linkifier.on(LinkHoverEventTypes.HOVER, (e: ILinkHoverEvent) => this._onLinkHover(e));
    this._terminal.linkifier.on(LinkHoverEventTypes.LEAVE, (e: ILinkHoverEvent) => this._onLinkLeave(e));
  }

  public dispose(): void {
    this._terminal.element.classList.remove(TERMINAL_CLASS_PREFIX + this._terminalClass);
    this._terminal.screenElement.removeChild(this._rowContainer);
    this._terminal.screenElement.removeChild(this._selectionContainer);
    this._terminal.screenElement.removeChild(this._themeStyleElement);
    this._terminal.screenElement.removeChild(this._dimensionsStyleElement);
    super.dispose();
  }

  private _updateDimensions(): void {
    this.dimensions.scaledCharWidth = Math.floor(this._terminal.charMeasure.width * window.devicePixelRatio);
    this.dimensions.scaledCharHeight = Math.ceil(this._terminal.charMeasure.height * window.devicePixelRatio);
    this.dimensions.scaledCellWidth = this.dimensions.scaledCharWidth + Math.round(this._terminal.options.letterSpacing);
    this.dimensions.scaledCellHeight = Math.floor(this.dimensions.scaledCharHeight * this._terminal.options.lineHeight);
    this.dimensions.scaledCharLeft = 0;
    this.dimensions.scaledCharTop = 0;
    this.dimensions.scaledCanvasWidth = this.dimensions.scaledCellWidth * this._terminal.cols;
    this.dimensions.scaledCanvasHeight = this.dimensions.scaledCellHeight * this._terminal.rows;
    this.dimensions.canvasWidth = Math.round(this.dimensions.scaledCanvasWidth / window.devicePixelRatio);
    this.dimensions.canvasHeight = Math.round(this.dimensions.scaledCanvasHeight / window.devicePixelRatio);
    this.dimensions.actualCellWidth = this.dimensions.canvasWidth / this._terminal.cols;
    this.dimensions.actualCellHeight = this.dimensions.canvasHeight / this._terminal.rows;

    this._rowElements.forEach(element => {
      element.style.width = `${this.dimensions.canvasWidth}px`;
      element.style.height = `${this.dimensions.actualCellHeight}px`;
      element.style.lineHeight = `${this.dimensions.actualCellHeight}px`;
      // Make sure rows don't overflow onto following row
      element.style.overflow = 'hidden';
    });

    if (!this._dimensionsStyleElement) {
      this._dimensionsStyleElement = document.createElement('style');
      this._terminal.screenElement.appendChild(this._dimensionsStyleElement);
    }

    const styles =
        `${this._terminalSelector} .${ROW_CONTAINER_CLASS} span {` +
        ` display: inline-block;` +
        ` height: 100%;` +
        ` vertical-align: top;` +
        ` width: ${this.dimensions.actualCellWidth}px` +
        `}`;

    this._dimensionsStyleElement.innerHTML = styles;

    this._selectionContainer.style.height = (<any>this._terminal)._viewportElement.style.height;
    this._terminal.screenElement.style.width = `${this.dimensions.canvasWidth}px`;
    this._terminal.screenElement.style.height = `${this.dimensions.canvasHeight}px`;
  }

  public setTheme(theme: ITheme | undefined): IColorSet {
    if (theme) {
      this.colorManager.setTheme(theme);
    }

    if (!this._themeStyleElement) {
      this._themeStyleElement = document.createElement('style');
      this._terminal.screenElement.appendChild(this._themeStyleElement);
    }

    // Base CSS
    let styles =
        `${this._terminalSelector} .${ROW_CONTAINER_CLASS} {` +
        ` color: ${this.colorManager.colors.foreground.css};` +
        ` background-color: ${this.colorManager.colors.background.css};` +
        ` font-family: ${this._terminal.getOption('fontFamily')};` +
        ` font-size: ${this._terminal.getOption('fontSize')}px;` +
        `}`;
    // Text styles
    styles +=
        `${this._terminalSelector} span:not(.${BOLD_CLASS}) {` +
        ` font-weight: ${this._terminal.options.fontWeight};` +
        `}` +
        `${this._terminalSelector} span.${BOLD_CLASS} {` +
        ` font-weight: ${this._terminal.options.fontWeightBold};` +
        `}` +
        `${this._terminalSelector} span.${ITALIC_CLASS} {` +
        ` font-style: italic;` +
        `}`;
    // Cursor
    styles +=
        `${this._terminalSelector} .${ROW_CONTAINER_CLASS}:not(.${FOCUS_CLASS}) .${CURSOR_CLASS} {` +
        ` outline: 1px solid ${this.colorManager.colors.cursor.css};` +
        ` outline-offset: -1px;` +
        `}` +
        `${this._terminalSelector} .${ROW_CONTAINER_CLASS}.${FOCUS_CLASS} .${CURSOR_CLASS}.${CURSOR_STYLE_BLOCK_CLASS} {` +
        ` background-color: ${this.colorManager.colors.cursor.css};` +
        ` color: ${this.colorManager.colors.cursorAccent.css};` +
        `}` +
        `${this._terminalSelector} .${ROW_CONTAINER_CLASS}.${FOCUS_CLASS} .${CURSOR_CLASS}.${CURSOR_STYLE_BAR_CLASS} {` +
        ` box-shadow: 1px 0 0 ${this.colorManager.colors.cursor.css} inset;` +
        `}` +
        `${this._terminalSelector} .${ROW_CONTAINER_CLASS}.${FOCUS_CLASS} .${CURSOR_CLASS}.${CURSOR_STYLE_UNDERLINE_CLASS} {` +
        ` box-shadow: 0 -1px 0 ${this.colorManager.colors.cursor.css} inset;` +
        `}`;
    // Selection
    styles +=
        `${this._terminalSelector} .${SELECTION_CLASS} {` +
        ` position: absolute;` +
        ` top: 0;` +
        ` left: 0;` +
        ` z-index: 1;` +
        ` pointer-events: none;` +
        `}` +
        `${this._terminalSelector} .${SELECTION_CLASS} div {` +
        ` position: absolute;` +
        ` background-color: ${this.colorManager.colors.selection.css};` +
        `}`;
    // Colors
    this.colorManager.colors.ansi.forEach((c, i) => {
      styles +=
          `${this._terminalSelector} .${FG_CLASS_PREFIX}${i} { color: ${c.css}; }` +
          `${this._terminalSelector} .${BG_CLASS_PREFIX}${i} { background-color: ${c.css}; }`;
    });
    styles +=
        `${this._terminalSelector} .${FG_CLASS_PREFIX}${INVERTED_DEFAULT_COLOR} { color: ${this.colorManager.colors.background.css}; }` +
        `${this._terminalSelector} .${BG_CLASS_PREFIX}${INVERTED_DEFAULT_COLOR} { background-color: ${this.colorManager.colors.foreground.css}; }`;

    this._themeStyleElement.innerHTML = styles;
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
    this._updateDimensions();
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

  public onSelectionChanged(start: [number, number], end: [number, number], columnSelectMode: boolean): void {
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

    if (columnSelectMode) {
      documentFragment.appendChild(
        this._createSelectionElement(viewportCappedStartRow, start[0], end[0], viewportCappedEndRow - viewportCappedStartRow + 1)
      );
    } else {
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
    element.style.height = `${rowCount * this.dimensions.actualCellHeight}px`;
    element.style.top = `${row * this.dimensions.actualCellHeight}px`;
    element.style.left = `${colStart * this.dimensions.actualCellWidth}px`;
    element.style.width = `${this.dimensions.actualCellWidth * (colEnd - colStart)}px`;
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
    const cursorX = this._terminal.buffer.x;

    for (let y = start; y <= end; y++) {
      const rowElement = this._rowElements[y];
      rowElement.innerHTML = '';

      const row = y + terminal.buffer.ydisp;
      const lineData = terminal.buffer.lines.get(row);
      const cursorStyle = terminal.options.cursorStyle;
      rowElement.appendChild(this._rowFactory.createRow(lineData, row === cursorAbsoluteY, cursorStyle, cursorX, this.dimensions.actualCellWidth, terminal.cols));
    }

    this._terminal.emit('refresh', {start, end});
  }

  private get _terminalSelector(): string {
    return `.${TERMINAL_CLASS_PREFIX}${this._terminalClass}`;
  }

  public registerCharacterJoiner(handler: CharacterJoinerHandler): number { return -1; }
  public deregisterCharacterJoiner(joinerId: number): boolean { return false; }

  private _onLinkHover(e: ILinkHoverEvent): void {
    this._setCellUnderline(e.x1, e.x2, e.y1, e.y2, e.cols, true);
  }

  private _onLinkLeave(e: ILinkHoverEvent): void {
    this._setCellUnderline(e.x1, e.x2, e.y1, e.y2, e.cols, false);
  }

  private _setCellUnderline(x: number, x2: number, y: number, y2: number, cols: number, enabled: boolean): void {
    while (x !== x2 || y !== y2) {
      const row = this._rowElements[y];
      if (!row) {
        return;
      }
      const span = <HTMLElement>row.children[x];
      span.style.textDecoration = enabled ? 'underline' : 'none';
      x = (x + 1) % cols;
      if (x === 0) {
        y++;
      }
    }
  }
}
