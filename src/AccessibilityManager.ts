import { ITerminal, IBuffer, IDisposable } from './Interfaces';

export class AccessibilityManager implements IDisposable {
  private _accessibilityTreeRoot: HTMLElement;
  private _rowContainer: HTMLElement;
  private _rowElements: HTMLElement[] = [];
  private _liveRegion: HTMLElement;

  private _disposables: IDisposable[] = [];

  /**
   * This queue has a character pushed to it for keys that are pressed, if the
   * next character added to the terminal is equal to the key char then it is
   * not announced (added to live region) because it has already been announced
   * by the textarea event (which cannot be canceled). There are some race
   * condition cases if there is typing while data is streaming, but this covers
   * the main case of typing into the prompt and inputting the answer to a
   * question (Y/N, etc.).
   */
  private _charsToConsume: string[] = [];

  constructor(private _terminal: ITerminal) {
    this._accessibilityTreeRoot = document.createElement('div');
    this._accessibilityTreeRoot.classList.add('accessibility');
    this._rowContainer = document.createElement('div');
    this._rowContainer.classList.add('accessibility-tree');
    for (let i = 0; i < this._terminal.rows; i++) {
      this._rowElements[i] = document.createElement('div');
      this._rowContainer.appendChild(this._rowElements[i]);
    }
    this._accessibilityTreeRoot.appendChild(this._rowContainer);

    this._liveRegion = document.createElement('div');
    this._liveRegion.classList.add('live-region');
    this._liveRegion.setAttribute('aria-live', 'polite');
    this._accessibilityTreeRoot.appendChild(this._liveRegion);

    this._terminal.element.appendChild(this._accessibilityTreeRoot);

    this._addTerminalEventListener('resize', data => this._onResize(data.cols, data.rows));
    this._addTerminalEventListener('refresh', data => this._refreshRows(data.start, data.end));
    // Line feed is an issue as the prompt won't be read out after a command is run
    // this._terminal.on('lineFeed', () => this._onLineFeed());
    this._addTerminalEventListener('a11y.char', (char) => this._onChar(char));
    this._addTerminalEventListener('lineFeed', () => this._onChar('\n'));
    this._addTerminalEventListener('charsizechanged', () => this._refreshRowsDimensions());
    this._addTerminalEventListener('key', keyChar => this._onKey(keyChar));
  }

  private _addTerminalEventListener(type: string, listener: (...args: any[]) => any): void {
    this._terminal.on(type, listener);
    this._disposables.push({
      dispose: () => {
        this._terminal.off(type, listener);
      }
    });
  }

  public dispose(): void {
    this._terminal.element.removeChild(this._accessibilityTreeRoot);
    this._accessibilityTreeRoot = null;
    this._rowContainer = null;
    this._liveRegion = null;
    this._rowContainer = null;
    this._rowElements = null;
    this._disposables.forEach(d => d.dispose());
    this._disposables = null;
  }

  private _onResize(cols: number, rows: number): void {
    for (let i = this._rowContainer.children.length; i < this._terminal.rows; i++) {
      this._rowElements[i] = document.createElement('div');
      this._rowContainer.appendChild(this._rowElements[i]);
    }
    // TODO: Handle case when rows reduces

    this._refreshRowsDimensions();
  }

  private _onChar(char: string): void {
    if (this._charsToConsume.length > 0) {
      // Have the screen reader ignore the char if it was just input
      if (this._charsToConsume.shift() !== char) {
        this._liveRegion.textContent += char;
      }
    } else {
      this._liveRegion.textContent += char;
    }
    // TODO: Clear at some point
    // TOOD: Handle heaps of data

    // This is temporary, should refresh at a much slower rate
    this._refreshRows();
  }

  private _onKey(keyChar: string): void {
    this._charsToConsume.push(keyChar);
  }

  // private _onLineFeed(): void {
  //   const buffer: IBuffer = (<any>this._terminal.buffer);
  //   const newLine = buffer.lines.get(buffer.ybase + buffer.y);
  //   // Only use the data when the new line is ready
  //   if (!(<any>newLine).isWrapped) {
  //     this._accessibilityTreeRoot.textContent += `${this._getWrappedLineData(buffer, buffer.ybase + buffer.y - 1)}\n`;
  //   }
  // }

  // private _getWrappedLineData(buffer: IBuffer, lineIndex: number): string {
  //   let lineData = buffer.translateBufferLineToString(lineIndex, true);
  //   while (lineIndex >= 0 && (<any>buffer.lines.get(lineIndex--)).isWrapped) {
  //     lineData = buffer.translateBufferLineToString(lineIndex, true) + lineData;
  //   }
  //   return lineData;
  // }

  // TODO: Hook up to refresh when the renderer refreshes the range? Slower to prevent layout thrashing?
  private _refreshRows(start?: number, end?: number): void {
    const buffer: IBuffer = (<any>this._terminal.buffer);
    start = start || 0;
    end = end || this._terminal.rows - 1;
    for (let i = start; i <= end; i++) {
      const lineData = buffer.translateBufferLineToString(buffer.ybase + i, true);
      this._rowElements[i].textContent = lineData;
    }
  }

  private _refreshRowsDimensions(): void {
    const buffer: IBuffer = (<any>this._terminal.buffer);
    const dimensions = this._terminal.renderer.dimensions;
    for (let i = 0; i < this._terminal.rows; i++) {
      this._rowElements[i].style.height = `${dimensions.actualCellHeight}px`;
    }
    // TODO: Verify it works on macOS and varying zoom levels
    // TODO: Fire when window resizes
  }
}
