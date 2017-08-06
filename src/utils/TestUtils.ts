import { ITerminal, IBuffer, IBufferSet, IBrowser, ICharMeasure, ISelectionManager, ITerminalOptions, IListenerType } from '../Interfaces';

export class MockTerminal implements ITerminal {
  options: ITerminalOptions = {};
  element: HTMLElement;
  rowContainer: HTMLElement;
  selectionContainer: HTMLElement;
  selectionManager: ISelectionManager;
  charMeasure: ICharMeasure;
  textarea: HTMLTextAreaElement;
  rows: number;
  cols: number;
  browser: IBrowser;
  writeBuffer: string[];
  children: HTMLElement[];
  cursorHidden: boolean;
  cursorState: number;
  defAttr: number;
  scrollback: number;
  buffers: IBufferSet;
  buffer: IBuffer;

  handler(data: string): void {
    throw new Error('Method not implemented.');
  }
  on(event: string, callback: () => void): void {
    throw new Error('Method not implemented.');
  }
  off(type: string, listener: IListenerType): void {
    throw new Error('Method not implemented.');
  }
  scrollDisp(disp: number, suppressScrollEvent: boolean): void {
    throw new Error('Method not implemented.');
  }
  cancel(ev: Event, force?: boolean): void {
    throw new Error('Method not implemented.');
  }
  log(text: string): void {
    throw new Error('Method not implemented.');
  }
  emit(event: string, data: any): void {
    throw new Error('Method not implemented.');
  }
  reset(): void {
    throw new Error('Method not implemented.');
  }
  showCursor(): void {
    throw new Error('Method not implemented.');
  }
  blankLine(cur?: boolean, isWrapped?: boolean): [number, string, number][] {
    const line: [number, string, number][] = [];
    for (let i = 0; i < this.cols; i++) {
      line.push([0, ' ', 1]);
    }
    return line;
  }
}
