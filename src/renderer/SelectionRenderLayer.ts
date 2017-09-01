import { ISelectionRenderLayer } from './Interfaces';
import { IBuffer, ICharMeasure, ITerminal } from '../Interfaces';
import { CHAR_DATA_ATTR_INDEX } from '../Buffer';
import { GridCache } from './GridCache';
import { FLAGS } from './Types';
import { BaseRenderLayer } from './BaseRenderLayer';

export class SelectionRenderLayer extends BaseRenderLayer implements ISelectionRenderLayer {
  private _state: {start: [number, number], end: [number, number]};

  constructor(container: HTMLElement, zIndex: number) {
    super(container, 'selection', zIndex);
    this._state = {
      start: null,
      end: null
    };
  }

  public render(terminal: ITerminal, start: [number, number], end: [number, number]): void {
    const scaledCharWidth = Math.ceil(terminal.charMeasure.width) * window.devicePixelRatio;
    const scaledCharHeight = Math.ceil(terminal.charMeasure.height) * window.devicePixelRatio;

    // Selection has not changed
    if (this._state.start === start || this._state.end === end) {
      return;
    }

    // Remove all selections
    this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);

    // Selection does not exist
    if (!start || !end) {
      return;
    }

    // Translate from buffer position to viewport position
    const viewportStartRow = start[1] - terminal.buffer.ydisp;
    const viewportEndRow = end[1] - terminal.buffer.ydisp;
    const viewportCappedStartRow = Math.max(viewportStartRow, 0);
    const viewportCappedEndRow = Math.min(viewportEndRow, terminal.rows - 1);

    // No need to draw the selection
    if (viewportCappedStartRow >= terminal.rows || viewportCappedEndRow < 0) {
      return;
    }

    // Draw first row
    const startCol = viewportStartRow === viewportCappedStartRow ? start[0] : 0;
    const startRowEndCol = viewportCappedStartRow === viewportCappedEndRow ? end[0] : terminal.cols;
    this._ctx.fillStyle = 'rgba(255,255,255,0.3)';
    this._ctx.fillRect(startCol * scaledCharWidth, viewportCappedStartRow * scaledCharHeight, (startRowEndCol - startCol) * scaledCharWidth, scaledCharHeight);

    // Draw middle rows
    const middleRowsCount = Math.max(viewportCappedEndRow - viewportCappedStartRow - 1, 0);
    this._ctx.fillRect(0, (viewportCappedStartRow + 1) * scaledCharHeight, terminal.cols * scaledCharWidth, middleRowsCount * scaledCharHeight);

    // Draw final row
    if (viewportCappedStartRow !== viewportCappedEndRow) {
      // Only draw viewportEndRow if it's not the same as viewporttartRow
      const endCol = viewportEndRow === viewportCappedEndRow ? end[0] : terminal.cols;
      this._ctx.fillRect(0, viewportCappedEndRow * scaledCharHeight, endCol * scaledCharWidth, scaledCharHeight);
    }

    // Save state for next render
    this._state.start = [start[0], start[1]];
    this._state.end = [end[0], end[1]];
  }
}
