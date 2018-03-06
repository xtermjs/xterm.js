import { ITerminal } from '../Types';
import { IDisposable } from 'xterm';

/**
 * Debounces calls to render terminal rows using animation frames.
 */
export class RenderDebouncer implements IDisposable {
  private _rowStart: number;
  private _rowEnd: number;
  private _animationFrame: number = null;

  constructor(
    private _terminal: ITerminal,
    private _callback: (start: number, end: number) => void
  ) {
  }

  public dispose(): void {
    if (this._animationFrame) {
      window.cancelAnimationFrame(this._animationFrame);
      this._animationFrame = null;
    }
  }

  public refresh(rowStart?: number, rowEnd?: number): void {
    rowStart = rowStart || 0;
    rowEnd = rowEnd || this._terminal.rows - 1;
    this._rowStart = this._rowStart !== undefined ? Math.min(this._rowStart, rowStart) : rowStart;
    this._rowEnd = this._rowEnd !== undefined ? Math.max(this._rowEnd, rowEnd) : rowEnd;

    if (this._animationFrame) {
      return;
    }

    this._animationFrame = window.requestAnimationFrame(() => this._innerRefresh());
  }

  private _innerRefresh(): void {
    // Clamp values
    this._rowStart = Math.max(this._rowStart, 0);
    this._rowEnd = Math.min(this._rowEnd, this._terminal.rows - 1);

    // Run render callback
    this._callback(this._rowStart, this._rowEnd);

    // Reset debouncer
    this._rowStart = null;
    this._rowEnd = null;
    this._animationFrame = null;
  }
}
