/**
 * @license MIT
 */

export type LinkMatcher = {
  id: number,
  regex: RegExp,
  handler: LinkMatcherHandler,
  hoverCallback?: LinkMatcherHandler,
  matchIndex?: number,
  validationCallback?: LinkMatcherValidationCallback,
  priority?: number
};
export type LinkMatcherHandler = (event: MouseEvent, uri: string) => boolean | void;
export type LinkMatcherValidationCallback = (uri: string, callback: (isValid: boolean) => void) => void;

export type CustomKeyEventHandler = (event: KeyboardEvent) => boolean;
export type Charset = {[key: string]: string};

// TODO: Add code here?
export type CharData = [number, string, number];
export type LineData = CharData[];
