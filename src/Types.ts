/**
 * @license MIT
 */

export type LinkMatcher = {
  id: number,
  regex: RegExp,
  handler: LinkMatcherHandler,
  matchIndex?: number,
  validationCallback?: LinkMatcherValidationCallback,
  priority?: number
};
export type LinkMatcherHandler = (event: MouseEvent, uri: string) => boolean | void;
export type LinkMatcherValidationCallback = (uri: string, element: HTMLElement, callback: (isValid: boolean) => void) => void;

export type CustomKeyEventHandler = (event: KeyboardEvent) => boolean;
export type Charset = {[key: string]: string};

// TODO: Add code here?
export type CharData = [number, string, number];
export type LineData = CharData[];
