import { ITerminal, IBuffer, IBufferSet, IBrowser, ICharMeasure, ISelectionManager } from '../Interfaces';

export class MockTerminal implements ITerminal {
  public element: HTMLElement;
  public rowContainer: HTMLElement;
  public selectionContainer: HTMLElement;
  public selectionManager: ISelectionManager;
  public charMeasure: ICharMeasure;
  public textarea: HTMLTextAreaElement;
  public rows: number;
  public cols: number;
  public browser: IBrowser;
  public writeBuffer: string[];
  public children: HTMLElement[];
  public cursorHidden: boolean;
  public cursorState: number;
  public defAttr: number;
  public scrollback: number;
  public buffers: IBufferSet;
  public buffer: IBuffer;

  handler(data: string) {
    throw new Error('Method not implemented.');
  }
  on(event: string, callback: () => void) {
    throw new Error('Method not implemented.');
  }
  scrollDisp(disp: number, suppressScrollEvent: boolean) {
    throw new Error('Method not implemented.');
  }
  cancel(ev: Event, force?: boolean) {
    throw new Error('Method not implemented.');
  }
  log(text: string): void {
    throw new Error('Method not implemented.');
  }
  emit(event: string, data: any) {
    throw new Error('Method not implemented.');
  }
  reset(): void {
    throw new Error('Method not implemented.');
  }
  showCursor(): void {
    throw new Error('Method not implemented.');
  }
  blankLine(cur?: boolean, isWrapped?: boolean, cols?: number) {
    const line = [];
    cols = cols || this.cols;
    for (let i = 0; i < cols; i++) {
      line.push([0, ' ', 1]);
    }
    return line;
  }
}
