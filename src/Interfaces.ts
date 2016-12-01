/**
 * @license MIT
 */

export interface ITerminal {
  element: HTMLElement;
  rowContainer: HTMLElement;
  ydisp: number;
  lines: string[];
  rows: number;

  /**
   * Emit the 'data' event and populate the given data.
   * @param data The data to populate in the event.
   */
  handler(data: string);
  on(event: string, callback: () => void);
  scrollDisp(disp: number, suppressScrollEvent: boolean);
}
