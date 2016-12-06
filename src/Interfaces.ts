/**
 * @license MIT
 */

export interface IBrowser {
  isNode: boolean;
  userAgent: string;
  platform: string;
  isFirefox: boolean;
  isMSIE: boolean;
  isMac: boolean;
  isIpad: boolean;
  isIphone: boolean;
  isMSWindows: boolean;
}

export interface ITerminal {
  element: HTMLElement;
  rowContainer: HTMLElement;
  textarea: HTMLTextAreaElement;
  ydisp: number;
  lines: string[];
  rows: number;
  browser: IBrowser;

  /**
   * Emit the 'data' event and populate the given data.
   * @param data The data to populate in the event.
   */
  handler(data: string);
  on(event: string, callback: () => void);
  scrollDisp(disp: number, suppressScrollEvent: boolean);
  cancel(ev: Event, force?: boolean);
}
