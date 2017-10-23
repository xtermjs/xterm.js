/**
 * Alt+Click handler module: exports methods for handling all alt+click-related events in the
 * terminal.
 * @module xterm/handlers/AltClickHandler
 * @license MIT
 */

import { Terminal } from '../Terminal';
import { CHAR_DATA_WIDTH_INDEX } from '../Buffer';
import { C0 } from '../EscapeSequences';

export class AltClickHandler {
  private _terminal: Terminal;
  private _mouseRow: number;
  private _mouseCol: number;
  private _mouseEvent: MouseEvent;

  constructor(mouseEvent: MouseEvent, terminal: Terminal) {
    this._terminal = terminal;

    [this._mouseCol, this._mouseRow] = this._terminal.mouseHelper.getCoords(
      (this._mouseEvent = mouseEvent),
      this._terminal.element,
      this._terminal.charMeasure,
      this._terminal.options.lineHeight,
      this._terminal.cols,
      this._terminal.rows,
      true
    ).map((coordinate: number) => {
      return coordinate - 1;
    });
  }

  public move(): void {
    if (!this._mouseEvent.altKey) return;

    let keyboardArrows;

    if (this._terminal.buffer === this._terminal.buffers.normal) {
      keyboardArrows = this.buildArrowSequence(this.normalCharCount(), this.horizontalCursorCommand(this.normalMoveForward()));
    } else {
      let verticalChars = this.buildArrowSequence(this.altVerticalCharCount(), this.verticalCursorCommand(this.altMoveUpward()));
      let horizontalChars = this.buildArrowSequence(this.altHorizontalCharCount(), this.horizontalCursorCommand(this.altMoveForward()));

      if (this.altMoveForward()) {
        keyboardArrows = verticalChars + horizontalChars;
      } else {
        keyboardArrows = horizontalChars + verticalChars;
      }
    }

    this._terminal.send(keyboardArrows);
  }

  private buildArrowSequence(count: number, sequence: string): string {
    return Array(count).join(sequence);
  }

  private altMoveUpward(): boolean {
    return this._terminal.buffer.y > this._mouseRow;
  }

  private altMoveForward(): boolean {
    return this._terminal.buffer.x < this._mouseCol;
  }

  private normalMoveForward(): boolean {
    return (this._terminal.buffer.x < this._mouseCol &&
      this._terminal.buffer.y <= this._mouseRow) || // down/right or same row/right
      (this._terminal.buffer.x >= this._mouseCol &&
        this._terminal.buffer.y < this._mouseRow);  // down/left or same row/left
  }

  private horizontalCursorCommand(moveForward: boolean): string {
    let mod = this._terminal.applicationCursor ? 'O' : '[';

    if (moveForward) {
      return C0.ESC + mod + 'C';
    } else {
      return C0.ESC + mod + 'D';
    }
  }

  private verticalCursorCommand(moveUp: boolean): string {
    let mod = this._terminal.applicationCursor ? 'O' : '[';

    if (moveUp) {
      return C0.ESC + mod + 'A';
    } else {
      return C0.ESC + mod + 'B';
    }
  }

  private altVerticalCharCount(): number {
    return Math.abs(this._terminal.buffer.y - this._mouseRow) + 1;
  }

  private altHorizontalCharCount(): number {
    return Math.abs(this._terminal.buffer.x - this._mouseCol) + 1;
  }

  private normalCharCount(): number {
    let currentX = this._terminal.buffer.x;
    let currentY = this._terminal.buffer.y;
    let startCol = this._terminal.buffer.x;
    let bufferStr = '';

    while (currentX !== this._mouseCol || (currentY !== this._mouseRow)) {
      if (this.normalMoveForward()) {
        currentX++;
        if (currentX > this._terminal.cols - 1) {
          bufferStr += this._terminal.buffer.translateBufferLineToString(currentY, false, startCol, currentX);
          currentX = 0;
          startCol = 0;
          currentY++;
        }
      } else {
        currentX--;
        if (currentX < 0) {
          bufferStr += this._terminal.buffer.translateBufferLineToString(currentY, false, 0, startCol + 1);
          currentX = this._terminal.cols - 1;
          startCol = currentX;
          currentY--;
        }
      }
    }

    if (this.normalMoveForward()) {
      currentX++;
    } else {
      currentX--;
    }
    bufferStr += this._terminal.buffer.translateBufferLineToString(currentY, false, startCol, currentX);
    return bufferStr.length;
  }
}
